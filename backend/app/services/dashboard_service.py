from app.core.database import db


async def get_dashboard_overview():
    total_shipments = await db.shipments_raw.count_documents({})

    pipeline = [
        {
            "$group": {
                "_id": None,
                "avg_delay": {"$avg": "$delay_hours"},
                "avg_inventory": {"$avg": "$inventory_level"}
            }
        }
    ]

    agg_result = await db.shipments_raw.aggregate(pipeline).to_list(1)

    avg_delay = agg_result[0]["avg_delay"] if agg_result else 0
    avg_inventory = agg_result[0]["avg_inventory"] if agg_result else 0

    # High risk
    high_risk_count = await db.alerts.count_documents({
        "level": "critical",
        "status": "active"
    })

    # Top region
    region_pipeline = [
        {
            "$group": {
                "_id": "$supplier_region",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]

    region_result = await db.shipments_raw.aggregate(region_pipeline).to_list(1)
    top_region = region_result[0]["_id"] if region_result else "N/A"

    return {
        "total_shipments": total_shipments,
        "avg_delay_hours": round(avg_delay, 2),
        "high_risk_shipments": high_risk_count,
        "avg_inventory": round(avg_inventory, 2),
        "top_region": top_region
    }