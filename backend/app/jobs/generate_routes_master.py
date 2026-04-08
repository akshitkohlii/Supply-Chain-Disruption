import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.database import get_database


def normalize_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def route_key(origin: Optional[str], transit: Optional[str], destination: Optional[str]) -> str:
    return f"{origin or 'NA'}|{transit or 'NA'}|{destination or 'NA'}"


async def main():
    db = get_database()

    pipeline = [
        {
            "$group": {
                "_id": {
                    "origin_port": "$tier1_origin_port",
                    "transit_port": "$tier2_transit_port",
                    "destination_port": "$tier3_destination_port",
                },
                "shipment_count": {"$sum": 1},
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                "avg_expected_time_hours": {"$avg": {"$ifNull": ["$expected_time_hours", 0]}},
                "avg_actual_time_hours": {"$avg": {"$ifNull": ["$actual_time_hours", 0]}},
                "avg_route_distance_km": {"$avg": {"$ifNull": ["$route_distance_km", 0]}},
                "avg_port_congestion": {"$avg": {"$ifNull": ["$port_congestion", 0]}},
                "product_categories": {"$addToSet": "$product_category"},
                "business_units": {"$addToSet": "$business_unit"},
                "priority_levels": {"$addToSet": "$priority_level"},
            }
        }
    ]

    docs = await db.shipments_raw.aggregate(pipeline).to_list(length=100000)

    output_docs: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)

    for doc in docs:
        origin = normalize_str((doc.get("_id") or {}).get("origin_port"))
        transit = normalize_str((doc.get("_id") or {}).get("transit_port"))
        destination = normalize_str((doc.get("_id") or {}).get("destination_port"))
        key = route_key(origin, transit, destination)

        output_docs.append(
            {
                "_id": key,
                "route_key": key,
                "origin_port": origin,
                "transit_port": transit,
                "destination_port": destination,
                "shipment_count": int(doc.get("shipment_count") or 0),
                "avg_delay_hours": round(float(doc.get("avg_delay_hours") or 0), 2),
                "avg_expected_time_hours": round(float(doc.get("avg_expected_time_hours") or 0), 2),
                "avg_actual_time_hours": round(float(doc.get("avg_actual_time_hours") or 0), 2),
                "avg_route_distance_km": round(float(doc.get("avg_route_distance_km") or 0), 2),
                "avg_port_congestion": round(float(doc.get("avg_port_congestion") or 0), 4),
                "product_categories": sorted(
                    [x for x in (doc.get("product_categories") or []) if x is not None]
                ),
                "business_units": sorted(
                    [x for x in (doc.get("business_units") or []) if x is not None]
                ),
                "priority_levels": sorted(
                    [x for x in (doc.get("priority_levels") or []) if x is not None]
                ),
                "active": True,
                "created_at": now,
                "updated_at": now,
            }
        )

    await db.routes_master.delete_many({})
    if output_docs:
        await db.routes_master.insert_many(output_docs)

    print(
        {
            "success": True,
            "routes_created": len(output_docs),
        }
    )


if __name__ == "__main__":
    asyncio.run(main())