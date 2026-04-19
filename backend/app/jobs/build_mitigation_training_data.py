import asyncio
from pathlib import Path
from random import Random
from typing import Any, Dict, List

import pandas as pd

from app.core.database import get_database

BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_PATH = BASE_DIR / "data" / "processed" / "mitigation_training_data.csv"
TARGET_ROWS = 20000
RNG = Random(42)


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


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def baseline_recovery_days(predicted_delay_hours: float, final_risk: float) -> float:
    return round(max(1.0, predicted_delay_hours / 24.0 + final_risk / 120.0), 1)


def heuristic_outcome(
    baseline_risk: float,
    baseline_delay: float,
    baseline_recovery: float,
    scenario_type: str,
    top_factors: List[str],
) -> Dict[str, float]:
    risk = baseline_risk
    delay = baseline_delay
    recovery = baseline_recovery
    cost = baseline_delay * 1.2 + baseline_risk * 0.35
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
        "target_risk_score": clamp_score(risk),
        "target_delay_hours": round(max(1.0, delay), 2),
        "target_recovery_days": round(max(0.8, recovery), 2),
        "target_cost_impact": round(clamp(cost, 5, 100), 2),
    }


def normalize_top_factors(top_factors: Any) -> List[str]:
    if isinstance(top_factors, list):
        return [str(item).strip().lower() for item in top_factors if str(item).strip()]
    return []


def build_feature_row(
    *,
    scenario_type: str,
    entity_type: str,
    port_kind: str,
    baseline_risk: float,
    baseline_delay: float,
    baseline_recovery: float,
    ml_risk_score: float,
    weather_score: float,
    news_score: float,
    congestion_score: float,
    inventory_ratio: float,
    top_factors: List[str],
) -> Dict[str, Any]:
    factor_text = " ".join(top_factors)
    row = {
        "scenario_type": scenario_type,
        "entity_type": entity_type,
        "port_kind": port_kind if entity_type == "port" else "route",
        "baseline_risk": round(baseline_risk, 2),
        "baseline_delay": round(baseline_delay, 2),
        "baseline_recovery_days": round(baseline_recovery, 2),
        "ml_risk_score": round(ml_risk_score, 2),
        "weather_score": round(weather_score, 2),
        "news_score": round(news_score, 2),
        "congestion_score": round(congestion_score, 2),
        "inventory_ratio": round(inventory_ratio, 3),
        "has_congestion_factor": int("high port congestion" in factor_text),
        "has_news_factor": int("elevated disruption news pressure" in factor_text),
        "has_customs_factor": int("slow customs clearance baseline" in factor_text),
        "has_inventory_factor": int("low inventory cover versus safety stock" in factor_text),
        "has_delay_factor": int("above-average historical delay baseline" in factor_text),
    }
    row.update(
        heuristic_outcome(
            baseline_risk=baseline_risk,
            baseline_delay=baseline_delay,
            baseline_recovery=baseline_recovery,
            scenario_type=scenario_type,
            top_factors=top_factors,
        )
    )
    return row


def classify_port_kind(alert: Dict[str, Any]) -> str:
    category = str(alert.get("category") or "").lower()
    title = str(alert.get("title") or "").lower()
    summary = str(alert.get("summary") or "").lower()

    if category == "climate" or "weather" in title or "weather" in summary:
        return "weather"
    if category == "geo" or "news" in title or "geopolitical" in title:
        return "news"
    if category == "port" or "congestion" in title or "congestion" in summary:
        return "congestion"
    return "general"


def jitter_row(row: Dict[str, Any]) -> Dict[str, Any]:
    jittered = dict(row)
    for key, spread in [
        ("baseline_risk", 4.5),
        ("baseline_delay", 2.2),
        ("baseline_recovery_days", 0.8),
        ("ml_risk_score", 5.0),
        ("weather_score", 6.0),
        ("news_score", 5.0),
        ("congestion_score", 6.0),
        ("inventory_ratio", 0.08),
        ("target_risk_score", 3.5),
        ("target_delay_hours", 1.1),
        ("target_recovery_days", 0.45),
        ("target_cost_impact", 4.0),
    ]:
        jittered[key] = round(
            clamp(safe_float(jittered[key]) + RNG.uniform(-spread, spread), 0.0, 100.0),
            3 if key == "inventory_ratio" else 2,
        )

    if safe_float(jittered["inventory_ratio"]) <= 0:
        jittered["inventory_ratio"] = 0.1

    return jittered


async def build_inventory_ratio_by_route() -> Dict[str, float]:
    db = get_database()
    rows = await db.shipments_raw.aggregate(
        [
            {
                "$group": {
                    "_id": "$route_key",
                    "avg_inventory_level": {"$avg": {"$ifNull": ["$inventory_level", 0]}},
                    "avg_safety_stock_level": {"$avg": {"$ifNull": ["$safety_stock_level", 1]}},
                }
            }
        ]
    ).to_list(length=5000)

    output: Dict[str, float] = {}
    for row in rows:
        route_key = row.get("_id")
        if not route_key:
            continue
        avg_inventory = safe_float(row.get("avg_inventory_level"))
        avg_safety = max(safe_float(row.get("avg_safety_stock_level"), 1.0), 1.0)
        output[str(route_key)] = round(avg_inventory / avg_safety, 3)
    return output


async def main():
    db = get_database()
    inventory_ratio_by_route = await build_inventory_ratio_by_route()

    route_snapshots = (
        await db.risk_snapshots.find({"entity_type": "route"})
        .sort("snapshot_time", -1)
        .to_list(length=5000)
    )
    latest_by_route: Dict[str, Dict[str, Any]] = {}
    for doc in route_snapshots:
        route_key = doc.get("route_key") or doc.get("entity_id")
        if route_key and route_key not in latest_by_route:
            latest_by_route[str(route_key)] = doc

    active_port_alerts = (
        await db.alerts.find({"entity_type": "port", "status": "active"})
        .sort("timestamp", -1)
        .to_list(length=2000)
    )

    rows: List[Dict[str, Any]] = []
    scenario_types = ["reroute", "safety_stock", "priority_handling"]

    for route_key, snapshot in latest_by_route.items():
        scores = snapshot.get("scores") or {}
        ml_prediction = snapshot.get("ml_prediction") or {}
        top_factors = normalize_top_factors(
            ml_prediction.get("top_factors") or snapshot.get("top_drivers") or []
        )
        if not top_factors:
            top_factors = [
                "above-average historical delay baseline",
                "slow customs clearance baseline",
            ]

        baseline_risk = safe_float(scores.get("final_risk"))
        baseline_delay = safe_float(
            ml_prediction.get("predicted_delay_hours"),
            safe_float(snapshot.get("avg_delay_hours"), 6.0),
        )
        baseline_recovery = baseline_recovery_days(baseline_delay, baseline_risk)
        ml_risk_score = safe_float(scores.get("ml"), ml_prediction.get("ml_risk_score"))
        weather_score = safe_float(scores.get("weather"))
        news_score = safe_float(scores.get("news"))
        congestion_score = safe_float(scores.get("congestion"))
        inventory_ratio = safe_float(inventory_ratio_by_route.get(route_key), 1.0)

        for scenario_type in scenario_types:
            rows.append(
                build_feature_row(
                    scenario_type=scenario_type,
                    entity_type="route",
                    port_kind="route",
                    baseline_risk=baseline_risk,
                    baseline_delay=baseline_delay,
                    baseline_recovery=baseline_recovery,
                    ml_risk_score=ml_risk_score,
                    weather_score=weather_score,
                    news_score=news_score,
                    congestion_score=congestion_score,
                    inventory_ratio=inventory_ratio,
                    top_factors=top_factors,
                )
            )

    for alert in active_port_alerts:
        scores = alert.get("scores") or {}
        ml_prediction = alert.get("ml_prediction") or {}
        top_factors = normalize_top_factors(
            ml_prediction.get("top_factors") or alert.get("top_drivers") or []
        )
        if not top_factors:
            top_factors = ["high port congestion", "elevated disruption news pressure"]

        port_kind = classify_port_kind(alert)
        baseline_risk = safe_float(scores.get("final_risk"), alert.get("risk_score"))
        baseline_delay = safe_float(ml_prediction.get("predicted_delay_hours"), 8.0)
        baseline_recovery = baseline_recovery_days(baseline_delay, baseline_risk)
        ml_risk_score = safe_float(scores.get("ml"), ml_prediction.get("ml_risk_score"))
        weather_score = safe_float(scores.get("weather"))
        news_score = safe_float(scores.get("news"))
        congestion_score = safe_float(scores.get("congestion"))
        inventory_ratio = 1.0

        for scenario_type in scenario_types:
            rows.append(
                build_feature_row(
                    scenario_type=scenario_type,
                    entity_type="port",
                    port_kind=port_kind,
                    baseline_risk=baseline_risk,
                    baseline_delay=baseline_delay,
                    baseline_recovery=baseline_recovery,
                    ml_risk_score=ml_risk_score,
                    weather_score=weather_score,
                    news_score=news_score,
                    congestion_score=congestion_score,
                    inventory_ratio=inventory_ratio,
                    top_factors=top_factors,
                )
            )

    if not rows:
        raise RuntimeError("No route snapshots or active port alerts available to build mitigation training data.")

    while len(rows) < TARGET_ROWS:
        rows.append(jitter_row(rows[len(rows) % len(rows)]))

    df = pd.DataFrame(rows[:TARGET_ROWS])
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(
        {
            "success": True,
            "rows_written": len(df),
            "route_snapshot_rows": len(latest_by_route) * len(scenario_types),
            "port_alert_rows": len(active_port_alerts) * len(scenario_types),
            "output_path": str(OUTPUT_PATH),
        }
    )


if __name__ == "__main__":
    asyncio.run(main())
