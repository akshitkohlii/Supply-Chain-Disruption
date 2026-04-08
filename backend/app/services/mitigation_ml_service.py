from typing import Any, Dict, List, Optional

from app.core.database import get_database
from app.services.ml_service import predict_route_disruption


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
) -> Dict[str, Any]:
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


def build_actions(top_factors: List[str], origin_port: str, destination_port: str) -> List[str]:
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
) -> str:
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

    scores = snapshot.get("scores") or {}
    ml_prediction = snapshot.get("ml_prediction") or {}

    origin_port = alert.get("origin_port") or "Unknown Origin"
    destination_port = alert.get("destination_port") or "Unknown Destination"
    route_key = alert.get("route_key")

    weather_score = int(scores.get("weather", 0) or 0)
    news_score = int(scores.get("news", 0) or 0)
    congestion_score = int(scores.get("congestion", 0) or 0)
    final_risk = float(scores.get("final_risk", alert.get("risk_score", 0)) or 0)

    if not ml_prediction:
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

    priority = classify_priority(final_risk, ml_risk_score)
    confidence = clamp_percent(55 + disruption_probability * 40)

    baseline_recovery = baseline_recovery_days(predicted_delay_hours, final_risk)

    reroute = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="reroute",
        top_factors=top_factors,
    )
    safety_stock = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="safety_stock",
        top_factors=top_factors,
    )
    priority_handling = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="priority_handling",
        top_factors=top_factors,
    )

    scenarios = [
        {
            "id": "reroute",
            "label": "Reroute via alternate lane",
            **reroute,
        },
        {
            "id": "safety_stock",
            "label": "Increase safety stock",
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
        "title": build_title(origin_port, destination_port),
        "priority": priority,
        "confidence": confidence,
        "impact_reduction": impact_reduction,
        "reason": build_reason(final_risk, predicted_delay_hours, top_factors),
        "actions": build_actions(top_factors, origin_port, destination_port),
        "reroute_plan": {
            "from": f"{origin_port} → {destination_port}",
            "to": f"{origin_port} → Alternate Lane → {destination_port}",
            "eta_savings_hours": round(max(0.0, predicted_delay_hours - reroute['delay_hours']), 1),
        },
        "stock_plan": {
            "supplier": alert.get("supplier_name") or "Primary supplier cluster",
            "sku_group": alert.get("product_id") or "Critical route SKUs",
            "current_days_cover": 5,
            "recommended_days_cover": 9,
            "increase_percent": 80,
        },
        "scenarios": scenarios,
    }
    payload = await get_alert_with_snapshot(alert_id)
    if not payload:
        return None

    alert = payload["alert"]
    snapshot = payload.get("snapshot") or {}

    scores = snapshot.get("scores") or {}
    ml_prediction = snapshot.get("ml_prediction") or {}

    origin_port = alert.get("origin_port") or "Unknown Origin"
    destination_port = alert.get("destination_port") or "Unknown Destination"
    route_key = alert.get("route_key")

    weather_score = int(scores.get("weather", 0) or 0)
    news_score = int(scores.get("news", 0) or 0)
    congestion_score = int(scores.get("congestion", 0) or 0)
    final_risk = float(scores.get("final_risk", alert.get("risk_score", 0)) or 0)

    if not ml_prediction:
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

    priority = classify_priority(final_risk, ml_risk_score)
    confidence = clamp_percent(55 + disruption_probability * 40)

    baseline_recovery = baseline_recovery_days(predicted_delay_hours, final_risk)

    reroute = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="reroute",
        top_factors=top_factors,
    )
    safety_stock = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="safety_stock",
        top_factors=top_factors,
    )
    priority_handling = score_scenario(
        baseline_risk=final_risk,
        baseline_delay=predicted_delay_hours,
        baseline_recovery_days_value=baseline_recovery,
        scenario_type="priority_handling",
        top_factors=top_factors,
    )

    scenarios = [
        {
            "id": "reroute",
            "label": "Reroute via alternate lane",
            **reroute,
        },
        {
            "id": "safety_stock",
            "label": "Increase safety stock",
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
        "id": f"mitigation::{alert_id}",
        "alert_id": alert_id,
        "title": build_title(origin_port, destination_port),
        "priority": priority,
        "confidence": confidence,
        "impact_reduction": impact_reduction,
        "reason": build_reason(final_risk, predicted_delay_hours, top_factors),
        "actions": build_actions(top_factors, origin_port, destination_port),
        "reroute_plan": {
            "from": f"{origin_port} → {destination_port}",
            "to": f"{origin_port} → Alternate Lane → {destination_port}",
            "eta_savings_hours": round(max(0.0, predicted_delay_hours - reroute["delay_hours"]), 1),
        },
        "stock_plan": {
            "supplier": alert.get("supplier_name") or "Primary supplier cluster",
            "sku_group": alert.get("product_id") or "Critical route SKUs",
            "current_days_cover": 5,
            "recommended_days_cover": 9,
            "increase_percent": 80,
        },
        "scenarios": scenarios,
    }