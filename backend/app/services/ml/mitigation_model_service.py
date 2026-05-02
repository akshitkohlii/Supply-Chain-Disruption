from pathlib import Path
import json
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "data" / "models" / "mitigation_outcome_model.pkl"
METRICS_PATH = BASE_DIR / "data" / "models" / "mitigation_outcome_model_metrics.json"

MIN_ROWS = 5000
MIN_AVG_R2 = 0.20
MIN_CORE_R2 = 0.10

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


def clamp_percent(value: float) -> int:
    return max(0, min(100, round(value)))


def _factor_flag(top_factors: List[str], pattern: str) -> int:
    joined = " ".join(top_factors).lower()
    return int(pattern in joined)


def _load_metrics() -> Optional[Dict[str, Any]]:
    if not METRICS_PATH.exists():
        return None
    try:
        with METRICS_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def _metrics_allow_model(metrics: Dict[str, Any]) -> bool:
    rows = int(metrics.get("rows") or 0)
    if rows < MIN_ROWS:
        return False

    r2 = metrics.get("r2") or {}
    risk_r2 = safe_float(r2.get("target_risk_score"), float("-inf"))
    delay_r2 = safe_float(r2.get("target_delay_hours"), float("-inf"))
    recovery_r2 = safe_float(r2.get("target_recovery_days"), float("-inf"))
    cost_r2 = safe_float(r2.get("target_cost_impact"), float("-inf"))
    avg_r2 = (risk_r2 + delay_r2 + recovery_r2 + cost_r2) / 4.0

    return (
        avg_r2 >= MIN_AVG_R2
        and risk_r2 >= MIN_CORE_R2
        and delay_r2 >= MIN_CORE_R2
        and recovery_r2 >= MIN_CORE_R2
    )


def mitigation_model_is_usable() -> bool:
    global _model_approved
    if _model_approved is not None:
        return _model_approved

    metrics = _load_metrics()
    _model_approved = bool(metrics and _metrics_allow_model(metrics))
    return _model_approved


def get_mitigation_model() -> Optional[Dict[str, Any]]:
    global _model_bundle
    if _model_bundle is not None:
        return _model_bundle
    if not mitigation_model_is_usable():
        return None
    if not MODEL_PATH.exists():
        return None
    _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def build_mitigation_features(
    *,
    scenario_type: str,
    entity_type: str,
    port_kind: str,
    baseline_risk: float,
    baseline_delay: float,
    baseline_recovery_days: float,
    ml_risk_score: float,
    weather_score: int,
    news_score: int,
    congestion_score: int,
    inventory_ratio: float,
    top_factors: List[str],
) -> pd.DataFrame:
    row = {
        "scenario_type": scenario_type,
        "entity_type": entity_type,
        "port_kind": port_kind if entity_type == "port" else "route",
        "baseline_risk": safe_float(baseline_risk),
        "baseline_delay": safe_float(baseline_delay),
        "baseline_recovery_days": safe_float(baseline_recovery_days),
        "ml_risk_score": safe_float(ml_risk_score),
        "weather_score": safe_float(weather_score),
        "news_score": safe_float(news_score),
        "congestion_score": safe_float(congestion_score),
        "inventory_ratio": safe_float(inventory_ratio, 1.0),
        "has_congestion_factor": _factor_flag(top_factors, "high port congestion"),
        "has_news_factor": _factor_flag(top_factors, "elevated disruption news pressure"),
        "has_customs_factor": _factor_flag(top_factors, "slow customs clearance baseline"),
        "has_inventory_factor": _factor_flag(top_factors, "low inventory cover versus safety stock"),
        "has_delay_factor": _factor_flag(top_factors, "above-average historical delay baseline"),
    }
    return pd.DataFrame([row])


def predict_mitigation_outcome(
    *,
    scenario_type: str,
    entity_type: str,
    port_kind: str,
    baseline_risk: float,
    baseline_delay: float,
    baseline_recovery_days: float,
    ml_risk_score: float,
    weather_score: int,
    news_score: int,
    congestion_score: int,
    inventory_ratio: float,
    top_factors: List[str],
) -> Optional[Dict[str, Any]]:
    bundle = get_mitigation_model()
    if not bundle:
        return None

    model = bundle.get("model")
    feature_columns = bundle.get("feature_columns") or []
    if model is None or not feature_columns:
        return None

    X = build_mitigation_features(
        scenario_type=scenario_type,
        entity_type=entity_type,
        port_kind=port_kind,
        baseline_risk=baseline_risk,
        baseline_delay=baseline_delay,
        baseline_recovery_days=baseline_recovery_days,
        ml_risk_score=ml_risk_score,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        inventory_ratio=inventory_ratio,
        top_factors=top_factors,
    )
    X = X.reindex(columns=feature_columns, fill_value=0)

    prediction = model.predict(X)[0]
    if len(prediction) != 4:
        return None

    return {
        "risk_score": clamp_score(prediction[0]),
        "delay_hours": round(max(1.0, safe_float(prediction[1])), 1),
        "recovery_days": round(max(0.8, safe_float(prediction[2])), 1),
        "cost_impact": clamp_percent(prediction[3]),
    }
