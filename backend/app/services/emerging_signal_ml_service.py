from pathlib import Path
from typing import Any, Dict

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "data" / "models" / "emerging_signal_model.pkl"

_model = None


def get_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
        _model = joblib.load(MODEL_PATH)
    return _model


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


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


def predict_emerging_signal(signal: Dict[str, Any]) -> Dict[str, Any]:
    model = get_model()
    X = build_signal_features(signal)

    probability = float(model.predict_proba(X)[0][1])
    emerging_score = clamp_score(probability * 100)

    return {
        "is_relevant": probability >= 0.5,
        "relevance_probability": round(probability, 4),
        "emerging_score": emerging_score,
        "risk_type": derive_risk_type(signal),
        "severity": derive_severity(signal, emerging_score),
    }