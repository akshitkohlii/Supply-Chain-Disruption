import asyncio
from pathlib import Path

import pandas as pd

from app.core.database import get_database

BASE_DIR = Path(__file__).resolve().parents[2]
OUTPUT_PATH = BASE_DIR / "data" / "processed" / "supplier_training_data.csv"


def safe_float(value, default=0.0):
    try:
        if value is None:
            return default
        result = float(value)
        if result != result:
            return default
        return result
    except (TypeError, ValueError):
        return default


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

    for _, candidate in latest_by_route.items():
        if (
            candidate.get("origin_port") == origin
            and candidate.get("destination_port") == destination
        ):
            return candidate

    return None


async def main():
    db = get_database()

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

    shipments = await db.shipments_raw.find({}).to_list(length=200000)

    rows = []
    grouped = {}

    for s in shipments:
        supplier_id = s.get("supplier_id")
        if not supplier_id:
            continue

        route_key = build_route_key_from_shipment(s)
        snap = resolve_snapshot(route_key, latest_by_route, s)
        scores = (snap or {}).get("scores") or {}

        grouped.setdefault(
            supplier_id,
            {
                "supplier_id": supplier_id,
                "supplier_name": s.get("supplier_name") or supplier_id,
                "supplier_country": s.get("supplier_country") or "Unknown",
                "supplier_region": s.get("supplier_region") or "Unknown",
                "business_unit": s.get("business_unit") or "Unknown",
                "shipment_count": 0,
                "delay_sum": 0.0,
                "customs_sum": 0.0,
                "inventory_sum": 0.0,
                "safety_sum": 0.0,
                "volatility_sum": 0.0,
                "order_value_sum": 0.0,
                "route_risk_sum": 0.0,
                "route_ml_sum": 0.0,
                "warning_count": 0,
                "critical_count": 0,
            },
        )

        g = grouped[supplier_id]
        g["shipment_count"] += 1
        g["delay_sum"] += safe_float(s.get("delay_hours"))
        g["customs_sum"] += safe_float(
            s.get("customs_clearance_hours", s.get("custom_clearance_hours"))
        )
        g["inventory_sum"] += safe_float(s.get("inventory_level"))
        g["safety_sum"] += safe_float(s.get("safety_stock_level"))
        g["volatility_sum"] += safe_float(s.get("demand_volatility"))
        g["order_value_sum"] += safe_float(
            s.get("order_value", s.get("shipment_value", s.get("invoice_value")))
        )
        g["route_risk_sum"] += safe_float(scores.get("final_risk"))
        g["route_ml_sum"] += safe_float(scores.get("ml"))

        if safe_float(scores.get("final_risk")) >= 30:
            g["warning_count"] += 1
        if safe_float(scores.get("final_risk")) >= 60:
            g["critical_count"] += 1

    for _, g in grouped.items():
        count = max(g["shipment_count"], 1)
        avg_inventory = g["inventory_sum"] / count
        avg_safety = g["safety_sum"] / count
        inventory_gap = avg_inventory - avg_safety
        inventory_ratio = avg_inventory / max(avg_safety, 1)

        avg_delay = g["delay_sum"] / count
        avg_customs = g["customs_sum"] / count
        avg_volatility = g["volatility_sum"] / count
        avg_order_value = g["order_value_sum"] / count
        avg_route_risk = g["route_risk_sum"] / count
        avg_route_ml = g["route_ml_sum"] / count
        route_warning_share = g["warning_count"] / count
        route_critical_share = g["critical_count"] / count

        is_disrupted = int(
            avg_delay >= 18
            or avg_customs >= 18
            or inventory_ratio < 0.95
            or avg_route_risk >= 35
            or route_warning_share >= 0.35
            or route_critical_share >= 0.12
        )

        rows.append(
            {
                "supplier_id": g["supplier_id"],
                "supplier_name": g["supplier_name"],
                "supplier_country": g["supplier_country"],
                "supplier_region": g["supplier_region"],
                "business_unit": g["business_unit"],
                "shipment_count": count,
                "avg_delay_hours": round(avg_delay, 2),
                "avg_customs_clearance_hours": round(avg_customs, 2),
                "avg_inventory_level": round(avg_inventory, 2),
                "avg_safety_stock_level": round(avg_safety, 2),
                "inventory_gap": round(inventory_gap, 2),
                "inventory_ratio": round(inventory_ratio, 3),
                "avg_demand_volatility": round(avg_volatility, 4),
                "avg_order_value": round(avg_order_value, 2),
                "avg_route_risk": round(avg_route_risk, 2),
                "avg_route_ml_risk": round(avg_route_ml, 2),
                "route_warning_share": round(route_warning_share, 3),
                "route_critical_share": round(route_critical_share, 3),
                "is_disrupted": is_disrupted,
            }
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows).sort_values("shipment_count", ascending=False)
    df.to_csv(OUTPUT_PATH, index=False)

    print(
        {
            "success": True,
            "rows_written": len(df),
            "output_path": str(OUTPUT_PATH),
        }
    )


if __name__ == "__main__":
    asyncio.run(main())