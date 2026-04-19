from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd

from app.core.database import get_database

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "data" / "models" / "emerging_signal_model.pkl"

_model = None


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def _get_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
        _model = joblib.load(MODEL_PATH)
    return _model


def _serialize_docs(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []

    for doc in docs:
        item = dict(doc)
        if "_id" in item:
            item["_id"] = str(item["_id"])
        serialized.append(item)

    return serialized


def build_signal_features(signal: Dict[str, Any]) -> pd.DataFrame:
    row = {
        "combined_text": (
            f"{signal.get('title', '')} {signal.get('summary', '')} "
            f"{signal.get('port_name', '')} {signal.get('country', '')}"
        ).strip(),
        "source_type": signal.get("source_type", "unknown"),
        "keyword_hits": signal.get("keyword_hits", 0),
        "sentiment_score": signal.get("sentiment_score", 0),
        "contains_disruption_terms": signal.get("contains_disruption_terms", 0),
        "published_age_hours": signal.get("published_age_hours", 0),
        "temperature_c": signal.get("temperature_c", 0),
        "precipitation_mm": signal.get("precipitation_mm", 0),
        "wind_speed_kmh": signal.get("wind_speed_kmh", 0),
        "weather_score": signal.get("weather_score", 0),
        "shipment_count": signal.get("shipment_count", 0),
        "avg_delay_hours": signal.get("avg_delay_hours", 0),
        "avg_customs_clearance_hours": signal.get("avg_customs_clearance_hours", 0),
        "congestion_score": signal.get("congestion_score", 0),
    }

    return pd.DataFrame([row])


def derive_risk_type(signal: Dict[str, Any]) -> str:
    source_type = signal.get("source_type", "").lower()

    if source_type == "weather":
        return "weather"

    if source_type == "congestion":
        return "congestion"

    text = f"{signal.get('title', '')} {signal.get('summary', '')}".lower()

    if any(word in text for word in ["strike", "shutdown", "sanction", "war", "conflict"]):
        return "geo"

    if any(word in text for word in ["delay", "backlog", "port", "customs", "shipment"]):
        return "logistics"

    return "mixed"


def derive_severity(signal: Dict[str, Any], relevance_score: int) -> str:
    weather_score = float(signal.get("weather_score", 0) or 0)
    congestion_score = float(signal.get("congestion_score", 0) or 0)
    delay = float(signal.get("avg_delay_hours", 0) or 0)

    severity_value = max(relevance_score, weather_score, congestion_score, delay)

    if severity_value >= 70:
        return "high"
    if severity_value >= 40:
        return "medium"
    return "low"


def _heuristic_signal_probability(signal: Dict[str, Any]) -> float:
    source_type = str(signal.get("source_type") or "").lower()

    if source_type == "congestion":
        congestion_score = _safe_float(signal.get("congestion_score"), 0)
        avg_delay = _safe_float(signal.get("avg_delay_hours"), 0)
        shipment_count = _safe_float(signal.get("shipment_count"), 0)
        customs = _safe_float(signal.get("avg_customs_clearance_hours"), 0)

        return min(
            0.95,
            (
                min(100.0, congestion_score) * 0.60
                + min(100.0, (avg_delay / 48.0) * 100.0) * 0.20
                + min(100.0, (shipment_count / 250.0) * 100.0) * 0.10
                + min(100.0, (customs / 36.0) * 100.0) * 0.10
            )
            / 100.0,
        )

    if source_type == "weather":
        weather_score = _safe_float(signal.get("weather_score"), 0)
        precipitation = _safe_float(signal.get("precipitation_mm"), 0)
        wind = _safe_float(signal.get("wind_speed_kmh"), 0)

        return min(
            0.92,
            (
                min(100.0, weather_score) * 0.60
                + min(100.0, (precipitation / 40.0) * 100.0) * 0.20
                + min(100.0, (wind / 80.0) * 100.0) * 0.20
            )
            / 100.0,
        )

    keyword_hits = _safe_float(signal.get("keyword_hits"), 0)
    disruption_terms = _safe_float(signal.get("contains_disruption_terms"), 0)
    sentiment_score = abs(_safe_float(signal.get("sentiment_score"), 0))
    published_age = _safe_float(signal.get("published_age_hours"), 0)
    recency_score = max(0.0, 100.0 - min(100.0, (published_age / 48.0) * 100.0))

    return min(
        0.88,
        (
            min(100.0, keyword_hits * 15.0) * 0.35
            + min(100.0, disruption_terms * 100.0) * 0.30
            + min(100.0, sentiment_score * 100.0) * 0.15
            + recency_score * 0.20
        )
        / 100.0,
    )


def calibrate_signal_probability(signal: Dict[str, Any], raw_probability: float) -> float:
    heuristic_probability = _heuristic_signal_probability(signal)
    blended_probability = (raw_probability * 0.62) + (heuristic_probability * 0.38)
    calibrated_probability = heuristic_probability + (
        (blended_probability - heuristic_probability) * 0.65
    )
    return max(0.02, min(0.96, round(calibrated_probability, 4)))


def predict_emerging_signal(signal: Dict[str, Any]) -> Dict[str, Any]:
    model = _get_model()
    features = build_signal_features(signal)

    raw_probability = float(model.predict_proba(features)[0][1])
    probability = calibrate_signal_probability(signal, raw_probability)
    emerging_score = _clamp_score(probability * 100)

    return {
        "is_relevant": probability >= 0.5,
        "relevance_probability": round(probability, 4),
        "emerging_score": emerging_score,
        "risk_type": derive_risk_type(signal),
        "severity": derive_severity(signal, emerging_score),
    }


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


def _source_weight(source_type: str) -> float:
    if source_type == "news":
        return 1.0
    if source_type == "weather":
        return 0.9
    if source_type == "congestion":
        return 0.95
    return 0.75


def _severity_weight(severity: str) -> float:
    if severity == "high":
        return 1.0
    if severity == "medium":
        return 0.65
    return 0.35


def _risk_type_weight(risk_type: str) -> float:
    if risk_type in {"geo", "logistics", "congestion", "weather"}:
        return 1.0
    return 0.8


def compute_signal_impact(signal: Dict[str, Any]) -> int:
    base = _safe_float(signal.get("emerging_score"), 0)
    relevance_prob = _safe_float(signal.get("relevance_probability"), 0)
    source_type = str(signal.get("source_type") or "")
    severity = str(signal.get("severity") or "low")
    risk_type = str(signal.get("risk_type") or "mixed")

    weighted = (
        base
        * _source_weight(source_type)
        * _severity_weight(severity)
        * _risk_type_weight(risk_type)
        * (0.75 + relevance_prob * 0.25)
    )

    return _clamp_score(weighted * 0.35)


async def get_route_emerging_impact(route_doc: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()

    origin_port = route_doc.get("origin_port")
    destination_port = route_doc.get("destination_port")

    relevant_signals = await db.emerging_signals.find(
        {
            "is_relevant": True,
            "port_name": {"$in": [origin_port, destination_port]},
        }
    ).sort([("emerging_score", -1), ("updated_at", -1)]).to_list(length=50)

    if not relevant_signals:
        return {
            "score": 0,
            "signals": [],
            "top_ports": [],
        }

    impacts: List[Dict[str, Any]] = []
    total = 0.0

    for signal in relevant_signals:
        impact_score = compute_signal_impact(signal)
        if impact_score <= 0:
            continue

        impacts.append(
            {
                "signal_id": signal.get("signal_id"),
                "source_type": signal.get("source_type"),
                "risk_type": signal.get("risk_type"),
                "severity": signal.get("severity"),
                "port_name": signal.get("port_name"),
                "emerging_score": signal.get("emerging_score"),
                "impact_score": impact_score,
                "title": signal.get("title"),
            }
        )
        total += impact_score

    impacts.sort(key=lambda item: item["impact_score"], reverse=True)

    combined = _clamp_score(min(100.0, total))
    top_ports = list(
        dict.fromkeys(
            [item["port_name"] for item in impacts if item.get("port_name")]
        )
    )

    return {
        "score": combined,
        "signals": impacts[:5],
        "top_ports": top_ports[:3],
    }
