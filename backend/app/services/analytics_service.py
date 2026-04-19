import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.core.database import get_database
from app.services.supplier_service import get_all_suppliers
from app.services.weather_service import fetch_daily_forecast_for_location


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(float(value))
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


def _short_day_label(value: datetime) -> str:
    return value.strftime("%a").upper()


def _clamp_score(value: float) -> float:
    return max(0.0, min(100.0, value))


def _coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None

    return None


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip().lower()
    return text or None


def _filter_snapshot_docs(
    snapshot_docs: List[Dict[str, Any]],
    port: Optional[str] = None,
    lane: Optional[str] = None,
) -> List[Dict[str, Any]]:
    normalized_port = _normalize_text(port)
    normalized_lane = _normalize_text(lane)

    if not normalized_port and not normalized_lane:
        return snapshot_docs

    filtered: List[Dict[str, Any]] = []

    for doc in snapshot_docs:
        route_key = _normalize_text(doc.get("route_key") or doc.get("entity_id"))
        origin_port = _normalize_text(doc.get("origin_port"))
        destination_port = _normalize_text(doc.get("destination_port"))

        if normalized_lane and route_key != normalized_lane:
            continue

        if normalized_port and normalized_port not in {origin_port, destination_port}:
            continue

        filtered.append(doc)

    return filtered


def _daily_snapshot_series(snapshot_docs: List[Dict[str, Any]]) -> List[Dict[str, float | str]]:
    buckets: Dict[str, Dict[str, Dict[str, Any]]] = {}
    bucket_times: Dict[str, datetime] = {}

    for doc in snapshot_docs:
        route_key = doc.get("route_key") or doc.get("entity_id")
        snapshot_time = _coerce_datetime(doc.get("snapshot_time"))
        if not route_key or not snapshot_time:
            continue

        bucket_key = snapshot_time.astimezone(timezone.utc).date().isoformat()
        bucket_times[bucket_key] = snapshot_time
        route_bucket = buckets.setdefault(bucket_key, {})

        existing = route_bucket.get(route_key)
        existing_time = _coerce_datetime((existing or {}).get("snapshot_time"))
        if existing is None or (existing_time and snapshot_time > existing_time):
            route_bucket[route_key] = doc

    results: List[Dict[str, float | str]] = []

    for bucket_key in sorted(bucket_times.keys())[-7:]:
        route_docs = list((buckets.get(bucket_key) or {}).values())
        if not route_docs:
            continue

        current_risk = round(
            sum(_safe_float((doc.get("scores") or {}).get("final_risk")) for doc in route_docs)
            / len(route_docs),
            2,
        )
        forecast_risk = round(
            sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in route_docs)
            / len(route_docs),
            2,
        )
        drift = round(forecast_risk - current_risk, 2)

        results.append(
            {
                "day": _short_day_label(bucket_times[bucket_key]),
                "current_risk": current_risk,
                "forecast_risk": forecast_risk,
                "drift": drift,
            }
        )

    return results


def _analytics_time_series(snapshot_docs: List[Dict[str, Any]]) -> List[Dict[str, float | str | int]]:
    buckets: Dict[str, Dict[str, Dict[str, Any]]] = {}
    bucket_times: Dict[str, datetime] = {}

    for doc in snapshot_docs:
        route_key = doc.get("route_key") or doc.get("entity_id")
        snapshot_time = _coerce_datetime(doc.get("snapshot_time"))
        if not route_key or not snapshot_time:
            continue

        bucket_key = snapshot_time.astimezone(timezone.utc).date().isoformat()
        bucket_times[bucket_key] = snapshot_time
        route_bucket = buckets.setdefault(bucket_key, {})

        existing = route_bucket.get(route_key)
        existing_time = _coerce_datetime((existing or {}).get("snapshot_time"))
        if existing is None or (existing_time and snapshot_time > existing_time):
            route_bucket[route_key] = doc

    results: List[Dict[str, float | str | int]] = []

    for bucket_key in sorted(bucket_times.keys())[-14:]:
        route_docs = list((buckets.get(bucket_key) or {}).values())
        if not route_docs:
            continue

        divisor = len(route_docs)
        results.append(
            {
                "day": _short_day_label(bucket_times[bucket_key]),
                "date": bucket_key,
                "current_risk": round(
                    sum(_safe_float((doc.get("scores") or {}).get("final_risk")) for doc in route_docs)
                    / divisor,
                    2,
                ),
                "forecast_risk": round(
                    sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in route_docs)
                    / divisor,
                    2,
                ),
                "drift": round(
                    (
                        sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in route_docs)
                        - sum(_safe_float((doc.get("scores") or {}).get("final_risk")) for doc in route_docs)
                    )
                    / divisor,
                    2,
                ),
                "weather_score": round(
                    sum(_safe_float((doc.get("scores") or {}).get("weather")) for doc in route_docs)
                    / divisor,
                    2,
                ),
                "news_score": round(
                    sum(_safe_float((doc.get("scores") or {}).get("news")) for doc in route_docs)
                    / divisor,
                    2,
                ),
                "congestion_score": round(
                    sum(_safe_float((doc.get("scores") or {}).get("congestion")) for doc in route_docs)
                    / divisor,
                    2,
                ),
                "logistics_score": round(
                    sum(_safe_float((doc.get("scores") or {}).get("logistics")) for doc in route_docs)
                    / divisor,
                    2,
                ),
                "emerging_score": round(
                    sum(_safe_float((doc.get("scores") or {}).get("emerging")) for doc in route_docs)
                    / divisor,
                    2,
                ),
                "route_count": divisor,
            }
        )

    return results


def _weather_forecast_point(
    day_value: datetime,
    current_risk: float,
    forecast_risk: float,
) -> Dict[str, float | str]:
    current = round(_clamp_score(current_risk), 2)
    forecast = round(_clamp_score(forecast_risk), 2)
    return {
        "day": _short_day_label(day_value),
        "today_baseline": current,
        "forecast_risk": forecast,
        "drift": round(forecast - current, 2),
    }


async def _route_coordinates_by_key(route_keys: List[str]) -> Dict[str, Dict[str, Any]]:
    if not route_keys:
        return {}

    db = get_database()
    rows = await db.shipments_raw.aggregate(
        [
            {"$match": {"route_key": {"$in": route_keys}}},
            {
                "$group": {
                    "_id": "$route_key",
                    "origin_port": {"$first": "$origin_port"},
                    "destination_port": {"$first": "$destination_port"},
                    "origin_lat": {"$first": "$origin_lat"},
                    "origin_lng": {"$first": "$origin_lng"},
                    "destination_lat": {"$first": "$destination_lat"},
                    "destination_lng": {"$first": "$destination_lng"},
                }
            },
        ]
    ).to_list(length=len(route_keys) or 1)

    return {str(row["_id"]): row for row in rows if row.get("_id")}


async def _fetch_port_forecasts(
    port_rows: Dict[str, Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    forecast_tasks: Dict[str, Any] = {}

    for port_key, port in port_rows.items():
        lat = _safe_float(port.get("lat"), float("nan"))
        lng = _safe_float(port.get("lng"), float("nan"))
        if lat != lat or lng != lng:
            continue
        forecast_tasks[port_key] = fetch_daily_forecast_for_location(lat=lat, lng=lng, days=7)

    if not forecast_tasks:
        return {}

    results = await asyncio.gather(*forecast_tasks.values(), return_exceptions=True)
    forecasts: Dict[str, List[Dict[str, Any]]] = {}

    for port_key, result in zip(forecast_tasks.keys(), results):
        if isinstance(result, Exception):
            continue
        forecasts[port_key] = result

    return forecasts


def _build_seven_day_flat_forecast(
    current_risk: float,
    forecast_risk: float,
) -> List[Dict[str, float | str]]:
    start = datetime.now(timezone.utc)
    return [
        _weather_forecast_point(start + timedelta(days=index), current_risk, forecast_risk)
        for index in range(7)
    ]


async def _seven_day_weather_forecast_series() -> List[Dict[str, float | str]]:
    db = get_database()
    snapshot_docs = (
        await db.risk_snapshots.find({"entity_type": "route"})
        .sort("snapshot_time", -1)
        .to_list(length=5000)
    )
    latest_snapshots = _latest_route_snapshots_by_key(snapshot_docs)
    if not latest_snapshots:
        return []

    route_keys = [
        str(doc.get("route_key") or doc.get("entity_id"))
        for doc in latest_snapshots
        if doc.get("route_key") or doc.get("entity_id")
    ]
    route_coords = await _route_coordinates_by_key(route_keys)

    port_rows: Dict[str, Dict[str, Any]] = {}
    for route_key, route in route_coords.items():
        origin_port = route.get("origin_port")
        destination_port = route.get("destination_port")
        if origin_port:
            port_rows[f"origin::{route_key}"] = {
                "port_name": origin_port,
                "lat": route.get("origin_lat"),
                "lng": route.get("origin_lng"),
            }
        if destination_port:
            port_rows[f"destination::{route_key}"] = {
                "port_name": destination_port,
                "lat": route.get("destination_lat"),
                "lng": route.get("destination_lng"),
            }

    port_forecasts = await _fetch_port_forecasts(port_rows)

    base_current_risk = round(
        sum(_safe_float((doc.get("scores") or {}).get("final_risk")) for doc in latest_snapshots)
        / len(latest_snapshots),
        2,
    )
    base_ml_risk = round(
        sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in latest_snapshots)
        / len(latest_snapshots),
        2,
    )

    if not port_forecasts:
        return _build_seven_day_flat_forecast(base_current_risk, base_ml_risk)

    today = datetime.now(timezone.utc)
    daily_buckets: List[List[float]] = [[] for _ in range(7)]

    for doc in latest_snapshots:
        route_key = str(doc.get("route_key") or doc.get("entity_id") or "")
        if not route_key:
            continue

        scores = doc.get("scores") or {}
        current_risk = _safe_float(scores.get("final_risk"))
        current_weather = _safe_float(scores.get("weather"))
        ml_score = _safe_float(scores.get("ml"))

        baseline_without_weather = max(0.0, current_risk - current_weather * 0.45)
        ml_uplift = max(0.0, ml_score - current_risk) * 0.25

        origin_forecast = port_forecasts.get(f"origin::{route_key}", [])
        destination_forecast = port_forecasts.get(f"destination::{route_key}", [])

        for day_index in range(7):
            origin_severity = _safe_float(
                (origin_forecast[day_index] if day_index < len(origin_forecast) else {}).get("severity")
            )
            destination_severity = _safe_float(
                (destination_forecast[day_index] if day_index < len(destination_forecast) else {}).get("severity")
            )
            future_weather = max(origin_severity, destination_severity)
            if future_weather <= 0:
                future_weather = current_weather

            forecast_risk = _clamp_score(
                baseline_without_weather + future_weather * 0.45 + ml_uplift
            )
            daily_buckets[day_index].append(forecast_risk)

    results: List[Dict[str, float | str]] = []
    for day_index, values in enumerate(daily_buckets):
        day_value = today + timedelta(days=day_index)
        avg_forecast = round(sum(values) / len(values), 2) if values else base_ml_risk
        results.append(_weather_forecast_point(day_value, base_current_risk, avg_forecast))

    return results


async def get_analytics_overview() -> Dict[str, float | int]:
    db = get_database()

    snapshot_docs = (
        await db.risk_snapshots.find({"entity_type": "route"})
        .sort("snapshot_time", -1)
        .to_list(length=5000)
    )

    latest_snapshots = _latest_route_snapshots_by_key(snapshot_docs)
    forecast_series = await _seven_day_weather_forecast_series()

    latest_forecast_point = forecast_series[-1] if forecast_series else None

    if latest_snapshots:
        avg_forecast_risk = float(
            round(
                sum(_safe_float(point.get("forecast_risk")) for point in forecast_series)
                / len(forecast_series),
                2,
            )
            if forecast_series
            else round(
                sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in latest_snapshots)
                / len(latest_snapshots),
                2,
            )
        )
        forecast_drift = float(
            latest_forecast_point["drift"]
            if latest_forecast_point
            else round(
                (
                    sum(_safe_float((doc.get("scores") or {}).get("ml")) for doc in latest_snapshots)
                    / len(latest_snapshots)
                )
                - (
                    sum(_safe_float((doc.get("scores") or {}).get("final_risk")) for doc in latest_snapshots)
                    / len(latest_snapshots)
                ),
                2,
            )
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

    if supplier_rows:
        avg_supplier_risk = round(
            sum(
                (
                    _safe_float(row.get("avg_delay_hours")) * 2.0
                    + _safe_float(row.get("avg_customs_clearance_hours")) * 1.2
                    + _safe_float(row.get("avg_demand_volatility")) * 25.0
                )
                for row in supplier_rows
            )
            / len(supplier_rows),
            2,
        )
    else:
        avg_supplier_risk = 0.0

    avg_delay_result = await db.shipments_raw.aggregate(
        [
            {
                "$group": {
                    "_id": None,
                    "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                }
            }
        ]
    ).to_list(length=1)

    avg_delay_hours = round(
        _safe_float(avg_delay_result[0].get("avg_delay_hours")) if avg_delay_result else 0.0,
        2,
    )

    return {
        "avg_forecast_risk": avg_forecast_risk,
        "forecast_drift": forecast_drift,
        "avg_supplier_risk": avg_supplier_risk,
        "critical_alerts": critical_alerts,
        "avg_delay_hours": avg_delay_hours,
    }


async def get_analytics_forecast() -> List[Dict[str, float | str]]:
    return await _seven_day_weather_forecast_series()


async def get_analytics_time_series(
    port: Optional[str] = None,
    lane: Optional[str] = None,
) -> List[Dict[str, float | str | int]]:
    db = get_database()

    snapshot_docs = (
        await db.risk_snapshots.find({"entity_type": "route"})
        .sort("snapshot_time", -1)
        .to_list(length=10000)
    )

    filtered_docs = _filter_snapshot_docs(snapshot_docs, port=port, lane=lane)
    return _analytics_time_series(filtered_docs)


async def get_supplier_exposure() -> List[Dict[str, Any]]:
    suppliers = await get_all_suppliers()

    return [
        {
            "supplier_id": str(supplier.get("supplier_id") or "unknown"),
            "supplier_name": str(supplier.get("supplier_name") or "Unknown Supplier"),
            "supplier_country": str(supplier.get("supplier_country") or "Unknown"),
            "supplier_region": str(supplier.get("supplier_region") or "Unknown"),
            "risk_score": round(_safe_float(supplier.get("risk_score")), 2),
            "dependency_score": round(_safe_float(supplier.get("dependency_score")), 2),
        }
        for supplier in suppliers[:10]
    ]


async def get_lane_pressure() -> List[Dict[str, Any]]:
    db = get_database()

    rows = await db.shipments_raw.aggregate(
        [
            {
                "$group": {
                    "_id": {
                        "origin_port": "$origin_port",
                        "destination_port": "$destination_port",
                    },
                    "shipment_count": {"$sum": 1},
                    "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                    "avg_expected_time_hours": {
                        "$avg": {"$ifNull": ["$expected_time_hours", 0]}
                    },
                }
            }
        ]
    ).to_list(length=5000)

    if not rows:
        return []

    max_delay = max((_safe_float(row.get("avg_delay_hours")) for row in rows), default=0.0)

    results: List[Dict[str, Any]] = []

    for row in rows:
        route = row.get("_id", {}) or {}
        origin_port = str(route.get("origin_port") or "Unknown")
        destination_port = str(route.get("destination_port") or "Unknown")
        delay_hours = round(_safe_float(row.get("avg_delay_hours")), 2)
        expected_time_hours = round(_safe_float(row.get("avg_expected_time_hours")), 2)
        shipment_count = _safe_int(row.get("shipment_count"))

        throughput_pct = round(
            max(0, min(100, 100 - ((delay_hours / expected_time_hours) * 100)))
            if expected_time_hours > 0
            else 0.0,
            2,
        )

        delay_pct = round(
            (_safe_float(delay_hours) / max_delay) * 100, 2
        ) if max_delay > 0 else 0.0

        pressure_score = round(
            (delay_pct * 0.65) + ((100 - throughput_pct) * 0.35),
            2,
        )

        results.append(
            {
                "lane": f"{origin_port} → {destination_port}",
                "origin_port": origin_port,
                "destination_port": destination_port,
                "pressure_score": pressure_score,
                "delay_hours": delay_hours,
                "delay_pct": delay_pct,
                "throughput_pct": throughput_pct,
                "shipment_count": shipment_count,
            }
        )

    results.sort(key=lambda x: x["pressure_score"], reverse=True)
    return results[:10]
