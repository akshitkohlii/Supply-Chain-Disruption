from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from app.core.database import get_database


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _latest_route_snapshots_by_key(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    latest: Dict[str, Dict[str, Any]] = {}

    for doc in docs:
        route_key = doc.get("route_key") or doc.get("entity_id")
        if not route_key:
            continue
        if route_key not in latest:
            latest[route_key] = doc

    return list(latest.values())


async def get_analytics_overview() -> Dict[str, float]:
    db = get_database()

    snapshot_docs = await db.risk_snapshots.find(
        {"entity_type": "route"}
    ).sort("snapshot_time", -1).to_list(length=5000)

    latest_snapshots = _latest_route_snapshots_by_key(snapshot_docs)

    if latest_snapshots:
        avg_forecast_risk = round(
            sum(_safe_float((doc.get("scores") or {}).get("final_risk")) for doc in latest_snapshots)
            / len(latest_snapshots),
            2,
        )
        forecast_drift = round(
            sum(_safe_float((doc.get("scores") or {}).get("news")) for doc in latest_snapshots)
            / len(latest_snapshots),
            2,
        )
        critical_alerts = sum(
            1 for doc in latest_snapshots if _safe_float((doc.get("scores") or {}).get("final_risk")) >= 65
        )
    else:
        avg_forecast_risk = 0.0
        forecast_drift = 0.0
        critical_alerts = 0

    supplier_pipeline = [
        {
            "$group": {
                "_id": "$supplier_id",
                "avg_supplier_risk": {"$avg": {"$ifNull": ["$weather_risk", 0]}},
            }
        }
    ]
    supplier_rows = await db.shipments_raw.aggregate(supplier_pipeline).to_list(length=5000)
    avg_supplier_risk = round(
        (
            sum(_safe_float(row.get("avg_supplier_risk")) for row in supplier_rows) / len(supplier_rows) * 100
        )
        if supplier_rows
        else 0.0,
        2,
    )

    delay_pipeline = [
        {
            "$group": {
                "_id": None,
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
            }
        }
    ]
    delay_rows = await db.shipments_raw.aggregate(delay_pipeline).to_list(length=1)
    avg_delay_hours = round(_safe_float(delay_rows[0].get("avg_delay_hours")) if delay_rows else 0.0, 2)

    return {
        "avg_forecast_risk": avg_forecast_risk,
        "forecast_drift": forecast_drift,
        "avg_supplier_risk": avg_supplier_risk,
        "critical_alerts": critical_alerts,
        "avg_delay_hours": avg_delay_hours,
    }


async def get_analytics_forecast() -> List[Dict[str, Any]]:
    db = get_database()

    docs = await db.shipments_raw.find(
        {},
        {
            "date": 1,
            "weather_risk": 1,
            "news_sentiment": 1,
            "delay_hours": 1,
            "port_congestion": 1,
        },
    ).sort("date", 1).to_list(length=50000)

    by_day: Dict[str, Dict[str, float]] = defaultdict(lambda: {
        "count": 0,
        "delay": 0.0,
        "weather": 0.0,
        "news": 0.0,
        "congestion": 0.0,
    })

    for doc in docs:
        raw_date = str(doc.get("date") or "")[:10]
        if not raw_date:
            continue

        by_day[raw_date]["count"] += 1
        by_day[raw_date]["delay"] += _safe_float(doc.get("delay_hours"))
        by_day[raw_date]["weather"] += _safe_float(doc.get("weather_risk")) * 100
        by_day[raw_date]["news"] += abs(_safe_float(doc.get("news_sentiment"))) * 100
        by_day[raw_date]["congestion"] += _safe_float(doc.get("port_congestion")) * 100

    sorted_days = sorted(by_day.keys())
    if not sorted_days:
        return []

    condensed = sorted_days[-7:]
    points: List[Dict[str, Any]] = []

    prev_current: Optional[float] = None
    for day in condensed:
        agg = by_day[day]
        count = max(int(agg["count"]), 1)

        current = round(
            (
                (agg["delay"] / count) * 1.2
                + (agg["weather"] / count) * 0.25
                + (agg["news"] / count) * 0.20
                + (agg["congestion"] / count) * 0.20
            ),
            2,
        )
        forecast = round(current * 1.08, 2)
        drift = round((forecast - current) if prev_current is None else (current - prev_current), 2)

        points.append(
            {
                "day": day,
                "current": current,
                "forecast": forecast,
                "drift": drift,
            }
        )
        prev_current = current

    return points


async def get_supplier_exposure() -> List[Dict[str, Any]]:
    db = get_database()

    pipeline = [
        {
            "$group": {
                "_id": "$supplier_id",
                "supplier_name": {"$first": "$supplier_name"},
                "avg_weather_risk": {"$avg": {"$ifNull": ["$weather_risk", 0]}},
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                "avg_demand_volatility": {"$avg": {"$ifNull": ["$demand_volatility", 0]}},
            }
        },
        {"$sort": {"avg_weather_risk": -1, "avg_delay_hours": -1}},
        {"$limit": 12},
    ]

    rows = await db.shipments_raw.aggregate(pipeline).to_list(length=12)

    results: List[Dict[str, Any]] = []
    for row in rows:
        risk_score = round(_safe_float(row.get("avg_weather_risk")) * 100, 2)
        dependency_score = round(
            min(
                100.0,
                (_safe_float(row.get("avg_delay_hours")) * 2.5)
                + (_safe_float(row.get("avg_demand_volatility")) * 50),
            ),
            2,
        )
        combined_score = round((risk_score * 0.6) + (dependency_score * 0.4), 2)

        results.append(
            {
                "supplier_id": str(row.get("_id")),
                "supplier_name": row.get("supplier_name") or str(row.get("_id")),
                "risk_score": risk_score,
                "dependency_score": dependency_score,
                "combined_score": combined_score,
            }
        )

    return results


async def get_lane_pressure() -> List[Dict[str, Any]]:
    db = get_database()

    rows = await db.routes_master.find(
        {"active": {"$ne": False}},
        {
            "route_key": 1,
            "avg_delay_hours": 1,
            "avg_port_congestion": 1,
            "shipment_count": 1,
        },
    ).sort("avg_delay_hours", -1).to_list(length=20)

    results: List[Dict[str, Any]] = []
    for row in rows:
        avg_delay_hours = round(_safe_float(row.get("avg_delay_hours")), 2)
        congestion = _safe_float(row.get("avg_port_congestion"))
        throughput_pct = round(max(0.0, 100.0 - (congestion * 60.0)), 2)
        pressure_score = round(min(100.0, (avg_delay_hours * 1.8) + (congestion * 45.0)), 2)

        results.append(
            {
                "lane": row.get("route_key") or "Unknown Lane",
                "avg_delay_hours": avg_delay_hours,
                "throughput_pct": throughput_pct,
                "pressure_score": pressure_score,
                "shipment_count": int(row.get("shipment_count") or 0),
            }
        )

    return results[:10]