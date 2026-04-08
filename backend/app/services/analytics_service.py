from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List

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
            sum(
                _safe_float((doc.get("scores") or {}).get("final_risk"))
                for doc in latest_snapshots
            )
            / len(latest_snapshots),
            2,
        )
        forecast_drift = round(
            sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in latest_snapshots)
            / len(latest_snapshots),
            2,
        )
        critical_alerts = sum(
            1
            for doc in latest_snapshots
            if _safe_float((doc.get("scores") or {}).get("final_risk")) >= 60
        )
    else:
        avg_forecast_risk = 0.0
        forecast_drift = 0.0
        critical_alerts = 0

    supplier_rows = await db.shipments_raw.aggregate(
        [
            {
                "$group": {
                    "_id": "$supplier_id",
                    "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                    "avg_customs_clearance_hours": {
                        "$avg": {"$ifNull": ["$customs_clearance_hours", 0]}
                    },
                    "avg_demand_volatility": {
                        "$avg": {"$ifNull": ["$demand_volatility", 0]}
                    },
                }
            }
        ]
    ).to_list(length=5000)

    avg_supplier_risk = round(
        (
            sum(
                min(
                    100.0,
                    _safe_float(r.get("avg_delay_hours")) * 1.8
                    + _safe_float(r.get("avg_customs_clearance_hours")) * 0.9
                    + _safe_float(r.get("avg_demand_volatility")) * 35,
                )
                for r in supplier_rows
            )
            / len(supplier_rows)
        )
        if supplier_rows
        else 0.0,
        2,
    )

    delay_rows = await db.shipments_raw.aggregate(
        [{"$group": {"_id": None, "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}}}}]
    ).to_list(length=1)

    avg_delay_hours = round(
        _safe_float(delay_rows[0].get("avg_delay_hours")) if delay_rows else 0.0,
        2,
    )

    return {
        "avg_forecast_risk": avg_forecast_risk,
        "forecast_drift": forecast_drift,
        "avg_supplier_risk": avg_supplier_risk,
        "critical_alerts": critical_alerts,
        "avg_delay_hours": avg_delay_hours,
    }


async def get_analytics_forecast() -> List[Dict[str, Any]]:
    db = get_database()

    snapshot_docs = await db.risk_snapshots.find(
        {"entity_type": "route"}
    ).sort("snapshot_time", -1).to_list(length=5000)

    if not snapshot_docs:
        return []

    latest_snapshots = _latest_route_snapshots_by_key(snapshot_docs)

    avg_current = round(
        sum(
            _safe_float((doc.get("scores") or {}).get("final_risk"))
            for doc in latest_snapshots
        )
        / len(latest_snapshots),
        2,
    )

    avg_news = round(
        sum(_safe_float((doc.get("scores") or {}).get("news")) for doc in latest_snapshots)
        / len(latest_snapshots),
        2,
    )

    avg_congestion = round(
        sum(_safe_float((doc.get("scores") or {}).get("congestion")) for doc in latest_snapshots)
        / len(latest_snapshots),
        2,
    )

    avg_ml = round(
        sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in latest_snapshots)
        / len(latest_snapshots),
        2,
    )

    today = datetime.utcnow().date()
    forecast_points: List[Dict[str, Any]] = []

    for i in range(7):
        day = today + timedelta(days=i)

        current_value = min(
            100.0,
            max(
                0.0,
                avg_current
                + (i * 0.6)
                + (avg_news * 0.01)
                + (avg_congestion * 0.015)
                - (avg_ml * 0.005),
            ),
        )

        forecast_value = min(
            100.0,
            max(
                0.0,
                current_value
                + (avg_news * 0.03)
                + (avg_congestion * 0.035)
                + (avg_ml * 0.04)
                + (i * 0.8),
            ),
        )

        drift = round(forecast_value - current_value, 2)

        forecast_points.append(
            {
                "day": day.strftime("%a").upper(),
                "current": round(current_value, 2),
                "forecast": round(forecast_value, 2),
                "drift": drift,
            }
        )

    return forecast_points
    db = get_database()

    snapshot_docs = await db.risk_snapshots.find(
        {"entity_type": "route"}
    ).sort("snapshot_time", -1).to_list(length=5000)

    if not snapshot_docs:
        return []

    latest_snapshots = _latest_route_snapshots_by_key(snapshot_docs)

    avg_current = round(
        sum(
            _safe_float((doc.get("scores") or {}).get("final_risk"))
            for doc in latest_snapshots
        )
        / len(latest_snapshots),
        2,
    )

    avg_news = round(
        sum(_safe_float((doc.get("scores") or {}).get("news")) for doc in latest_snapshots)
        / len(latest_snapshots),
        2,
    )

    avg_congestion = round(
        sum(_safe_float((doc.get("scores") or {}).get("congestion")) for doc in latest_snapshots)
        / len(latest_snapshots),
        2,
    )

    avg_ml = round(
        sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in latest_snapshots)
        / len(latest_snapshots),
        2,
    )

    today = datetime.utcnow().date()
    forecast_points: List[Dict[str, Any]] = []
    previous_forecast = avg_current

    for i in range(7):
        day = today + timedelta(days=i)

        forecast = min(
            100.0,
            max(
                0.0,
                avg_current
                + (avg_news * 0.04)
                + (avg_congestion * 0.05)
                + (avg_ml * 0.06)
                + (i * 1.5),
            ),
        )

        drift = round(forecast - previous_forecast if i > 0 else forecast - avg_current, 2)

        forecast_points.append(
            {
                "day": day.strftime("%a").upper(),
                "current": round(avg_current, 2),
                "forecast": round(forecast, 2),
                "drift": drift,
            }
        )

        previous_forecast = forecast

    return forecast_points


async def get_supplier_exposure() -> List[Dict[str, Any]]:
    db = get_database()

    pipeline = [
        {
            "$group": {
                "_id": "$supplier_id",
                "supplier_name": {"$first": "$supplier_name"},
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                "avg_customs_clearance_hours": {
                    "$avg": {"$ifNull": ["$customs_clearance_hours", 0]}
                },
                "avg_demand_volatility": {
                    "$avg": {"$ifNull": ["$demand_volatility", 0]}
                },
                "shipment_count": {"$sum": 1},
            }
        },
        {"$sort": {"avg_delay_hours": -1}},
        {"$limit": 12},
    ]

    rows = await db.shipments_raw.aggregate(pipeline).to_list(length=12)

    results: List[Dict[str, Any]] = []
    for row in rows:
        risk_score = round(
            min(
                100.0,
                _safe_float(row.get("avg_delay_hours")) * 1.8
                + _safe_float(row.get("avg_customs_clearance_hours")) * 0.9
                + _safe_float(row.get("avg_demand_volatility")) * 35,
            ),
            2,
        )

        dependency_score = round(
            min(
                100.0,
                (_safe_float(row.get("shipment_count")) / 300.0) * 70
                + (_safe_float(row.get("avg_customs_clearance_hours")) / 48.0) * 30,
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

    alert_docs = await db.alerts.find(
        {"status": {"$ne": "resolved"}},
        {
            "route_key": 1,
            "origin_port": 1,
            "destination_port": 1,
            "risk_score": 1,
            "scores": 1,
        },
    ).to_list(length=5000)

    if not alert_docs:
        return []

    alert_route_keys = {
        doc.get("route_key")
        for doc in alert_docs
        if doc.get("route_key")
    }

    snapshot_docs = await db.risk_snapshots.find(
        {
            "entity_type": "route",
            "route_key": {"$in": list(alert_route_keys)},
        }
    ).sort("snapshot_time", -1).to_list(length=5000)

    latest_by_route: Dict[str, Dict[str, Any]] = {}
    for doc in snapshot_docs:
        route_key = doc.get("route_key") or doc.get("entity_id")
        if route_key and route_key not in latest_by_route:
            latest_by_route[route_key] = doc

    route_lookup = {
        row["route_key"]: row
        for row in await db.routes_master.find(
            {
                "active": {"$ne": False},
                "route_key": {"$in": list(alert_route_keys)},
            },
            {
                "route_key": 1,
                "shipment_count": 1,
                "avg_delay_hours": 1,
                "origin_port": 1,
                "destination_port": 1,
            },
        ).to_list(length=5000)
    }

    results: List[Dict[str, Any]] = []

    for route_key, snap in latest_by_route.items():
        scores = snap.get("scores") or {}
        route = route_lookup.get(route_key, {})

        avg_delay_hours = round(_safe_float(route.get("avg_delay_hours")), 2)
        congestion = _safe_float(scores.get("congestion"))
        news = _safe_float(scores.get("news"))
        ml = _safe_float(scores.get("ml"))
        logistics = _safe_float(scores.get("logistics"))

        pressure_score = round(
            min(
                100.0,
                (avg_delay_hours * 1.2)
                + (congestion * 0.45)
                + (news * 0.20)
                + (logistics * 0.35)
                + (ml * 0.25),
            ),
            2,
        )

        throughput_pct = round(
            max(
                20.0,
                min(
                    100.0,
                    100 - (congestion * 0.35) - (avg_delay_hours * 0.8) - (news * 0.10),
                ),
            ),
            2,
        )

        lane_label = (
            f"{route.get('origin_port', 'Unknown')} → {route.get('destination_port', 'Unknown')}"
        )

        results.append(
            {
                "lane": lane_label,
                "avg_delay_hours": avg_delay_hours,
                "throughput_pct": throughput_pct,
                "pressure_score": pressure_score,
                "shipment_count": int(route.get("shipment_count") or 0),
            }
        )

    results.sort(key=lambda x: x["pressure_score"], reverse=True)
    return results[:10]
    db = get_database()

    snapshot_docs = await db.risk_snapshots.find(
        {"entity_type": "route"}
    ).sort("snapshot_time", -1).to_list(length=5000)

    latest_by_route: Dict[str, Dict[str, Any]] = {}
    for doc in snapshot_docs:
        route_key = doc.get("route_key") or doc.get("entity_id")
        if route_key and route_key not in latest_by_route:
            latest_by_route[route_key] = doc

    route_lookup = {
        row["route_key"]: row
        for row in await db.routes_master.find(
            {"active": {"$ne": False}},
            {
                "route_key": 1,
                "shipment_count": 1,
                "avg_delay_hours": 1,
                "origin_port": 1,
                "destination_port": 1,
            },
        ).to_list(length=5000)
    }

    results: List[Dict[str, Any]] = []

    for route_key, snap in latest_by_route.items():
        scores = snap.get("scores") or {}
        route = route_lookup.get(route_key, {})

        avg_delay_hours = round(_safe_float(route.get("avg_delay_hours")), 2)
        congestion = _safe_float(scores.get("congestion"))
        news = _safe_float(scores.get("news"))
        ml = _safe_float(scores.get("ml"))
        logistics = _safe_float(scores.get("logistics"))

        pressure_score = round(
            min(
                100.0,
                (avg_delay_hours * 1.2)
                + (congestion * 0.45)
                + (news * 0.20)
                + (logistics * 0.35)
                + (ml * 0.25),
            ),
            2,
        )

        throughput_pct = round(
            max(
                20.0,
                min(
                    100.0,
                    100 - (congestion * 0.35) - (avg_delay_hours * 0.8) - (news * 0.10),
                ),
            ),
            2,
        )

        lane_label = (
            f"{route.get('origin_port', 'Unknown')} → {route.get('destination_port', 'Unknown')}"
        )

        results.append(
            {
                "lane": lane_label,
                "avg_delay_hours": avg_delay_hours,
                "throughput_pct": throughput_pct,
                "pressure_score": pressure_score,
                "shipment_count": int(route.get("shipment_count") or 0),
            }
        )

    results.sort(key=lambda x: x["pressure_score"], reverse=True)
    return results[:10]