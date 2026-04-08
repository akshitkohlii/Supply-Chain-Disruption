import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.database import get_database


def normalize_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def route_key(origin: Optional[str], destination: Optional[str]) -> str:
    return f"{origin or 'NA'}|{destination or 'NA'}"


async def main():
    db = get_database()

    pipeline = [
        {
            "$group": {
                "_id": {
                    "origin_port": "$origin_port",
                    "destination_port": "$destination_port",
                },
                "shipment_count": {"$sum": 1},
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                "avg_expected_time_hours": {"$avg": {"$ifNull": ["$expected_time_hours", 0]}},
                "avg_actual_time_hours": {"$avg": {"$ifNull": ["$actual_time_hours", 0]}},
                "avg_customs_clearance_hours": {"$avg": {"$ifNull": ["$customs_clearance_hours", 0]}},
                "avg_order_value": {"$avg": {"$ifNull": ["$order_value", 0]}},
                "avg_inventory_level": {"$avg": {"$ifNull": ["$inventory_level", 0]}},
                "avg_safety_stock_level": {"$avg": {"$ifNull": ["$safety_stock_level", 0]}},
                "avg_units_sold_7d": {"$avg": {"$ifNull": ["$units_sold_7d", 0]}},
                "avg_demand_volatility": {"$avg": {"$ifNull": ["$demand_volatility", 0]}},
                "product_categories": {"$addToSet": "$product_category"},
                "business_units": {"$addToSet": "$business_unit"},
                "priority_levels": {"$addToSet": "$priority_level"},
                "transport_modes": {"$addToSet": "$transport_mode"},
            }
        }
    ]

    docs = await db.shipments_raw.aggregate(pipeline).to_list(length=100000)

    output_docs: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for doc in docs:
        origin = normalize_str((doc.get("_id") or {}).get("origin_port"))
        destination = normalize_str((doc.get("_id") or {}).get("destination_port"))
        key = route_key(origin, destination)

        output_docs.append(
            {
                "_id": key,
                "route_key": key,
                "origin_port": origin,
                "destination_port": destination,
                "shipment_count": int(doc.get("shipment_count") or 0),
                "avg_delay_hours": round(float(doc.get("avg_delay_hours") or 0), 2),
                "avg_expected_time_hours": round(float(doc.get("avg_expected_time_hours") or 0), 2),
                "avg_actual_time_hours": round(float(doc.get("avg_actual_time_hours") or 0), 2),
                "avg_customs_clearance_hours": round(float(doc.get("avg_customs_clearance_hours") or 0), 2),
                "avg_order_value": round(float(doc.get("avg_order_value") or 0), 2),
                "avg_inventory_level": round(float(doc.get("avg_inventory_level") or 0), 2),
                "avg_safety_stock_level": round(float(doc.get("avg_safety_stock_level") or 0), 2),
                "avg_units_sold_7d": round(float(doc.get("avg_units_sold_7d") or 0), 2),
                "avg_demand_volatility": round(float(doc.get("avg_demand_volatility") or 0), 4),
                "product_categories": sorted([x for x in (doc.get("product_categories") or []) if x is not None]),
                "business_units": sorted([x for x in (doc.get("business_units") or []) if x is not None]),
                "priority_levels": sorted([x for x in (doc.get("priority_levels") or []) if x is not None]),
                "transport_modes": sorted([x for x in (doc.get("transport_modes") or []) if x is not None]),
                "active": True,
                "created_at": now,
                "updated_at": now,
            }
        )

    await db.routes_master.delete_many({})
    if output_docs:
        await db.routes_master.insert_many(output_docs)

    print({"success": True, "routes_created": len(output_docs)})


if __name__ == "__main__":
    asyncio.run(main())