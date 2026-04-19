from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd

from app.core.database import get_database
from app.services.route_delay_model_service import predict_route_delay_hours

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "data" / "models" / "disruption_model.pkl"

_model = None


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


def get_model():
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(f"Model not found: {MODEL_PATH}")
        _model = joblib.load(MODEL_PATH)
    return _model


async def get_route_baseline(
    route_key: Optional[str] = None,
    origin_port: Optional[str] = None,
    destination_port: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    db = get_database()

    if route_key:
        route = await db.routes_master.find_one({"route_key": route_key})
        if route:
            return route

    if origin_port and destination_port:
        route = await db.routes_master.find_one(
            {
                "origin_port": origin_port,
                "destination_port": destination_port,
            }
        )
        if route:
            return route

    return None


def build_inference_features(
    route_doc: Dict[str, Any],
    weather_score: int = 0,
    news_score: int = 0,
    congestion_score: int = 0,
) -> pd.DataFrame:
    origin = route_doc.get("origin_port") or "Unknown"
    destination = route_doc.get("destination_port") or "Unknown"

    row = {
        "route_key": route_doc.get("route_key") or f"{origin}|{destination}",
        "supplier_country": "Unknown",
        "supplier_region": "Unknown",
        "business_unit": (
            route_doc.get("business_units", ["Unknown"])[0]
            if route_doc.get("business_units")
            else "Unknown"
        ),
        "product_category": (
            route_doc.get("product_categories", ["Unknown"])[0]
            if route_doc.get("product_categories")
            else "Unknown"
        ),
        "priority_level": (
            route_doc.get("priority_levels", ["Medium"])[0]
            if route_doc.get("priority_levels")
            else "Medium"
        ),
        "transport_mode": (
            route_doc.get("transport_modes", ["Sea"])[0]
            if route_doc.get("transport_modes")
            else "Sea"
        ),
        "expected_time_hours": float(route_doc.get("avg_expected_time_hours") or 0),
        "inventory_level": float(route_doc.get("avg_inventory_level") or 0),
        "safety_stock_level": float(route_doc.get("avg_safety_stock_level") or 1),
        "units_sold_7d": float(route_doc.get("avg_units_sold_7d") or 0),
        "demand_volatility": float(route_doc.get("avg_demand_volatility") or 0),
        "order_value": float(route_doc.get("avg_order_value") or 0),
        "customs_clearance_hours": float(route_doc.get("avg_customs_clearance_hours") or 0),
        "inventory_gap": float(route_doc.get("avg_inventory_level") or 0)
        - float(route_doc.get("avg_safety_stock_level") or 0),
        "inventory_ratio": float(route_doc.get("avg_inventory_level") or 0)
        / max(float(route_doc.get("avg_safety_stock_level") or 1), 1),
        "month": 0,
        "day_of_week": 0,
    }

    expected_model_columns = [
        "route_key",
        "supplier_country",
        "supplier_region",
        "business_unit",
        "product_category",
        "priority_level",
        "transport_mode",
        "expected_time_hours",
        "inventory_level",
        "safety_stock_level",
        "units_sold_7d",
        "demand_volatility",
        "order_value",
        "customs_clearance_hours",
        "inventory_gap",
        "inventory_ratio",
        "month",
        "day_of_week",
    ]

    return pd.DataFrame([{k: row[k] for k in expected_model_columns}])


def calibrate_route_probability(
    route_doc: Dict[str, Any],
    raw_probability: float,
    weather_score: int,
    news_score: int,
    congestion_score: int,
) -> float:
    avg_delay = safe_float(route_doc.get("avg_delay_hours"))
    customs = safe_float(route_doc.get("avg_customs_clearance_hours"))
    demand_volatility = safe_float(route_doc.get("avg_demand_volatility"))
    inventory_level = safe_float(route_doc.get("avg_inventory_level"))
    safety_stock = max(safe_float(route_doc.get("avg_safety_stock_level"), 1.0), 1.0)
    expected_time = safe_float(route_doc.get("avg_expected_time_hours"))

    inventory_pressure = max(0.0, (1.0 - (inventory_level / safety_stock)) * 100.0)
    delay_pressure = min(100.0, (avg_delay / 48.0) * 100.0)
    customs_pressure = min(100.0, (customs / 36.0) * 100.0)
    volatility_pressure = min(100.0, demand_volatility * 100.0)
    transit_pressure = min(100.0, (expected_time / 240.0) * 100.0)
    external_pressure = max(weather_score, news_score, congestion_score)

    baseline_probability = min(
        0.92,
        (
            delay_pressure * 0.24
            + customs_pressure * 0.14
            + volatility_pressure * 0.12
            + inventory_pressure * 0.12
            + transit_pressure * 0.08
            + external_pressure * 0.30
        )
        / 100.0,
    )

    blended_probability = (raw_probability * 0.58) + (baseline_probability * 0.42)
    calibrated_probability = baseline_probability + (
        (blended_probability - baseline_probability) * 0.65
    )

    return max(0.03, min(0.95, round(calibrated_probability, 4)))


def estimate_delay_hours(
    route_doc: Dict[str, Any],
    weather_score: int,
    news_score: int,
    congestion_score: int,
    disruption_probability: float,
) -> float:
    baseline_delay = safe_float(route_doc.get("avg_delay_hours"))
    expected_time = safe_float(route_doc.get("avg_expected_time_hours"))
    customs_time = safe_float(route_doc.get("avg_customs_clearance_hours"))
    demand_volatility = safe_float(route_doc.get("avg_demand_volatility"))
    inventory_level = safe_float(route_doc.get("avg_inventory_level"))
    safety_stock = max(safe_float(route_doc.get("avg_safety_stock_level"), 1.0), 1.0)
    inventory_ratio = inventory_level / safety_stock

    modeled_delay = predict_route_delay_hours(
        avg_delay_hours=baseline_delay,
        expected_time_hours=expected_time,
        customs_clearance_hours=customs_time,
        demand_volatility=demand_volatility,
        inventory_ratio=inventory_ratio,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        disruption_probability=disruption_probability,
    )
    if modeled_delay is not None:
        upper_bound = max(baseline_delay + 18.0, expected_time * 0.45)
        return round(max(0.0, min(modeled_delay, upper_bound)), 2)

    signal_uplift = (
        weather_score * 0.025
        + news_score * 0.018
        + congestion_score * 0.035
    )
    probability_uplift = disruption_probability * min(14.0, max(4.0, expected_time * 0.08))
    customs_uplift = min(6.0, customs_time * 0.18)
    volatility_uplift = min(4.0, demand_volatility * 8.0)

    estimated = baseline_delay + signal_uplift + probability_uplift + customs_uplift + volatility_uplift
    upper_bound = max(baseline_delay + 18.0, expected_time * 0.45)

    return round(max(0.0, min(estimated, upper_bound)), 2)


def explain_prediction_factors(
    route_doc: Dict[str, Any],
    weather_score: int,
    news_score: int,
    congestion_score: int,
    disruption_probability: float,
) -> List[str]:
    factors: List[tuple[str, float]] = []

    avg_delay = float(route_doc.get("avg_delay_hours") or 0)
    customs = float(route_doc.get("avg_customs_clearance_hours") or 0)
    volatility = float(route_doc.get("avg_demand_volatility") or 0)
    inventory = float(route_doc.get("avg_inventory_level") or 0)
    safety_stock = float(route_doc.get("avg_safety_stock_level") or 1)
    inventory_ratio = inventory / max(safety_stock, 1)

    if weather_score > 0:
        factors.append(("elevated weather exposure", weather_score))
    if news_score > 0:
        factors.append(("elevated disruption news pressure", news_score))
    if congestion_score > 0:
        factors.append(("high port congestion", congestion_score))
    if avg_delay > 0:
        factors.append(("above-average historical delay baseline", avg_delay * 2.0))
    if customs > 0:
        factors.append(("slow customs clearance baseline", customs * 1.5))
    if volatility > 0:
        factors.append(("high demand volatility", volatility * 100))
    if inventory_ratio < 1:
        factors.append(("low inventory cover versus safety stock", (1 - inventory_ratio) * 100))
    if disruption_probability > 0:
        factors.append(("elevated ML disruption probability", disruption_probability * 100))

    factors.sort(key=lambda x: x[1], reverse=True)
    return [label for label, _ in factors[:3]]


async def predict_route_disruption(
    route_key: Optional[str] = None,
    origin_port: Optional[str] = None,
    destination_port: Optional[str] = None,
    weather_score: int = 0,
    news_score: int = 0,
    congestion_score: int = 0,
) -> Dict[str, Any]:
    route_doc = await get_route_baseline(
        route_key=route_key,
        origin_port=origin_port,
        destination_port=destination_port,
    )
    if not route_doc:
        raise ValueError("Route not found")

    model = get_model()
    X = build_inference_features(
        route_doc=route_doc,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
    )

    raw_probability = float(model.predict_proba(X)[0][1])
    probability = calibrate_route_probability(
        route_doc=route_doc,
        raw_probability=raw_probability,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
    )
    ml_risk_score = clamp_score(probability * 100)

    if probability >= 0.70:
        label = "critical"
    elif probability >= 0.40:
        label = "warning"
    else:
        label = "stable"

    predicted_delay_hours = estimate_delay_hours(
        route_doc=route_doc,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        disruption_probability=probability,
    )

    top_factors = explain_prediction_factors(
        route_doc=route_doc,
        weather_score=weather_score,
        news_score=news_score,
        congestion_score=congestion_score,
        disruption_probability=probability,
    )

    return {
        "route_key": route_doc.get("route_key"),
        "disruption_probability": round(probability, 4),
        "predicted_label": label,
        "ml_risk_score": ml_risk_score,
        "predicted_delay_hours": predicted_delay_hours,
        "top_factors": top_factors,
    }


def get_model_info() -> Dict[str, Any]:
    return {
        "model_loaded": MODEL_PATH.exists(),
        "model_path": str(MODEL_PATH) if MODEL_PATH.exists() else None,
    }
