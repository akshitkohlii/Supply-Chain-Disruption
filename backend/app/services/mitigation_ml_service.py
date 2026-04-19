from typing import Any, Dict, List, Optional

from app.core.database import get_database
from app.services.mitigation_model_service import predict_mitigation_outcome
from app.services.ml_service import predict_route_disruption


def safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        result = float(value)
        if result != result:
            return default
        return result
    except (TypeError, ValueError):
        return default


def normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def normalize_value_list(values: Any) -> List[str]:
    if values is None:
        return []
    if isinstance(values, list):
        return [normalize_text(value) for value in values if normalize_text(value)]
    normalized = normalize_text(values)
    return [normalized] if normalized else []


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def clamp_percent(value: float) -> int:
    return max(0, min(100, round(value)))


def classify_priority(final_risk: float, ml_risk_score: float) -> str:
    score = max(final_risk, ml_risk_score)
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def baseline_cost_percent(predicted_delay_hours: float, final_risk: float) -> int:
    return clamp_percent(predicted_delay_hours * 1.2 + final_risk * 0.35)


def baseline_recovery_days(predicted_delay_hours: float, final_risk: float) -> float:
    return round(max(1.0, predicted_delay_hours / 24.0 + final_risk / 120.0), 1)


def score_scenario(
    baseline_risk: float,
    baseline_delay: float,
    baseline_recovery_days_value: float,
    scenario_type: str,
    top_factors: List[str],
    entity_type: str = "route",
    port_kind: str = "general",
    ml_risk_score: float = 0.0,
    weather_score: int = 0,
    news_score: int = 0,
    congestion_score: int = 0,
    inventory_ratio: float = 1.0,
) -> Dict[str, Any]:
    modeled = predict_mitigation_outcome(
        scenario_type=scenario_type,
        entity_type=entity_type,
        port_kind=port_kind,
        baseline_risk=baseline_risk,
        baseline_delay=baseline_delay,
        baseline_recovery_days=baseline_recovery_days_value,
        ml_risk_score=ml_risk_score,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        inventory_ratio=inventory_ratio,
        top_factors=top_factors,
    )
    if modeled:
        return modeled

    risk = baseline_risk
    delay = baseline_delay
    recovery = baseline_recovery_days_value
    cost = baseline_cost_percent(baseline_delay, baseline_risk)

    factor_text = " ".join(top_factors).lower()

    if scenario_type == "reroute":
        risk *= 0.72
        delay *= 0.68
        recovery *= 0.72
        cost += 18

        if "high port congestion" in factor_text:
            risk *= 0.90
            delay *= 0.88

        if "elevated disruption news pressure" in factor_text:
            risk *= 0.95

    elif scenario_type == "safety_stock":
        risk *= 0.82
        delay *= 0.92
        recovery *= 0.84
        cost += 12

        if "low inventory cover versus safety stock" in factor_text:
            risk *= 0.88
            recovery *= 0.90

    elif scenario_type == "priority_handling":
        risk *= 0.86
        delay *= 0.74
        recovery *= 0.80
        cost += 24

        if "slow customs clearance baseline" in factor_text:
            delay *= 0.86
            recovery *= 0.90

    return {
        "risk_score": clamp_score(risk),
        "delay_hours": round(max(1.0, delay), 1),
        "recovery_days": round(max(0.8, recovery), 1),
        "cost_impact": clamp_percent(cost),
    }


def classify_port_alert_kind(alert: Dict[str, Any], top_factors: List[str]) -> str:
    category = str(alert.get("category") or "").lower()
    title = str(alert.get("title") or "").lower()
    summary = str(alert.get("summary") or "").lower()
    factor_text = " ".join(top_factors).lower()

    if category == "climate" or "weather" in title or "weather" in summary:
        return "weather"
    if category == "geo" or "news" in title or "geopolitical" in title or "disruption headlines" in factor_text:
        return "news"
    if category == "port" or "congestion" in title or "congestion" in summary or "high port congestion" in factor_text:
        return "congestion"
    return "general"


def build_port_actions(port_kind: str, port_name: str) -> List[str]:
    if port_kind == "congestion":
        return [
            f"Shift near-term bookings away from {port_name} into the nearest lower-pressure port pair.",
            f"Escalate terminal, berth, and gate-slot coordination for cargo already committed into {port_name}.",
            "Move high-priority containers onto priority discharge, drayage, and customs handling queues.",
            "Tighten ETA communication windows and add temporary downstream inventory buffer until congestion eases.",
        ]

    if port_kind == "weather":
        return [
            f"Hold flexible departures into {port_name} until the weather window stabilizes.",
            f"Re-sequence urgent loads through alternate ports or later sailings with lower weather exposure than {port_name}.",
            "Pre-alert carriers, brokers, and inland handlers to expect short-notice schedule slippage.",
            "Increase buffer stock for SKUs exposed to the affected port until operating conditions normalize.",
        ]

    if port_kind == "news":
        return [
            f"Increase monitoring cadence for policy, labor, or geopolitical developments affecting {port_name}.",
            f"Prepare alternate routing and carrier allocation in case disruption around {port_name} escalates quickly.",
            "Review customs, sanctions, and documentation exposure for shipments touching the affected port.",
            "Stage contingency inventory for customer orders most exposed to the port-level disruption signals.",
        ]

    return [
        f"Review alternate operating options for shipments exposed to {port_name}.",
        "Increase monitoring frequency and prepare temporary contingency capacity.",
        "Escalate affected bookings for priority handling if disruption intensity rises.",
        "Add short-term inventory buffer for downstream orders exposed to the affected port.",
    ]


def build_actions(
    top_factors: List[str],
    origin_port: str,
    destination_port: str,
    entity_type: str = "route",
    port_kind: str = "general",
) -> List[str]:
    if entity_type == "port":
        return build_port_actions(port_kind, destination_port)[:4]

    actions: List[str] = []

    factor_text = " ".join(top_factors).lower()

    if "high port congestion" in factor_text:
        actions.append(f"Reroute cargo away from the congested lane into an alternate lane near {destination_port}.")
        actions.append("Prioritize berth, gate, or customs fast-track handling for affected shipments.")

    if "elevated disruption news pressure" in factor_text:
        actions.append("Increase monitoring frequency for geopolitical and operational disruption signals.")
        actions.append("Prepare contingency allocation for shipments exposed to disruption headlines.")

    if "above-average historical delay baseline" in factor_text:
        actions.append("Escalate ETA monitoring and buffer planning for lanes with persistent historical delays.")

    if "slow customs clearance baseline" in factor_text:
        actions.append("Engage customs broker escalation and pre-clearance documentation checks.")

    if "low inventory cover versus safety stock" in factor_text:
        actions.append("Increase safety stock for impacted SKUs until risk signals normalize.")

    if not actions:
        actions = [
            f"Review routing options from {origin_port} to {destination_port}.",
            "Increase operational monitoring and prepare a temporary contingency buffer.",
            "Escalate the lane for priority handling if signal strength increases.",
        ]

    return actions[:4]


def build_reason(
    final_risk: float,
    predicted_delay_hours: float,
    top_factors: List[str],
    entity_type: str = "route",
    port_kind: str = "general",
    port_name: str = "",
) -> str:
    if entity_type == "port":
        if port_kind == "congestion":
            return (
                f"Port-level congestion pressure is elevated around {port_name or 'the affected port'}, "
                f"with an estimated disruption delay of {predicted_delay_hours:.1f} hours. "
                f"Key drivers: {', '.join(top_factors[:3]) or 'congestion and emerging signal pressure'}."
            )
        if port_kind == "weather":
            return (
                f"Weather-driven disruption risk is elevated near {port_name or 'the affected port'}, "
                f"with a projected delay of {predicted_delay_hours:.1f} hours. "
                f"Key drivers: {', '.join(top_factors[:3]) or 'weather exposure and downstream delay risk'}."
            )
        if port_kind == "news":
            return (
                f"News and geopolitical disruption pressure is rising around {port_name or 'the affected port'}, "
                f"with a projected delay of {predicted_delay_hours:.1f} hours. "
                f"Key drivers: {', '.join(top_factors[:3]) or 'external disruption signals'}."
            )

    if top_factors:
        return (
            f"ML indicates elevated disruption pressure with a projected delay of "
            f"{predicted_delay_hours:.1f} hours. Key drivers: {', '.join(top_factors[:3])}."
        )

    return (
        f"ML indicates elevated disruption pressure with a projected delay of "
        f"{predicted_delay_hours:.1f} hours and risk score {round(final_risk)}."
    )


def build_title(origin_port: str, destination_port: str) -> str:
    return f"Mitigation plan for {origin_port} → {destination_port}"


def build_port_title(port_kind: str, port_name: str) -> str:
    if port_kind == "congestion":
        return f"Congestion mitigation plan for {port_name}"
    if port_kind == "weather":
        return f"Weather mitigation plan for {port_name}"
    if port_kind == "news":
        return f"Disruption mitigation plan for {port_name}"
    return f"Port mitigation plan for {port_name}"


async def get_alert_with_snapshot(alert_id: str) -> Optional[Dict[str, Any]]:
    db = get_database()

    alert = await db.alerts.find_one({"alert_id": alert_id})
    if not alert:
        return None

    route_key = alert.get("route_key")
    snapshot = await db.risk_snapshots.find_one(
        {"route_key": route_key},
        sort=[("snapshot_time", -1)],
    )

    return {
        "alert": alert,
        "snapshot": snapshot,
    }


async def _related_route_snapshot_for_port_alert(alert: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    db = get_database()
    port_name = alert.get("destination_port") or alert.get("location")
    if not port_name:
        return None

    return await db.risk_snapshots.find_one(
        {
            "entity_type": "route",
            "$or": [
                {"origin_port": port_name},
                {"destination_port": port_name},
            ],
        },
        sort=[("snapshot_time", -1), ("scores.final_risk", -1)],
    )


async def _compute_stock_plan_inputs(
    alert: Dict[str, Any],
    route_key: Optional[str],
    origin_port: str,
    destination_port: str,
) -> Dict[str, Any]:
    db = get_database()
    shipment_query: Dict[str, Any] = {}
    if route_key:
        shipment_query["route_key"] = route_key
    else:
        shipment_query["origin_port"] = origin_port
        shipment_query["destination_port"] = destination_port

    shipments = await db.shipments_raw.find(shipment_query).to_list(length=5000)

    if not shipments:
        return {
            "supplier": alert.get("supplier_name") or "Primary supplier cluster",
            "sku_group": alert.get("product_id") or "Critical route SKUs",
            "current_days_cover": 5.0,
            "recommended_days_cover": 8.0,
            "increase_percent": 60.0,
            "inventory_ratio": 1.0,
        }

    inventory_total = 0.0
    units_sold_total = 0.0
    safety_stock_total = 0.0
    supplier_counts: Dict[str, int] = {}
    sku_counts: Dict[str, int] = {}

    for shipment in shipments:
        inventory_total += safe_float(shipment.get("inventory_level"))
        safety_stock_total += safe_float(shipment.get("safety_stock_level"))
        units_sold_total += safe_float(shipment.get("units_sold_7d"))

        supplier_name = str(shipment.get("supplier_name") or shipment.get("supplier_id") or "Primary supplier cluster")
        sku_group = str(
            shipment.get("sku_group")
            or shipment.get("product_category")
            or shipment.get("product_id")
            or "Critical route SKUs"
        )
        supplier_counts[supplier_name] = supplier_counts.get(supplier_name, 0) + 1
        sku_counts[sku_group] = sku_counts.get(sku_group, 0) + 1

    dominant_supplier = max(supplier_counts.items(), key=lambda item: item[1])[0]
    dominant_sku_group = max(sku_counts.items(), key=lambda item: item[1])[0]
    daily_units = max(units_sold_total / 7.0, 1.0)
    current_days_cover = inventory_total / daily_units
    inventory_ratio = inventory_total / max(safety_stock_total, 1.0)

    recommended_days_cover = max(
        current_days_cover + 2.0,
        min(18.0, current_days_cover + max(2.0, (1.1 - min(inventory_ratio, 1.1)) * 8.0)),
    )
    increase_percent = max(
        10.0,
        ((recommended_days_cover - current_days_cover) / max(current_days_cover, 1.0)) * 100.0,
    )

    return {
        "supplier": alert.get("supplier_name") or dominant_supplier,
        "sku_group": alert.get("product_id") or dominant_sku_group,
        "current_days_cover": round(current_days_cover, 1),
        "recommended_days_cover": round(recommended_days_cover, 1),
        "increase_percent": round(min(200.0, increase_percent), 1),
        "inventory_ratio": round(inventory_ratio, 3),
    }


def _reroute_actions(destination_port: str) -> List[str]:
    return [
        f"Review alternate routing options serving {destination_port} and move urgent volume first.",
        "Escalate carrier coordination to secure lower-pressure sailing and handling capacity.",
        "Protect the highest-priority loads with temporary reroute and handling overrides.",
    ]


def _build_static_alternate_route(
    origin_port: str,
    destination_port: str,
    alert: Dict[str, Any],
    entity_type: str,
) -> str:
    if entity_type == "port":
        risky_port = str(
            alert.get("destination_port")
            or alert.get("location")
            or ""
        ).strip().lower()
        normalized_origin = str(origin_port or "").strip().lower()
        normalized_destination = str(destination_port or "").strip().lower()

        if risky_port and risky_port == normalized_destination:
            return f"{origin_port} → Alternate Port"
        if risky_port and risky_port == normalized_origin:
            return f"Alternate Port → {destination_port}"

    return f"Alternate Port → {destination_port}"


def _port_alert_prediction(alert: Dict[str, Any], snapshot: Dict[str, Any]) -> Dict[str, Any]:
    scores = snapshot.get("scores") or {}
    top_drivers = list(snapshot.get("top_drivers") or alert.get("top_drivers") or [])
    final_risk = float(scores.get("final_risk", alert.get("risk_score", 0)) or 0)
    congestion_score = float(scores.get("congestion", alert.get("congestion_score", 0)) or 0)
    emerging_score = float(scores.get("emerging", alert.get("emerging_score", 0)) or 0)

    disruption_probability = min(
        0.92,
        (
            final_risk * 0.45
            + congestion_score * 0.35
            + emerging_score * 0.20
        )
        / 100.0,
    )

    predicted_delay_hours = round(
        max(
            4.0,
            congestion_score * 0.18 + emerging_score * 0.10 + final_risk * 0.08,
        ),
        2,
    )

    if not top_drivers:
        top_drivers = ["high port congestion", "elevated emerging signal pressure"]

    return {
        "ml_risk_score": clamp_score(disruption_probability * 100),
        "disruption_probability": round(disruption_probability, 4),
        "predicted_delay_hours": predicted_delay_hours,
        "top_factors": top_drivers[:3],
    }


async def build_ml_mitigation_plan(alert_id: str) -> Optional[Dict[str, Any]]:
    db = get_database()

    payload = await get_alert_with_snapshot(alert_id)

    if payload:
        alert = payload["alert"]
        snapshot = payload.get("snapshot") or {}
    else:
        snapshot = await db.risk_snapshots.find_one(
            {"route_key": alert_id},
            sort=[("snapshot_time", -1)],
        )
        if not snapshot:
            return None

        alert = {
            "alert_id": alert_id,
            "route_key": snapshot.get("route_key"),
            "origin_port": snapshot.get("origin_port"),
            "destination_port": snapshot.get("destination_port"),
            "risk_score": (snapshot.get("scores") or {}).get("final_risk", 0),
            "supplier_name": None,
            "product_id": None,
        }

    entity_type = str(alert.get("entity_type") or ("route" if alert.get("route_key") else "port"))
    scores = snapshot.get("scores") or {}
    ml_prediction = snapshot.get("ml_prediction") or {}

    if entity_type == "port":
        port_name = alert.get("destination_port") or alert.get("location") or "Unknown Port"
        port_kind = classify_port_alert_kind(alert, list(alert.get("top_drivers") or []))
        related_snapshot = await _related_route_snapshot_for_port_alert(alert)
        if related_snapshot:
            snapshot = related_snapshot
            scores = snapshot.get("scores") or {}
        origin_port = (
            (snapshot or {}).get("origin_port")
            or alert.get("related_origin_port")
            or port_name
        )
        destination_port = (
            (snapshot or {}).get("destination_port")
            or alert.get("related_destination_port")
            or port_name
        )
        route_key = (snapshot or {}).get("route_key")
    else:
        port_kind = "general"
        origin_port = alert.get("origin_port") or "Unknown Origin"
        destination_port = alert.get("destination_port") or "Unknown Destination"
        route_key = alert.get("route_key")

    weather_score = int(scores.get("weather", 0) or 0)
    news_score = int(scores.get("news", 0) or 0)
    congestion_score = int(scores.get("congestion", 0) or 0)
    final_risk = float(scores.get("final_risk", alert.get("risk_score", 0)) or 0)

    if not ml_prediction:
        if entity_type == "port":
            ml_prediction = _port_alert_prediction(alert, snapshot)
        else:
            ml_prediction = await predict_route_disruption(
                route_key=route_key,
                origin_port=origin_port,
                destination_port=destination_port,
                weather_score=weather_score,
                news_score=news_score,
                congestion_score=congestion_score,
            )

    ml_risk_score = float(ml_prediction.get("ml_risk_score", 0) or 0)
    disruption_probability = float(ml_prediction.get("disruption_probability", 0) or 0)
    predicted_delay_hours = float(ml_prediction.get("predicted_delay_hours", 0) or 0)
    top_factors = list(ml_prediction.get("top_factors") or [])
    if entity_type == "port":
        port_kind = classify_port_alert_kind(alert, top_factors)

    priority = classify_priority(final_risk, ml_risk_score)
    confidence = clamp_percent(55 + disruption_probability * 40)

    baseline_recovery = baseline_recovery_days(predicted_delay_hours, final_risk)
    stock_plan_inputs = await _compute_stock_plan_inputs(
        alert=alert,
        route_key=route_key,
        origin_port=origin_port,
        destination_port=destination_port,
    )

    reroute = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="reroute",
        top_factors=top_factors,
        entity_type=entity_type,
        port_kind=port_kind,
        ml_risk_score=ml_risk_score,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        inventory_ratio=safe_float(stock_plan_inputs.get("inventory_ratio"), 1.0),
    )
    safety_stock = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="safety_stock",
        top_factors=top_factors,
        entity_type=entity_type,
        port_kind=port_kind,
        ml_risk_score=ml_risk_score,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        inventory_ratio=safe_float(stock_plan_inputs.get("inventory_ratio"), 1.0),
    )
    priority_handling = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="priority_handling",
        top_factors=top_factors,
        entity_type=entity_type,
        port_kind=port_kind,
        ml_risk_score=ml_risk_score,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        inventory_ratio=safe_float(stock_plan_inputs.get("inventory_ratio"), 1.0),
    )

    inventory_ratio = safe_float(stock_plan_inputs.get("inventory_ratio"), 1.0)
    if inventory_ratio < 1.0:
        safety_stock["risk_score"] = clamp_score(safety_stock["risk_score"] * 0.90)
        safety_stock["recovery_days"] = round(max(0.8, safety_stock["recovery_days"] * 0.9), 1)
    else:
        safety_stock["cost_impact"] = clamp_percent(safety_stock["cost_impact"] + 8)

    scenarios = [
        {
            "id": "reroute",
            "label": "Reroute via alternate port",
            **reroute,
        },
        {
            "id": "safety_stock",
            "label": "Increase safety stock around exposed SKUs",
            **safety_stock,
        },
        {
            "id": "priority_handling",
            "label": "Priority carrier handling",
            **priority_handling,
        },
    ]

    best = min(
        scenarios,
        key=lambda s: s["risk_score"] + s["delay_hours"] + s["recovery_days"] * 10 + s["cost_impact"],
    )

    impact_reduction = clamp_percent(max(0, final_risk - best["risk_score"]))

    return {
        "id": f"mitigation::{alert.get('alert_id', route_key)}",
        "alert_id": alert.get("alert_id", route_key),
        "title": build_port_title(port_kind, destination_port) if entity_type == "port" else build_title(origin_port, destination_port),
        "priority": priority,
        "confidence": confidence,
        "impact_reduction": impact_reduction,
        "reason": build_reason(
            final_risk,
            predicted_delay_hours,
            top_factors,
            entity_type=entity_type,
            port_kind=port_kind,
            port_name=destination_port,
        ),
        "actions": (
            build_actions(
                top_factors,
                origin_port,
                destination_port,
                entity_type=entity_type,
                port_kind=port_kind,
            )
            if entity_type == "port"
            else (
                _reroute_actions(destination_port)
                + build_actions(
                    top_factors,
                    origin_port,
                    destination_port,
                    entity_type=entity_type,
                    port_kind=port_kind,
                )
            )[:4]
        ),
        "reroute_plan": {
            "from": f"{origin_port} → {destination_port}",
            "to": _build_static_alternate_route(
                origin_port=origin_port,
                destination_port=destination_port,
                alert=alert,
                entity_type=entity_type,
            ),
            "eta_savings_hours": round(max(0.0, predicted_delay_hours - reroute["delay_hours"]), 1),
        },
        "stock_plan": {
            "supplier": str(stock_plan_inputs.get("supplier") or "Primary supplier cluster"),
            "sku_group": str(stock_plan_inputs.get("sku_group") or "Critical route SKUs"),
            "current_days_cover": safe_float(stock_plan_inputs.get("current_days_cover"), 5.0),
            "recommended_days_cover": safe_float(stock_plan_inputs.get("recommended_days_cover"), 8.0),
            "increase_percent": safe_float(stock_plan_inputs.get("increase_percent"), 60.0),
        },
        "scenarios": scenarios,
    }
