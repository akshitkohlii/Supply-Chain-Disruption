from pathlib import Path
import json
from typing import Any, Dict, Optional

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "data" / "models" / "route_delay_forecast_model.pkl"
METRICS_PATH = BASE_DIR / "data" / "models" / "route_delay_forecast_model_metrics.json"

MIN_ROWS = 5000
MIN_R2 = 0.20

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


def route_delay_model_is_usable() -> bool:
    global _model_approved
    if _model_approved is not None:
        return _model_approved

    metrics = _load_metrics()
    rows = int((metrics or {}).get("rows") or 0)
    r2 = safe_float(((metrics or {}).get("r2") or {}).get("target_delay_hours"), float("-inf"))
    _model_approved = rows >= MIN_ROWS and r2 >= MIN_R2
    return _model_approved


def get_route_delay_model() -> Optional[Dict[str, Any]]:
    global _model_bundle
    if _model_bundle is not None:
        return _model_bundle
    if not route_delay_model_is_usable():
        return None
    if not MODEL_PATH.exists():
        return None
    _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def build_route_delay_features(
    *,
    avg_delay_hours: float,
    expected_time_hours: float,
    customs_clearance_hours: float,
    demand_volatility: float,
    inventory_ratio: float,
    weather_score: float,
    news_score: float,
    congestion_score: float,
    disruption_probability: float,
) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "avg_delay_hours": safe_float(avg_delay_hours),
                "expected_time_hours": safe_float(expected_time_hours),
                "customs_clearance_hours": safe_float(customs_clearance_hours),
                "demand_volatility": safe_float(demand_volatility),
                "inventory_ratio": safe_float(inventory_ratio, 1.0),
                "weather_score": safe_float(weather_score),
                "news_score": safe_float(news_score),
                "congestion_score": safe_float(congestion_score),
                "disruption_probability": safe_float(disruption_probability),
            }
        ]
    )


def predict_route_delay_hours(
    *,
    avg_delay_hours: float,
    expected_time_hours: float,
    customs_clearance_hours: float,
    demand_volatility: float,
    inventory_ratio: float,
    weather_score: float,
    news_score: float,
    congestion_score: float,
    disruption_probability: float,
) -> Optional[float]:
    bundle = get_route_delay_model()
    if not bundle:
        return None

    model = bundle.get("model")
    feature_columns = bundle.get("feature_columns") or []
    if model is None or not feature_columns:
        return None

    X = build_route_delay_features(
        avg_delay_hours=avg_delay_hours,
        expected_time_hours=expected_time_hours,
        customs_clearance_hours=customs_clearance_hours,
        demand_volatility=demand_volatility,
        inventory_ratio=inventory_ratio,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        disruption_probability=disruption_probability,
    )
    X = X.reindex(columns=feature_columns, fill_value=0)
    prediction = float(model.predict(X)[0])
    return round(max(0.0, prediction), 2)
