import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.database import get_database
from app.services.alert_service import generate_alerts_from_snapshots
from app.services.emerging_signal_service import (
    build_emerging_signals,
    get_route_emerging_impact,
)
from app.services.ml_service import predict_route_disruption
from app.services.port_congestion_service import ingest_port_congestion_signals
from app.services.risk_engine import get_risk_level
from app.services.signal_service import (
    ingest_news_signals_for_all_ports,
    ingest_weather_signals_for_all_ports,
)

_refresh_lock = asyncio.Lock()
_last_news_refresh_at: datetime | None = None
_last_weather_refresh_at: datetime | None = None


def _clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def _normalize_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _port_name_variants(port_name: Optional[str]) -> List[str]:
    normalized = _normalize_str(port_name)
    if not normalized:
        return []

    variants = [normalized]
    lower_name = normalized.lower()

    if lower_name.endswith(" port"):
        base = normalized[:-5].strip()
        if base:
            variants.append(base)

    if lower_name.startswith("port of "):
        base = normalized[8:].strip()
        if base:
            variants.append(base)

    return list(dict.fromkeys([variant for variant in variants if variant]))


def _route_key(origin: Optional[str], destination: Optional[str]) -> str:
    return f"{origin or 'NA'}|{destination or 'NA'}"


def _port_signal_score(signal: Optional[dict]) -> int:
    if not signal:
        return 0
    return int(signal.get("severity", 0) or 0)


def _avg_signal(*signals: Optional[dict]) -> int:
    values = [_port_signal_score(signal) for signal in signals if signal]
    if not values:
        return 0
    return _clamp_score(sum(values) / len(values))


def _logistics_score(route_doc: dict) -> int:
    avg_delay_hours = float(route_doc.get("avg_delay_hours") or 0)
    avg_customs_clearance_hours = float(route_doc.get("avg_customs_clearance_hours") or 0)
    avg_demand_volatility = float(route_doc.get("avg_demand_volatility") or 0)

    score = 0.0

    if avg_delay_hours >= 72:
        score += 50
    elif avg_delay_hours >= 48:
        score += 35
    elif avg_delay_hours >= 24:
        score += 20
    elif avg_delay_hours > 0:
        score += 10

    if avg_customs_clearance_hours >= 48:
        score += 20
    elif avg_customs_clearance_hours >= 24:
        score += 10

    score += min(avg_demand_volatility * 30, 20)
    return _clamp_score(score)


async def _latest_signal(entity_id: Optional[str], signal_collection: str) -> Optional[dict]:
    variants = _port_name_variants(entity_id)
    if not variants:
        return None
    db = get_database()

    return await db[signal_collection].find_one(
        {
            "$or": [
                {"entity_id": {"$in": variants}},
                {"port_name": {"$in": variants}},
                {"location_name": {"$in": variants}},
            ]
        },
        sort=[("fetched_at", -1)],
    )


async def refresh_routes_master() -> Dict[str, Any]:
    db = get_database()

    pipeline = [
        {
            "$group": {
                "_id": {
                    "origin_port": "$origin_port",
                    "destination_port": "$destination_port",
                },
                "shipment_count": {"$sum": 1},
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                "avg_expected_time_hours": {"$avg": {"$ifNull": ["$expected_time_hours", 0]}},
                "avg_actual_time_hours": {"$avg": {"$ifNull": ["$actual_time_hours", 0]}},
                "avg_customs_clearance_hours": {"$avg": {"$ifNull": ["$customs_clearance_hours", 0]}},
                "avg_order_value": {"$avg": {"$ifNull": ["$order_value", 0]}},
                "avg_inventory_level": {"$avg": {"$ifNull": ["$inventory_level", 0]}},
                "avg_safety_stock_level": {"$avg": {"$ifNull": ["$safety_stock_level", 0]}},
                "avg_units_sold_7d": {"$avg": {"$ifNull": ["$units_sold_7d", 0]}},
                "avg_demand_volatility": {"$avg": {"$ifNull": ["$demand_volatility", 0]}},
                "product_categories": {"$addToSet": "$product_category"},
                "business_units": {"$addToSet": "$business_unit"},
                "priority_levels": {"$addToSet": "$priority_level"},
                "transport_modes": {"$addToSet": "$transport_mode"},
            }
        }
    ]

    docs = await db.shipments_raw.aggregate(pipeline).to_list(length=100000)
    output_docs: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for doc in docs:
        origin = _normalize_str((doc.get("_id") or {}).get("origin_port"))
        destination = _normalize_str((doc.get("_id") or {}).get("destination_port"))
        key = _route_key(origin, destination)

        output_docs.append(
            {
                "_id": key,
                "route_key": key,
                "origin_port": origin,
                "destination_port": destination,
                "shipment_count": int(doc.get("shipment_count") or 0),
                "avg_delay_hours": round(float(doc.get("avg_delay_hours") or 0), 2),
                "avg_expected_time_hours": round(float(doc.get("avg_expected_time_hours") or 0), 2),
                "avg_actual_time_hours": round(float(doc.get("avg_actual_time_hours") or 0), 2),
                "avg_customs_clearance_hours": round(float(doc.get("avg_customs_clearance_hours") or 0), 2),
                "avg_order_value": round(float(doc.get("avg_order_value") or 0), 2),
                "avg_inventory_level": round(float(doc.get("avg_inventory_level") or 0), 2),
                "avg_safety_stock_level": round(float(doc.get("avg_safety_stock_level") or 0), 2),
                "avg_units_sold_7d": round(float(doc.get("avg_units_sold_7d") or 0), 2),
                "avg_demand_volatility": round(float(doc.get("avg_demand_volatility") or 0), 4),
                "product_categories": sorted([x for x in (doc.get("product_categories") or []) if x is not None]),
                "business_units": sorted([x for x in (doc.get("business_units") or []) if x is not None]),
                "priority_levels": sorted([x for x in (doc.get("priority_levels") or []) if x is not None]),
                "transport_modes": sorted([x for x in (doc.get("transport_modes") or []) if x is not None]),
                "active": True,
                "created_at": now,
                "updated_at": now,
            }
        )

    await db.routes_master.delete_many({})
    if output_docs:
        await db.routes_master.insert_many(output_docs)

    return {"success": True, "routes_created": len(output_docs)}


async def refresh_route_risk_snapshots() -> Dict[str, Any]:
    db = get_database()

    await db.risk_snapshots.delete_many({})
    routes = await db.routes_master.find({"active": {"$ne": False}}).to_list(length=100000)
    inserted = 0

    for route in routes:
        origin = route.get("origin_port")
        destination = route.get("destination_port")
        route_key = route.get("route_key")

        origin_weather = await _latest_signal(origin, "weather_signals")
        destination_weather = await _latest_signal(destination, "weather_signals")
        origin_news = await _latest_signal(origin, "news_signals")
        destination_news = await _latest_signal(destination, "news_signals")
        origin_congestion = await _latest_signal(origin, "port_congestion_signals")
        destination_congestion = await _latest_signal(destination, "port_congestion_signals")

        weather_score = _avg_signal(origin_weather, destination_weather)
        news_score = _avg_signal(origin_news, destination_news)
        congestion_score = _avg_signal(origin_congestion, destination_congestion)
        logistics = _logistics_score(route)

        try:
            ml_prediction = await predict_route_disruption(
                route_key=route_key,
                origin_port=origin,
                destination_port=destination,
                weather_score=weather_score,
                news_score=news_score,
                congestion_score=congestion_score,
            )
            ml_risk_score = int(ml_prediction["ml_risk_score"])
            ml_probability = float(ml_prediction["disruption_probability"])
            predicted_delay_hours = float(ml_prediction["predicted_delay_hours"])
            top_factors = ml_prediction.get("top_factors", [])
        except Exception:
            ml_risk_score = 0
            ml_probability = 0.0
            predicted_delay_hours = float(route.get("avg_delay_hours") or 0)
            top_factors = []

        emerging_impact = await get_route_emerging_impact(route)
        emerging_score = int(emerging_impact.get("score", 0) or 0)

        final_risk = _clamp_score(
            0.13 * weather_score
            + 0.18 * news_score
            + 0.18 * logistics
            + 0.18 * congestion_score
            + 0.21 * ml_risk_score
            + 0.12 * emerging_score
        )

        drivers = []
        if weather_score >= 40:
            drivers.append("weather")
        if news_score >= 40:
            drivers.append("news")
        if logistics >= 40:
            drivers.append("logistics")
        if congestion_score >= 40:
            drivers.append("congestion")
        if ml_risk_score >= 40:
            drivers.append("ml")
        if emerging_score >= 25:
            drivers.append("emerging")

        snapshot = {
            "entity_type": "route",
            "entity_id": route_key,
            "route_key": route_key,
            "origin_port": origin,
            "destination_port": destination,
            "scores": {
                "weather": weather_score,
                "news": news_score,
                "logistics": logistics,
                "congestion": congestion_score,
                "ml": ml_risk_score,
                "emerging": emerging_score,
                "final_risk": final_risk,
            },
            "ml_prediction": {
                "disruption_probability": ml_probability,
                "ml_risk_score": ml_risk_score,
                "predicted_delay_hours": predicted_delay_hours,
                "top_factors": top_factors,
            },
            "emerging_impact": emerging_impact,
            "risk_level": get_risk_level(final_risk),
            "top_drivers": drivers,
            "snapshot_time": datetime.now(timezone.utc),
        }

        await db.risk_snapshots.insert_one(snapshot)
        inserted += 1

    return {"success": True, "routes_processed": len(routes), "snapshots_inserted": inserted}


async def refresh_derived_state() -> Dict[str, Any]:
    global _last_news_refresh_at, _last_weather_refresh_at

    async with _refresh_lock:
        result: Dict[str, Any] = {"started_at": datetime.now(timezone.utc).isoformat()}
        result["routes_master"] = await refresh_routes_master()
        result["port_congestion"] = await ingest_port_congestion_signals()

        now = datetime.now(timezone.utc)
        weather_due = (
            _last_weather_refresh_at is None
            or (now - _last_weather_refresh_at).total_seconds()
            >= max(60, settings.WEATHER_REFRESH_INTERVAL_SECONDS)
        )
        news_due = (
            _last_news_refresh_at is None
            or (now - _last_news_refresh_at).total_seconds()
            >= max(60, settings.NEWS_REFRESH_INTERVAL_SECONDS)
        )

        if weather_due:
            try:
                result["weather_signals"] = await ingest_weather_signals_for_all_ports()
                _last_weather_refresh_at = now
            except Exception as exc:
                result["weather_signals_error"] = str(exc)
        else:
            result["weather_signals"] = {"skipped": True, "reason": "interval_not_elapsed"}

        if news_due:
            try:
                result["news_signals"] = await ingest_news_signals_for_all_ports()
                _last_news_refresh_at = now
            except Exception as exc:
                result["news_signals_error"] = str(exc)
        else:
            result["news_signals"] = {"skipped": True, "reason": "interval_not_elapsed"}

        result["emerging_signals"] = await build_emerging_signals(limit_per_source=200, save_all=True)
        result["risk_snapshots"] = await refresh_route_risk_snapshots()
        result["alerts"] = await generate_alerts_from_snapshots()
        result["completed_at"] = datetime.now(timezone.utc).isoformat()
        return result


async def auto_refresh_loop() -> None:
    interval = max(60, settings.AUTO_REFRESH_INTERVAL_SECONDS)

    if settings.AUTO_REFRESH_ON_STARTUP:
        try:
            print("Starting initial derived-data refresh...")
            await refresh_derived_state()
            print("Initial derived-data refresh completed.")
        except Exception as exc:
            print(f"Initial derived-data refresh failed: {exc}")

    while True:
        try:
            await asyncio.sleep(interval)
            print("Starting scheduled derived-data refresh...")
            await refresh_derived_state()
            print("Scheduled derived-data refresh completed.")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"Scheduled derived-data refresh failed: {exc}")
