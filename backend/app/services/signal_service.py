from typing import Any, Dict, List

from app.core.database import get_database
from app.services.port_service import get_active_ports
from app.services.news_service import fetch_news_for_supplier, normalize_news_signal
from app.services.weather_service import extract_weather_metrics, fetch_weather_for_location


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

    from datetime import datetime, timezone

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


async def ingest_weather_signals_for_all_ports() -> Dict[str, Any]:
    db = get_database()
    ports = await _get_active_ports()

    inserted = 0
    skipped = 0
    errors: List[Dict[str, Any]] = []

    await db.weather_signals.delete_many({})

    for port in ports:
        lat = port.get("lat")
        lng = port.get("lng")

        if lat is None or lng is None:
            skipped += 1
            continue

        try:
            payload = await fetch_weather_for_location(lat=float(lat), lng=float(lng))
            signal_doc = _normalize_weather_signal_for_port(port, payload)

            if not signal_doc:
                skipped += 1
                continue

            await db.weather_signals.insert_one(signal_doc)
            inserted += 1
        except Exception as exc:
            errors.append(
                {
                    "port_name": port.get("port_name"),
                    "error": str(exc),
                }
            )

    return {
        "total_ports": len(ports),
        "inserted": inserted,
        "skipped": skipped,
        "errors": errors[:20],
    }


async def ingest_news_signals_for_all_ports() -> Dict[str, Any]:
    db = get_database()
    ports = await _get_active_ports()

    inserted = 0
    skipped = 0
    errors: List[Dict[str, Any]] = []

    await db.news_signals.delete_many({})

    for port in ports:
        try:
            news_entity = _port_to_news_entity(port)
            payload = await fetch_news_for_supplier(news_entity)
            signal_doc = normalize_news_signal(news_entity, payload)

            if not signal_doc:
                skipped += 1
                continue

            await db.news_signals.insert_one(signal_doc)
            inserted += 1
        except Exception as exc:
            errors.append(
                {
                    "port_name": port.get("port_name"),
                    "error": str(exc),
                }
            )

    return {
        "total_ports": len(ports),
        "inserted": inserted,
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
