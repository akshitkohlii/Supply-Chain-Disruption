from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.database import get_database
from app.services.emerging_signal_ml_service import predict_emerging_signal


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _serialize_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []

    for doc in docs:
        item = dict(doc)
        if "_id" in item:
            item["_id"] = str(item["_id"])
        serialized.append(item)

    return serialized


def _news_signal_to_model_input(signal: Dict[str, Any]) -> Dict[str, Any]:
    features = signal.get("features") or {}

    return {
        "source_type": "news",
        "title": signal.get("headline") or signal.get("title") or "",
        "summary": signal.get("summary") or signal.get("snippet") or "",
        "port_name": signal.get("port_name") or signal.get("entity_id") or "",
        "country": signal.get("country") or "",
        "keyword_hits": _safe_float(features.get("keyword_hits"), 0),
        "sentiment_score": _safe_float(features.get("sentiment_score"), 0),
        "contains_disruption_terms": _safe_float(features.get("contains_disruption_terms"), 0),
        "published_age_hours": _safe_float(features.get("published_age_hours"), 0),
        "temperature_c": 0,
        "precipitation_mm": 0,
        "wind_speed_kmh": 0,
        "weather_score": 0,
        "shipment_count": 0,
        "avg_delay_hours": 0,
        "avg_customs_clearance_hours": 0,
        "congestion_score": 0,
    }


def _weather_signal_to_model_input(signal: Dict[str, Any]) -> Dict[str, Any]:
    features = signal.get("features") or {}

    return {
        "source_type": "weather",
        "title": "",
        "summary": f"Weather anomaly near {signal.get('port_name', '')}".strip(),
        "port_name": signal.get("port_name") or signal.get("entity_id") or "",
        "country": signal.get("country") or "",
        "keyword_hits": 0,
        "sentiment_score": 0,
        "contains_disruption_terms": 1 if _safe_float(signal.get("severity"), 0) >= 40 else 0,
        "published_age_hours": 0,
        "temperature_c": _safe_float(features.get("temperature_c"), 0),
        "precipitation_mm": _safe_float(features.get("precipitation_mm"), 0),
        "wind_speed_kmh": _safe_float(features.get("wind_speed_kmh"), 0),
        "weather_score": _safe_float(signal.get("severity"), 0),
        "shipment_count": 0,
        "avg_delay_hours": 0,
        "avg_customs_clearance_hours": 0,
        "congestion_score": 0,
    }


def _congestion_signal_to_model_input(signal: Dict[str, Any]) -> Dict[str, Any]:
    features = signal.get("features") or {}

    return {
        "source_type": "congestion",
        "title": "",
        "summary": f"Congestion pressure near {signal.get('port_name', '')}".strip(),
        "port_name": signal.get("port_name") or signal.get("entity_id") or "",
        "country": signal.get("country") or "",
        "keyword_hits": 0,
        "sentiment_score": 0,
        "contains_disruption_terms": 1 if _safe_float(signal.get("severity"), 0) >= 40 else 0,
        "published_age_hours": 0,
        "temperature_c": 0,
        "precipitation_mm": 0,
        "wind_speed_kmh": 0,
        "weather_score": 0,
        "shipment_count": _safe_float(features.get("shipment_count"), 0),
        "avg_delay_hours": _safe_float(features.get("avg_delay_hours"), 0),
        "avg_customs_clearance_hours": _safe_float(features.get("avg_customs_clearance_hours"), 0),
        "congestion_score": _safe_float(signal.get("severity"), 0),
    }


def _base_output_doc(
    source_type: str,
    raw_signal: Dict[str, Any],
    model_input: Dict[str, Any],
    prediction: Dict[str, Any],
) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)

    source_signal_id = str(raw_signal.get("_id") or raw_signal.get("signal_id") or "")
    port_name = model_input.get("port_name") or raw_signal.get("port_name") or raw_signal.get("entity_id")
    country = model_input.get("country") or raw_signal.get("country")
    lat = raw_signal.get("lat")
    lng = raw_signal.get("lng")

    title = model_input.get("title") or model_input.get("summary") or f"{source_type.title()} signal"
    summary = model_input.get("summary") or title

    return {
        "signal_id": f"{source_type}::{source_signal_id or port_name or 'unknown'}",
        "source_signal_id": source_signal_id,
        "source_type": source_type,
        "title": title,
        "summary": summary,
        "port_name": port_name,
        "country": country,
        "lat": lat,
        "lng": lng,
        "is_relevant": prediction["is_relevant"],
        "relevance_probability": prediction["relevance_probability"],
        "emerging_score": prediction["emerging_score"],
        "risk_type": prediction["risk_type"],
        "severity": prediction["severity"],
        "model_features": model_input,
        "source_metadata": {
            "entity_type": raw_signal.get("entity_type"),
            "entity_id": raw_signal.get("entity_id"),
            "source": raw_signal.get("source"),
            "event_time": raw_signal.get("event_time"),
            "fetched_at": raw_signal.get("fetched_at"),
        },
        "created_at": now,
        "updated_at": now,
    }


async def build_emerging_signals(limit_per_source: int = 200, save_all: bool = True) -> Dict[str, Any]:
    db = get_database()

    news_docs = await db.news_signals.find({}).sort("fetched_at", -1).limit(limit_per_source).to_list(length=limit_per_source)
    weather_docs = await db.weather_signals.find({}).sort("fetched_at", -1).limit(limit_per_source).to_list(length=limit_per_source)
    congestion_docs = await db.port_congestion_signals.find({}).sort("fetched_at", -1).limit(limit_per_source).to_list(length=limit_per_source)

    await db.emerging_signals.delete_many({})

    inserted = 0
    relevant_count = 0
    skipped = 0

    for source_type, docs, mapper in [
        ("news", news_docs, _news_signal_to_model_input),
        ("weather", weather_docs, _weather_signal_to_model_input),
        ("congestion", congestion_docs, _congestion_signal_to_model_input),
    ]:
        for raw_signal in docs:
            model_input = mapper(raw_signal)
            prediction = predict_emerging_signal(model_input)

            if prediction["is_relevant"]:
                relevant_count += 1
            elif not save_all:
                skipped += 1
                continue

            output_doc = _base_output_doc(
                source_type=source_type,
                raw_signal=raw_signal,
                model_input=model_input,
                prediction=prediction,
            )

            await db.emerging_signals.insert_one(output_doc)
            inserted += 1

    return {
        "success": True,
        "news_processed": len(news_docs),
        "weather_processed": len(weather_docs),
        "congestion_processed": len(congestion_docs),
        "inserted": inserted,
        "relevant_signals": relevant_count,
        "skipped_non_relevant": skipped,
    }


async def get_emerging_signals(
    limit: int = 20,
    relevant_only: bool = True,
    source_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    db = get_database()

    query: Dict[str, Any] = {}
    if relevant_only:
        query["is_relevant"] = True
    if source_type:
        query["source_type"] = source_type

    docs = (
        await db.emerging_signals.find(query)
        .sort([("emerging_score", -1), ("updated_at", -1)])
        .limit(limit)
        .to_list(length=limit)
    )

    return _serialize_docs(docs)