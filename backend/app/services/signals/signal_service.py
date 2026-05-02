from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.database import get_database
from app.core.config import settings
from app.services.ports.port_service import get_active_ports
from app.services.signals.news_service import (
    fetch_news_for_supplier,
    normalize_news_signal,
)
from app.services.signals.weather_service import (
    extract_weather_metrics,
    fetch_weather_for_location,
)


def _port_to_news_entity(port: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "_id": port.get("_id"),
        "id": port.get("_id"),
        "entity_type": "port",
        "name": port.get("port_name"),
        "port_name": port.get("port_name"),
        "city": None,
        "country": port.get("country"),
        "location": port.get("port_name"),
        "lat": port.get("lat"),
        "lng": port.get("lng"),
    }


def _normalize_weather_signal_for_port(
    port: Dict[str, Any],
    api_payload: Dict[str, Any],
) -> Dict[str, Any] | None:
    metrics = extract_weather_metrics(api_payload)
    if not metrics:
        return None

    return {
        "source": "openweather",
        "entity_type": "port",
        "entity_id": str(port.get("_id")),
        "port_name": port.get("port_name"),
        "location_name": port.get("port_name"),
        "country": port.get("country"),
        "lat": port.get("lat"),
        "lng": port.get("lng"),
        "signal_type": "weather_risk",
        "severity": metrics["severity"],
        "confidence": 0.85,
        "event_time": datetime.now(timezone.utc),
        "fetched_at": datetime.now(timezone.utc),
        "features": {
            "precipitation_mm": metrics["precipitation_mm"],
            "wind_speed_kmh": metrics["wind_speed_kmh"],
            "wind_gust_kmh": metrics["wind_gust_kmh"],
            "temperature_c": metrics["temperature_c"],
            "feels_like_c": metrics["feels_like_c"],
            "weather_code": metrics["weather_code"],
            "weather_main": metrics["weather_main"],
            "weather_description": metrics["weather_description"],
        },
        "raw_payload": api_payload,
    }


async def _get_active_ports() -> List[Dict[str, Any]]:
    return await get_active_ports()


def _coerce_utc_datetime(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    return None


def _signal_is_fresh(doc: Dict[str, Any] | None, max_age_seconds: int) -> bool:
    if not doc:
        return False
    fetched_at = _coerce_utc_datetime(doc.get("fetched_at"))
    if fetched_at is None:
        return False
    age_seconds = (datetime.now(timezone.utc) - fetched_at).total_seconds()
    return age_seconds < max(60, max_age_seconds)


async def _existing_port_signal(
    collection_name: str,
    entity_id: str,
) -> Dict[str, Any] | None:
    db = get_database()
    return await db[collection_name].find_one(
        {"entity_type": "port", "entity_id": entity_id},
        sort=[("fetched_at", -1)],
    )


async def ingest_weather_signals_for_all_ports() -> Dict[str, Any]:
    db = get_database()
    ports = await _get_active_ports()

    inserted = 0
    skipped = 0
    reused = 0
    preserved = 0
    errors: List[Dict[str, Any]] = []

    for port in ports:
        lat = port.get("lat")
        lng = port.get("lng")
        entity_id = str(port.get("_id"))
        existing_doc = await _existing_port_signal("weather_signals", entity_id)

        if lat is None or lng is None:
            skipped += 1
            continue

        if _signal_is_fresh(existing_doc, settings.WEATHER_REFRESH_INTERVAL_SECONDS):
            reused += 1
            continue

        try:
            payload = await fetch_weather_for_location(lat=float(lat), lng=float(lng))
            signal_doc = _normalize_weather_signal_for_port(port, payload)

            if not signal_doc:
                if existing_doc:
                    preserved += 1
                else:
                    skipped += 1
                continue

            await db.weather_signals.update_one(
                {"entity_id": signal_doc["entity_id"], "entity_type": signal_doc["entity_type"]},
                {"$set": signal_doc},
                upsert=True,
            )
            inserted += 1
        except Exception as exc:
            if existing_doc:
                preserved += 1
            else:
                skipped += 1
            errors.append(
                {
                    "port_name": port.get("port_name"),
                    "error": str(exc),
                }
            )

    return {
        "total_ports": len(ports),
        "inserted": inserted,
        "reused": reused,
        "preserved": preserved,
        "skipped": skipped,
        "errors": errors[:20],
    }


async def ingest_news_signals_for_all_ports() -> Dict[str, Any]:
    db = get_database()
    ports = await _get_active_ports()

    upserted = 0
    skipped = 0
    reused = 0
    preserved = 0
    errors: List[Dict[str, Any]] = []

    for port in ports:
        entity_id = str(port.get("_id"))
        existing_doc = await _existing_port_signal("news_signals", entity_id)

        if _signal_is_fresh(existing_doc, settings.NEWS_REFRESH_INTERVAL_SECONDS):
            reused += 1
            continue

        try:
            news_entity = _port_to_news_entity(port)
            payload = await fetch_news_for_supplier(news_entity)
            signal_doc = normalize_news_signal(news_entity, payload)

            if not signal_doc:
                if existing_doc:
                    preserved += 1
                else:
                    skipped += 1
                continue

            if existing_doc and signal_doc.get("article_count", 0) == 0:
                preserved += 1
                continue

            await db.news_signals.update_one(
                {"entity_id": signal_doc["entity_id"], "entity_type": signal_doc["entity_type"]},
                {"$set": signal_doc},
                upsert=True,
            )
            upserted += 1
        except Exception as exc:
            if existing_doc:
                preserved += 1
            else:
                skipped += 1
            errors.append(
                {
                    "port_name": port.get("port_name"),
                    "error": str(exc),
                }
            )

    return {
        "total_ports": len(ports),
        "upserted": upserted,
        "reused": reused,
        "preserved": preserved,
        "skipped": skipped,
        "errors": errors[:20],
    }


def _serialize_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []

    for doc in docs:
        item = dict(doc)

        if "_id" in item:
            item["_id"] = str(item["_id"])

        serialized.append(item)

    return serialized


async def get_latest_weather_signals(limit: int = 50) -> List[Dict[str, Any]]:
    db = get_database()
    cursor = (
        db.weather_signals.find({}, {"raw_payload": 0})
        .sort("fetched_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return _serialize_docs(docs)


async def get_latest_news_signals(limit: int = 50) -> List[Dict[str, Any]]:
    db = get_database()
    cursor = (
        db.news_signals.find({}, {"raw_payload": 0})
        .sort("fetched_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    return _serialize_docs(docs)
