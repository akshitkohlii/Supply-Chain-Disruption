from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd

from app.core.database import get_database

BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "data" / "models" / "supplier_disruption_model.pkl"

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


def _risk_band(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def _compute_supplier_scores(
    avg_delay_hours: float,
    avg_inventory_level: float,
    avg_lead_time: float,
    shipment_share_pct: float,
    lead_time_pct: float,
    supplier_concentration_pct: float,
) -> tuple[float, float]:
    delay_component = min(40.0, avg_delay_hours * 1.1)
    lead_component = min(25.0, avg_lead_time * 0.7)

    inventory_penalty = 0.0
    if avg_inventory_level < 200:
        inventory_penalty = 22.0
    elif avg_inventory_level < 400:
        inventory_penalty = 14.0
    elif avg_inventory_level < 600:
        inventory_penalty = 6.0

    risk_score = round(
        min(100.0, delay_component + lead_component + inventory_penalty), 2
    )

    dependency_score = round(
        min(
            100.0,
            shipment_share_pct * 0.55
            + lead_time_pct * 0.20
            + supplier_concentration_pct * 0.25,
        ),
        2,
    )

    return risk_score, dependency_score


def build_route_key_from_shipment(shipment: dict) -> str:
    origin = shipment.get("origin_port") or shipment.get("tier1_origin_port")
    transit = shipment.get("transit_port") or shipment.get("tier2_transit_port")
    destination = shipment.get("destination_port") or shipment.get("tier3_destination_port")

    parts = [p for p in [origin, transit, destination] if p]
    return "|".join(parts)


def resolve_snapshot(route_key: str, latest_by_route: dict, shipment: dict):
    snap = latest_by_route.get(route_key)
    if snap:
        return snap

    origin = shipment.get("origin_port") or shipment.get("tier1_origin_port")
    destination = shipment.get("destination_port") or shipment.get("tier3_destination_port")

    for candidate in latest_by_route.values():
        if (
            candidate.get("origin_port") == origin
            and candidate.get("destination_port") == destination
        ):
            return candidate

    return None


def build_top_factors(features: Dict[str, Any]) -> List[str]:
    factors = []

    if safe_float(features.get("avg_delay_hours")) >= 18:
        factors.append("high supplier delay baseline")
    if safe_float(features.get("avg_customs_clearance_hours")) >= 18:
        factors.append("slow customs clearance")
    if safe_float(features.get("inventory_ratio")) < 0.95:
        factors.append("inventory below safety stock")
    if safe_float(features.get("avg_route_risk")) >= 35:
        factors.append("high route risk exposure")
    if safe_float(features.get("route_critical_share")) >= 0.12:
        factors.append("large share of critical routes")
    if safe_float(features.get("avg_demand_volatility")) >= 0.25:
        factors.append("high demand volatility")

    return factors[:3] if factors else ["moderate operational exposure"]


def calibrate_supplier_probability(
    features: Dict[str, Any],
    raw_probability: float,
) -> float:
    avg_delay = safe_float(features.get("avg_delay_hours"))
    avg_customs = safe_float(features.get("avg_customs_clearance_hours"))
    inventory_ratio = safe_float(features.get("inventory_ratio"), 1.0)
    avg_route_risk = safe_float(features.get("avg_route_risk"))
    avg_route_ml_risk = safe_float(features.get("avg_route_ml_risk"))
    route_warning_share = safe_float(features.get("route_warning_share"))
    route_critical_share = safe_float(features.get("route_critical_share"))
    shipment_count = safe_float(features.get("shipment_count"))

    delay_pressure = min(100.0, (avg_delay / 36.0) * 100.0)
    customs_pressure = min(100.0, (avg_customs / 30.0) * 100.0)
    inventory_pressure = min(100.0, max(0.0, (1.0 - inventory_ratio)) * 100.0)
    route_pressure = min(100.0, avg_route_risk)
    route_ml_pressure = min(100.0, avg_route_ml_risk)
    warning_pressure = min(100.0, route_warning_share * 100.0)
    critical_pressure = min(100.0, route_critical_share * 100.0)
    scale_pressure = min(100.0, (shipment_count / 150.0) * 100.0)

    baseline_probability = min(
        0.9,
        (
            delay_pressure * 0.20
            + customs_pressure * 0.15
            + inventory_pressure * 0.15
            + route_pressure * 0.18
            + route_ml_pressure * 0.10
            + warning_pressure * 0.10
            + critical_pressure * 0.07
            + scale_pressure * 0.05
        )
        / 100.0,
    )

    blended_probability = (raw_probability * 0.60) + (baseline_probability * 0.40)
    calibrated_probability = baseline_probability + (
        (blended_probability - baseline_probability) * 0.60
    )

    return max(0.03, min(0.92, round(calibrated_probability, 4)))


async def _aggregate_all_suppliers() -> List[Dict[str, Any]]:
    db = get_database()

    pipeline = [
        {
            "$group": {
                "_id": "$supplier_id",
                "supplier_name": {"$first": "$supplier_name"},
                "supplier_country": {"$first": "$supplier_country"},
                "supplier_region": {"$first": "$supplier_region"},
                "avg_delay_hours": {"$avg": "$delay_hours"},
                "avg_inventory_level": {"$avg": "$inventory_level"},
                "avg_lead_time": {"$avg": "$supplier_lead_time"},
                "shipment_count": {"$sum": 1},
            }
        }
    ]

    raw_suppliers = await db.shipments_raw.aggregate(pipeline).to_list(None)
    total_shipments = sum(int(supplier.get("shipment_count") or 0) for supplier in raw_suppliers)
    total_suppliers = max(len(raw_suppliers), 1)
    max_lead_time = max(
        (safe_float(supplier.get("avg_lead_time")) for supplier in raw_suppliers),
        default=0.0,
    )
    supplier_concentration_pct = min(100.0, round(500.0 / total_suppliers, 2))

    suppliers: List[Dict[str, Any]] = []

    for supplier in raw_suppliers:
        avg_delay = safe_float(supplier.get("avg_delay_hours"))
        avg_inventory = safe_float(supplier.get("avg_inventory_level"))
        avg_lead = safe_float(supplier.get("avg_lead_time"))
        shipment_count = int(supplier.get("shipment_count") or 0)
        shipment_share_pct = (
            (shipment_count / total_shipments) * 100.0 if total_shipments else 0.0
        )
        lead_time_pct = (
            (avg_lead / max_lead_time) * 100.0 if max_lead_time > 0 else 0.0
        )

        risk_score, dependency_score = _compute_supplier_scores(
            avg_delay_hours=avg_delay,
            avg_inventory_level=avg_inventory,
            avg_lead_time=avg_lead,
            shipment_share_pct=shipment_share_pct,
            lead_time_pct=lead_time_pct,
            supplier_concentration_pct=supplier_concentration_pct,
        )

        suppliers.append(
            {
                "supplier_id": supplier.get("_id"),
                "supplier_name": supplier.get("supplier_name") or supplier.get("_id"),
                "supplier_country": supplier.get("supplier_country") or "Unknown",
                "supplier_region": supplier.get("supplier_region") or "Unknown",
                "avg_delay_hours": round(avg_delay, 2),
                "avg_inventory_level": round(avg_inventory, 2),
                "avg_lead_time": round(avg_lead, 2),
                "shipment_count": shipment_count,
                "risk_score": risk_score,
                "dependency_score": dependency_score,
                "risk_band": _risk_band(risk_score),
            }
        )

    suppliers.sort(key=lambda x: (x["risk_score"], x["dependency_score"]), reverse=True)
    return suppliers


async def get_supplier_features(supplier_id: str) -> Optional[Dict[str, Any]]:
    db = get_database()

    shipments = await db.shipments_raw.find({"supplier_id": supplier_id}).to_list(length=50000)
    if not shipments:
        return None

    route_snapshots = (
        await db.risk_snapshots.find({"entity_type": "route"})
        .sort("snapshot_time", -1)
        .to_list(length=5000)
    )
    latest_by_route = {}
    for doc in route_snapshots:
        route_key = doc.get("route_key")
        if route_key and route_key not in latest_by_route:
            latest_by_route[route_key] = doc

    shipment_count = len(shipments)
    delay_sum = customs_sum = inventory_sum = safety_sum = volatility_sum = order_value_sum = 0.0
    route_risk_sum = route_ml_sum = 0.0
    warning_count = critical_count = 0

    sample = shipments[0]

    for shipment in shipments:
        delay_sum += safe_float(shipment.get("delay_hours"))
        customs_sum += safe_float(
            shipment.get("customs_clearance_hours", shipment.get("custom_clearance_hours"))
        )
        inventory_sum += safe_float(shipment.get("inventory_level"))
        safety_sum += safe_float(shipment.get("safety_stock_level"))
        volatility_sum += safe_float(shipment.get("demand_volatility"))
        order_value_sum += safe_float(
            shipment.get("order_value", shipment.get("shipment_value", shipment.get("invoice_value")))
        )

        route_key = build_route_key_from_shipment(shipment)
        snap = resolve_snapshot(route_key, latest_by_route, shipment)
        scores = (snap or {}).get("scores") or {}

        route_risk = safe_float(scores.get("final_risk"))
        route_ml = safe_float(scores.get("ml"))

        route_risk_sum += route_risk
        route_ml_sum += route_ml

        if route_risk >= 30:
            warning_count += 1
        if route_risk >= 60:
            critical_count += 1

    avg_inventory = inventory_sum / shipment_count if shipment_count else 0.0
    avg_safety = safety_sum / shipment_count if shipment_count else 0.0
    inventory_gap = avg_inventory - avg_safety
    inventory_ratio = avg_inventory / max(avg_safety, 1.0)

    avg_delay = delay_sum / shipment_count if shipment_count else 0.0
    avg_customs = customs_sum / shipment_count if shipment_count else 0.0
    avg_volatility = volatility_sum / shipment_count if shipment_count else 0.0
    avg_order_value = order_value_sum / shipment_count if shipment_count else 0.0
    avg_route_risk = route_risk_sum / shipment_count if shipment_count else 0.0
    avg_route_ml = route_ml_sum / shipment_count if shipment_count else 0.0
    route_warning_share = warning_count / shipment_count if shipment_count else 0.0
    route_critical_share = critical_count / shipment_count if shipment_count else 0.0

    return {
        "supplier_id": supplier_id,
        "supplier_name": sample.get("supplier_name") or supplier_id,
        "supplier_country": sample.get("supplier_country") or "Unknown",
        "supplier_region": sample.get("supplier_region") or "Unknown",
        "business_unit": sample.get("business_unit") or "Unknown",
        "shipment_count": int(shipment_count),
        "avg_delay_hours": round(safe_float(avg_delay), 2),
        "avg_customs_clearance_hours": round(safe_float(avg_customs), 2),
        "avg_inventory_level": round(safe_float(avg_inventory), 2),
        "avg_safety_stock_level": round(safe_float(avg_safety), 2),
        "inventory_gap": round(safe_float(inventory_gap), 2),
        "inventory_ratio": round(safe_float(inventory_ratio, 1.0), 3),
        "avg_demand_volatility": round(safe_float(avg_volatility), 4),
        "avg_order_value": round(safe_float(avg_order_value), 2),
        "avg_route_risk": round(safe_float(avg_route_risk), 2),
        "avg_route_ml_risk": round(safe_float(avg_route_ml), 2),
        "route_warning_share": round(safe_float(route_warning_share), 3),
        "route_critical_share": round(safe_float(route_critical_share), 3),
    }


def build_model_frame(features: Dict[str, Any]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "supplier_country": features["supplier_country"],
                "supplier_region": features["supplier_region"],
                "business_unit": features["business_unit"],
                "shipment_count": features["shipment_count"],
                "avg_delay_hours": features["avg_delay_hours"],
                "avg_customs_clearance_hours": features["avg_customs_clearance_hours"],
                "avg_inventory_level": features["avg_inventory_level"],
                "avg_safety_stock_level": features["avg_safety_stock_level"],
                "inventory_gap": features["inventory_gap"],
                "inventory_ratio": features["inventory_ratio"],
                "avg_demand_volatility": features["avg_demand_volatility"],
                "avg_order_value": features["avg_order_value"],
                "avg_route_risk": features["avg_route_risk"],
                "avg_route_ml_risk": features["avg_route_ml_risk"],
                "route_warning_share": features["route_warning_share"],
                "route_critical_share": features["route_critical_share"],
            }
        ]
    )


async def get_suppliers_overview():
    db = get_database()

    total_suppliers = len(await db.shipments_raw.distinct("supplier_id"))
    suppliers = await _aggregate_all_suppliers()

    high_risk_suppliers = len([supplier for supplier in suppliers if supplier["risk_score"] >= 70])
    medium_risk_suppliers = len(
        [supplier for supplier in suppliers if 40 <= supplier["risk_score"] < 70]
    )
    low_risk_suppliers = len([supplier for supplier in suppliers if supplier["risk_score"] < 40])

    avg_risk_score = (
        round(sum(supplier["risk_score"] for supplier in suppliers) / len(suppliers), 2)
        if suppliers
        else 0
    )

    return {
        "total_suppliers": total_suppliers,
        "high_risk_suppliers": high_risk_suppliers,
        "medium_risk_suppliers": medium_risk_suppliers,
        "low_risk_suppliers": low_risk_suppliers,
        "avg_risk_score": avg_risk_score,
        "suppliers": suppliers,
    }


async def get_all_suppliers() -> List[Dict[str, Any]]:
    return await _aggregate_all_suppliers()


async def predict_supplier_disruption(supplier_id: str) -> Dict[str, Any]:
    features = await get_supplier_features(supplier_id)
    if not features:
        raise ValueError("Supplier not found")

    model = get_model()
    frame = build_model_frame(features)

    raw_probability = safe_float(model.predict_proba(frame)[0][1], 0.0)
    probability = calibrate_supplier_probability(features, raw_probability)
    risk_score = clamp_score(probability * 100)

    if probability >= 0.70:
        label = "critical"
    elif probability >= 0.40:
        label = "warning"
    else:
        label = "stable"

    predicted_delay_hours = round(
        min(
            max(
                2.0,
                safe_float(features["avg_delay_hours"])
                + safe_float(features["avg_customs_clearance_hours"]) * 0.22
                + max(0.0, (1 - safe_float(features["inventory_ratio"], 1.0))) * 8
                + safe_float(features["avg_route_risk"]) * 0.04
                + safe_float(features["avg_route_ml_risk"]) * 0.025
                + safe_float(features["route_critical_share"]) * 10
                + probability * 6,
            ),
            safe_float(features["avg_delay_hours"]) + 18.0,
        ),
        2,
    )

    return {
        "supplier_id": supplier_id,
        "supplier_name": features["supplier_name"],
        "disruption_probability": round(safe_float(probability), 4),
        "predicted_label": label,
        "supplier_risk_score": int(risk_score),
        "predicted_delay_hours": round(safe_float(predicted_delay_hours), 2),
        "top_factors": build_top_factors(features),
        "features": features,
    }
