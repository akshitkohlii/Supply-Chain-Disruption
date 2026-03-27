from app.core.database import db


async def get_map_points(limit: int = 500):
    pipeline = [
        {
            "$lookup": {
                "from": "ports_master",
                "localField": "destination_port",
                "foreignField": "port_name",
                "as": "port_info",
            }
        },
        {
            "$unwind": {
                "path": "$port_info",
                "preserveNullAndEmptyArrays": True,
            }
        },
        {
            "$project": {
                "_id": 0,
                "alert_id": 1,
                "title": 1,
                "summary": 1,
                "category": 1,
                "level": 1,
                "status": 1,
                "timestamp": 1,
                "supplier_id": 1,
                "supplier_name": 1,
                "product_id": 1,
                "destination_port": 1,
                "supplier_region": 1,
                "business_unit": 1,
                "priority_level": 1,
                "delay_hours": 1,
                "weather_risk": 1,
                "port_congestion": 1,
                "lat": "$port_info.lat",
                "lng": "$port_info.lng",
                "country": "$port_info.country",
                "region": "$port_info.region",
            }
        },
        {"$limit": limit},
    ]

    points = await db.alerts.aggregate(pipeline).to_list(length=None)
    return points