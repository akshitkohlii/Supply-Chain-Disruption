from pathlib import Path
import json
from typing import Any, Dict, Optional

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "data" / "models" / "news_relevance_model.pkl"
METRICS_PATH = BASE_DIR / "data" / "models" / "news_relevance_model_metrics.json"

MIN_ROWS = 1000
MIN_F1 = 0.75

_model_bundle = None
_model_approved = None


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


def _load_metrics() -> Optional[Dict[str, Any]]:
    if not METRICS_PATH.exists():
        return None
    try:
        with METRICS_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def news_relevance_model_is_usable() -> bool:
    global _model_approved
    if _model_approved is not None:
        return _model_approved

    metrics = _load_metrics()
    rows = int((metrics or {}).get("rows") or 0)
    f1 = safe_float((metrics or {}).get("f1"), float("-inf"))
    _model_approved = rows >= MIN_ROWS and f1 >= MIN_F1 and MODEL_PATH.exists()
    return _model_approved


def get_news_relevance_model() -> Optional[Dict[str, Any]]:
    global _model_bundle
    if _model_bundle is not None:
        return _model_bundle
    if not news_relevance_model_is_usable():
        return None
    _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def build_news_relevance_features(features: Dict[str, Any]) -> pd.DataFrame:
    combined_text = (
        f"{features.get('title', '')} {features.get('summary', '')} "
        f"{features.get('port_name', '')} {features.get('country', '')}"
    ).strip()

    return pd.DataFrame(
        [
            {
                "combined_text": combined_text,
                "port_name": str(features.get("port_name") or ""),
                "country": str(features.get("country") or ""),
                "keyword_hits": safe_float(features.get("keyword_hits")),
                "strong_disruption_hits": safe_float(features.get("strong_disruption_hits")),
                "port_context_hits": safe_float(features.get("port_context_hits")),
                "exact_port_mentions": safe_float(features.get("exact_port_mentions")),
                "hotspot_article_count": safe_float(features.get("hotspot_article_count")),
                "sentiment_score": safe_float(features.get("sentiment_score")),
                "contains_disruption_terms": safe_float(features.get("contains_disruption_terms")),
                "published_age_hours": safe_float(features.get("published_age_hours")),
                "name_match": safe_float(features.get("name_match")),
                "country_match": safe_float(features.get("country_match")),
                "hotspot_match": safe_float(features.get("hotspot_match")),
                "relevance_score": safe_float(features.get("relevance_score")),
            }
        ]
    )


def predict_news_relevance(features: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    bundle = get_news_relevance_model()
    if not bundle:
        return None

    model = bundle.get("model")
    threshold = safe_float(bundle.get("threshold"), 0.6)
    if model is None:
        return None

    X = build_news_relevance_features(features)
    probability = float(model.predict_proba(X)[0][1])
    return {
        "relevance_probability": round(probability, 4),
        "is_relevant": probability >= threshold,
        "threshold": round(threshold, 4),
    }
