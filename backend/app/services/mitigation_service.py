from typing import Any, Dict, List, Optional

from app.core.database import get_database


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def priority_multiplier(priority_level: Optional[str]) -> float:
    if not priority_level:
        return 1.0

    value = priority_level.strip().lower()
    if value == "high":
        return 1.5
    if value == "medium":
        return 1.0
    if value == "low":
        return 0.7
    return 1.0


def temperature_multiplier(temperature_control_required: Any) -> float:
    if isinstance(temperature_control_required, bool):
        return 1.3 if temperature_control_required else 1.0

    if isinstance(temperature_control_required, str):
        return 1.3 if temperature_control_required.strip().lower() in {"true", "yes", "1"} else 1.0

    return 1.0


def estimate_delay_damage(
    order_value: float,
    delay_hours: float,
    priority_level: Optional[str],
    temperature_control_required: Any,
) -> float:
    delay_days = max(delay_hours, 0.0) / 24.0
    base_damage = order_value * 0.01 * delay_days
    return base_damage * priority_multiplier(priority_level) * temperature_multiplier(
        temperature_control_required
    )


def build_scenarios(
    final_risk: float,
    delay_hours: float,
    order_value: float,
    priority_level: Optional[str],
    temperature_control_required: Any,
) -> List[Dict[str, Any]]:
    baseline_damage = estimate_delay_damage(
        order_value=order_value,
        delay_hours=delay_hours,
        priority_level=priority_level,
        temperature_control_required=temperature_control_required,
    )

    reroute_delay = max(4.0, delay_hours - 18.0)
    reroute_exec_cost = order_value * 0.12
    reroute_residual = estimate_delay_damage(
        order_value=order_value,
        delay_hours=reroute_delay,
        priority_level=priority_level,
        temperature_control_required=temperature_control_required,
    )
    reroute_total = reroute_exec_cost + reroute_residual

    buffer_delay = max(6.0, delay_hours - 8.0)
    buffer_exec_cost = order_value * 0.04
    buffer_residual = estimate_delay_damage(
        order_value=order_value,
        delay_hours=buffer_delay,
        priority_level=priority_level,
        temperature_control_required=temperature_control_required,
    )
    buffer_total = buffer_exec_cost + buffer_residual

    priority_delay = max(3.0, delay_hours - 12.0)
    priority_exec_cost = order_value * 0.07
    priority_residual = estimate_delay_damage(
        order_value=order_value,
        delay_hours=priority_delay,
        priority_level=priority_level,
        temperature_control_required=temperature_control_required,
    )
    priority_total = priority_exec_cost + priority_residual

    return [
        {
            "id": "reroute",
            "label": "Reroute via alternate lane",
            "risk_score": round(clamp(final_risk - 18), 2),
            "delay_hours": round(reroute_delay, 2),
            "recovery_days": round(max(1.0, reroute_delay / 24.0), 2),
            "cost_impact": round(reroute_total, 2),
        },
        {
            "id": "buffer-stock",
            "label": "Increase safety stock",
            "risk_score": round(clamp(final_risk - 10), 2),
            "delay_hours": round(buffer_delay, 2),
            "recovery_days": round(max(1.0, buffer_delay / 24.0), 2),
            "cost_impact": round(buffer_total, 2),
        },
        {
            "id": "carrier-priority",
            "label": "Priority carrier handling",
            "risk_score": round(clamp(final_risk - 7), 2),
            "delay_hours": round(priority_delay, 2),
            "recovery_days": round(max(1.0, priority_delay / 24.0), 2),
            "cost_impact": round(priority_total, 2),
        },
    ]


def derive_priority(final_risk: float) -> str:
    if final_risk >= 70:
        return "high"
    if final_risk >= 40:
        return "medium"
    return "low"


def derive_reason(alert: Dict[str, Any]) -> str:
    scores = alert.get("scores", {}) or {}
    weather = float(scores.get("weather", 0) or 0)
    news = float(scores.get("news", 0) or 0)
    logistics = float(scores.get("logistics", 0) or 0)
    congestion = float(scores.get("congestion", 0) or 0)

    dominant = max(
        [
            ("weather", weather),
            ("news", news),
            ("logistics", logistics),
            ("congestion", congestion),
        ],
        key=lambda item: item[1],
    )[0]

    if dominant == "weather":
        return "Weather conditions are the dominant disruption driver on this route."
    if dominant == "logistics":
        return "Delay and operational friction are the dominant disruption drivers."
    if dominant == "congestion":
        return "Port congestion is the dominant disruption driver on this route."
    return "External news and disruption signals are the dominant route risk driver."


async def get_route_context(route_key: str) -> Dict[str, Any]:
    db = get_database()

    route = await db.routes_master.find_one({"route_key": route_key})
    if not route:
        return {
            "avg_order_value": 50000.0,
            "avg_delay_hours": 24.0,
            "priority_level": "Medium",
            "temperature_control_required": False,
        }

    origin = route.get("origin_port")
    destination = route.get("destination_port")

    pipeline = [
        {
            "$match": {
                "tier1_origin_port": origin,
                "tier3_destination_port": destination,
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_order_value": {"$avg": {"$ifNull": ["$order_value", 50000]}},
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 24]}},
                "high_priority_count": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$priority_level", "High"]},
                            1,
                            0,
                        ]
                    }
                },
                "medium_priority_count": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$priority_level", "Medium"]},
                            1,
                            0,
                        ]
                    }
                },
                "low_priority_count": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$priority_level", "Low"]},
                            1,
                            0,
                        ]
                    }
                },
                "temp_control_count": {
                    "$sum": {
                        "$cond": [
                            {"$eq": ["$temperature_control_required", True]},
                            1,
                            0,
                        ]
                    }
                },
                "shipment_count": {"$sum": 1},
            }
        },
    ]

    rows = await db.shipments_raw.aggregate(pipeline).to_list(length=1)
    if not rows:
        return {
            "avg_order_value": 50000.0,
            "avg_delay_hours": 24.0,
            "priority_level": "Medium",
            "temperature_control_required": False,
        }

    row = rows[0]
    shipment_count = max(int(row.get("shipment_count") or 0), 1)

    high_count = int(row.get("high_priority_count") or 0)
    medium_count = int(row.get("medium_priority_count") or 0)
    low_count = int(row.get("low_priority_count") or 0)

    if high_count >= medium_count and high_count >= low_count:
        dominant_priority = "High"
    elif medium_count >= low_count:
        dominant_priority = "Medium"
    else:
        dominant_priority = "Low"

    temperature_required = (int(row.get("temp_control_count") or 0) / shipment_count) >= 0.4

    return {
        "avg_order_value": float(row.get("avg_order_value") or 50000.0),
        "avg_delay_hours": float(row.get("avg_delay_hours") or 24.0),
        "priority_level": dominant_priority,
        "temperature_control_required": temperature_required,
    }


async def get_mitigation_plan(alert_id: str) -> Dict[str, Any]:
    db = get_database()

    alert = await db.alerts.find_one({"alert_id": alert_id})
    if not alert:
        raise ValueError("Alert not found")

    scores = alert.get("scores", {}) or {}
    final_risk = float(scores.get("final_risk", alert.get("risk_score", 0)) or 0)
    weather = float(scores.get("weather", 0) or 0)
    news = float(scores.get("news", 0) or 0)
    logistics = float(scores.get("logistics", 0) or 0)

    origin = alert.get("origin_port") or "Unknown origin"
    transit = alert.get("transit_port") or "Unknown transit"
    destination = alert.get("destination_port") or "Unknown destination"

    route_context = await get_route_context(alert.get("route_key") or alert.get("entity_id"))

    avg_order_value = float(route_context.get("avg_order_value", 50000.0) or 50000.0)
    avg_delay_hours = float(route_context.get("avg_delay_hours", 24.0) or 24.0)
    priority_level = route_context.get("priority_level", "Medium")
    temperature_control_required = route_context.get("temperature_control_required", False)

    scenarios = build_scenarios(
        final_risk=final_risk,
        delay_hours=avg_delay_hours,
        order_value=avg_order_value,
        priority_level=priority_level,
        temperature_control_required=temperature_control_required,
    )

    best_scenario = min(scenarios, key=lambda s: s["risk_score"])
    impact_reduction = round(max(0.0, final_risk - best_scenario["risk_score"]), 2)

    actions: List[str] = []

    if news >= 60:
        actions.append(f"Monitor disruption updates around {transit}.")
        actions.append(f"Prepare alternate route from {origin} to {destination}.")
    if weather >= 60:
        actions.append(
            f"Track weather risk affecting {transit if transit != 'Unknown transit' else destination}."
        )
    if logistics >= 40:
        actions.append("Prioritize shipment handling and expedite backlog clearance.")
    if not actions:
        actions = [
            "Maintain enhanced monitoring for this route.",
            "Prepare contingency routing if risk escalates.",
        ]

    return {
        "id": f"mitigation::{alert_id}",
        "alert_id": alert_id,
        "title": f"Mitigation plan for {origin} → {transit} → {destination}",
        "priority": derive_priority(final_risk),
        "confidence": round(min(0.95, 0.55 + (final_risk / 200)), 2),
        "impact_reduction": impact_reduction,
        "reason": derive_reason(alert),
        "actions": actions,
        "reroute_plan": {
            "from": transit,
            "to": destination,
            "eta_savings_hours": round(max(2.0, avg_delay_hours * 0.25), 2),
        },
        "stock_plan": {
            "supplier": origin,
            "sku_group": "Critical route products",
            "current_days_cover": max(3, round(10 - (final_risk / 15))),
            "recommended_days_cover": max(7, round(14 - (final_risk / 20))),
            "increase_percent": max(10, round(final_risk * 0.6)),
        },
        "scenarios": scenarios,
    }