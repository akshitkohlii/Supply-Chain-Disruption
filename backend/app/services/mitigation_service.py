from app.core.database import db


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def to_priority(level: str, priority_level: str | None) -> str:
    if level == "critical":
        return "high"
    if level == "warning":
        return "medium"

    if priority_level and priority_level.lower() == "high":
        return "medium"
    return "low"


def build_reason(alert: dict) -> str:
    category = alert.get("category", "geo")
    destination_port = alert.get("destination_port", "the destination port")
    supplier_name = alert.get("supplier_name", "the supplier")

    delay_hours = float(alert.get("delay_hours", 0) or 0)
    weather_risk = float(alert.get("weather_risk", 0) or 0)
    port_congestion = float(alert.get("port_congestion", 0) or 0)
    inventory_level = float(alert.get("inventory_level", 0) or 0)
    safety_stock_level = float(alert.get("safety_stock_level", 0) or 0)

    if category == "climate":
        return (
            f"Weather volatility near {destination_port} is elevated "
            f"(weather risk {round(weather_risk, 2)}), increasing disruption probability."
        )

    if category == "port":
        return (
            f"Port congestion at {destination_port} is elevated "
            f"(score {round(port_congestion, 2)}), increasing transit delays and queue time."
        )

    if category == "supplier":
        return (
            f"{supplier_name} is under inventory pressure with stock at "
            f"{round(inventory_level, 2)} below safety stock {round(safety_stock_level, 2)}."
        )

    if category == "logistics":
        return (
            f"Transit delay has reached {round(delay_hours, 2)} hours, "
            f"putting service levels and recovery timelines at risk."
        )

    return (
        f"Multiple weak signals across delay, weather, and congestion indicate "
        f"higher route risk for {destination_port}."
    )


def build_actions(alert: dict) -> list[str]:
    category = alert.get("category", "geo")
    business_unit = alert.get("business_unit", "Operations")

    if category == "climate":
        return [
            "Shift critical shipments to lower-weather-risk lane",
            "Increase regional buffer inventory for exposed SKUs",
            f"Escalate monitoring to {business_unit} control tower",
        ]

    if category == "port":
        return [
            "Reroute affected loads to alternate destination port",
            "Prioritize high-value and high-urgency shipments",
            "Temporarily rebalance throughput across available lanes",
        ]

    if category == "supplier":
        return [
            "Increase safety stock coverage for impacted SKUs",
            "Trigger alternate supplier readiness review",
            "Protect top-demand orders with allocation controls",
        ]

    if category == "logistics":
        return [
            "Expedite delayed loads through alternate transit path",
            "Split shipment batches based on urgency",
            "Re-sequence deliveries for high-priority customers",
        ]

    return [
        "Activate enhanced route monitoring",
        "Review alternate lane and supplier options",
        "Increase short-term operational buffer",
    ]


def build_title(alert: dict) -> str:
    category = alert.get("category", "geo")
    destination_port = alert.get("destination_port", "destination lane")
    supplier_name = alert.get("supplier_name", "supplier")

    if category == "climate":
        return f"Weather mitigation plan for {destination_port}"
    if category == "port":
        return f"Port congestion mitigation for {destination_port}"
    if category == "supplier":
        return f"Inventory stabilization plan for {supplier_name}"
    if category == "logistics":
        return f"Delay recovery plan for {destination_port}"
    return f"Risk containment plan for {destination_port}"


def build_reroute_plan(alert: dict, eta_savings_hours: float) -> dict:
    origin_port = alert.get("origin_port") or "Current Origin"
    destination_port = alert.get("destination_port") or "Current Destination"

    alternate_map = {
        "Shanghai Port": "Busan Port",
        "Busan Port": "Shanghai Port",
        "Hamburg Port": "Mumbai Port",
        "Mumbai Port": "Hamburg Port",
        "Los Angeles Port": "Busan Port",
    }

    alternate = alternate_map.get(destination_port, "Busan Port")

    return {
        "from": origin_port,
        "to": alternate,
        "eta_savings_hours": round(max(4, eta_savings_hours), 2),
    }


def build_stock_plan(alert: dict) -> dict:
    supplier_name = alert.get("supplier_name", "Unknown Supplier")
    business_unit = alert.get("business_unit", "General")
    inventory_level = float(alert.get("inventory_level", 0) or 0)
    safety_stock_level = float(alert.get("safety_stock_level", 0) or 0)

    current_days_cover = max(1, round(inventory_level / 80))
    recommended_days_cover = max(current_days_cover + 2, round(safety_stock_level / 60))
    increase_percent = round(
        max(
            10,
            ((recommended_days_cover - current_days_cover) / max(current_days_cover, 1)) * 100,
        ),
        2,
    )

    return {
        "supplier": supplier_name,
        "sku_group": business_unit,
        "current_days_cover": current_days_cover,
        "recommended_days_cover": recommended_days_cover,
        "increase_percent": increase_percent,
    }


def build_scenarios(alert: dict, base_risk: float) -> list[dict]:
    delay_hours = float(alert.get("delay_hours", 0) or 0)

    no_action_delay = round(delay_hours, 2)
    no_action_recovery = round(max(1.5, delay_hours / 8), 2)

    reroute_risk = clamp(base_risk - 15)
    reroute_delay = round(max(4, delay_hours * 0.62), 2)
    reroute_recovery = round(max(1.2, no_action_recovery * 0.72), 2)

    stock_risk = clamp(base_risk - 11)
    stock_delay = round(max(5, delay_hours * 0.78), 2)
    stock_recovery = round(max(1.0, no_action_recovery * 0.64), 2)

    hybrid_risk = clamp(base_risk - 25)
    hybrid_delay = round(max(3, delay_hours * 0.4), 2)
    hybrid_recovery = round(max(1.0, no_action_recovery * 0.48), 2)

    return [
        {
            "id": "base",
            "label": "No Action",
            "risk_score": round(base_risk, 2),
            "delay_hours": no_action_delay,
            "recovery_days": no_action_recovery,
            "cost_impact": 0,
        },
        {
            "id": "reroute",
            "label": "Reroute",
            "risk_score": round(reroute_risk, 2),
            "delay_hours": reroute_delay,
            "recovery_days": reroute_recovery,
            "cost_impact": 6,
        },
        {
            "id": "buffer",
            "label": "Increase Safety Stock",
            "risk_score": round(stock_risk, 2),
            "delay_hours": stock_delay,
            "recovery_days": stock_recovery,
            "cost_impact": 8,
        },
        {
            "id": "hybrid",
            "label": "Reroute + Buffer Stock",
            "risk_score": round(hybrid_risk, 2),
            "delay_hours": hybrid_delay,
            "recovery_days": hybrid_recovery,
            "cost_impact": 12,
        },
    ]


def build_mitigation_payload(alert: dict) -> dict:
    delay_hours = float(alert.get("delay_hours", 0) or 0)
    weather_risk = float(alert.get("weather_risk", 0) or 0)
    port_congestion = float(alert.get("port_congestion", 0) or 0)
    inventory_level = float(alert.get("inventory_level", 0) or 0)
    safety_stock_level = float(alert.get("safety_stock_level", 0) or 0)

    inventory_pressure = max(0, safety_stock_level - inventory_level)

    base_risk = clamp(
        (delay_hours * 1.3)
        + (weather_risk * 22)
        + (port_congestion * 22)
        + (inventory_pressure * 0.08)
    )

    confidence = clamp(
        62
        + (12 if alert.get("level") == "critical" else 6 if alert.get("level") == "warning" else 0)
        + (6 if weather_risk >= 0.7 else 0)
        + (6 if port_congestion >= 0.7 else 0)
        + (6 if inventory_level < safety_stock_level else 0),
        55,
        95,
    )

    impact_reduction = clamp(18 if alert.get("level") == "critical" else 12 if alert.get("level") == "warning" else 8)
    scenarios = build_scenarios(alert, base_risk)
    hybrid = next((item for item in scenarios if item["id"] == "hybrid"), scenarios[-1])
    eta_savings_hours = max(4, delay_hours - hybrid["delay_hours"])

    return {
        "id": f"MIT_{alert['alert_id']}",
        "alert_id": alert["alert_id"],
        "title": build_title(alert),
        "priority": to_priority(alert.get("level", "warning"), alert.get("priority_level")),
        "confidence": round(confidence, 2),
        "impact_reduction": round(impact_reduction, 2),
        "reason": build_reason(alert),
        "actions": build_actions(alert),
        "reroute_plan": build_reroute_plan(alert, eta_savings_hours),
        "stock_plan": build_stock_plan(alert),
        "scenarios": scenarios,
    }


async def get_mitigation_by_alert_id(alert_id: str):
    alert = await db.alerts.find_one({"alert_id": alert_id}, {"_id": 0})

    if not alert:
        return None

    return build_mitigation_payload(alert)