from pathlib import Path
import json
from typing import Any, Dict, Optional

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "data" / "models" / "port_congestion_forecast_model.pkl"
METRICS_PATH = BASE_DIR / "data" / "models" / "port_congestion_forecast_model_metrics.json"

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


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def _load_metrics() -> Optional[Dict[str, Any]]:
    if not METRICS_PATH.exists():
        return None
    try:
        with METRICS_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def port_congestion_model_is_usable() -> bool:
    global _model_approved
    if _model_approved is not None:
        return _model_approved

    metrics = _load_metrics()
    rows = int((metrics or {}).get("rows") or 0)
    r2 = safe_float(((metrics or {}).get("r2") or {}).get("target_congestion_score"), float("-inf"))
    _model_approved = rows >= MIN_ROWS and r2 >= MIN_R2
    return _model_approved


def get_port_congestion_model() -> Optional[Dict[str, Any]]:
    global _model_bundle
    if _model_bundle is not None:
        return _model_bundle
    if not port_congestion_model_is_usable():
        return None
    if not MODEL_PATH.exists():
        return None
    _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def build_port_congestion_features(
    *,
    shipment_count: float,
    avg_delay_hours: float,
    avg_customs_clearance_hours: float,
    avg_demand_volatility: float,
    weather_score: float,
    news_score: float,
    current_congestion_score: float,
) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "shipment_count": safe_float(shipment_count),
                "avg_delay_hours": safe_float(avg_delay_hours),
                "avg_customs_clearance_hours": safe_float(avg_customs_clearance_hours),
                "avg_demand_volatility": safe_float(avg_demand_volatility),
                "weather_score": safe_float(weather_score),
                "news_score": safe_float(news_score),
                "current_congestion_score": safe_float(current_congestion_score),
            }
        ]
    )


def predict_port_congestion_forecast(
    *,
    shipment_count: float,
    avg_delay_hours: float,
    avg_customs_clearance_hours: float,
    avg_demand_volatility: float,
    weather_score: float,
    news_score: float,
    current_congestion_score: float,
) -> Optional[Dict[str, Any]]:
    bundle = get_port_congestion_model()
    if not bundle:
        return None

    model = bundle.get("model")
    feature_columns = bundle.get("feature_columns") or []
    if model is None or not feature_columns:
        return None

    X = build_port_congestion_features(
        shipment_count=shipment_count,
        avg_delay_hours=avg_delay_hours,
        avg_customs_clearance_hours=avg_customs_clearance_hours,
        avg_demand_volatility=avg_demand_volatility,
        weather_score=weather_score,
        news_score=news_score,
        current_congestion_score=current_congestion_score,
    )
    X = X.reindex(columns=feature_columns, fill_value=0)

    prediction = model.predict(X)[0]
    forecast_score = clamp_score(prediction)
    uplift = clamp_score(forecast_score - safe_float(current_congestion_score))

    return {
        "forecast_congestion_score": forecast_score,
        "forecast_uplift": uplift,
        "forecast_horizon_days": 3,
    }
