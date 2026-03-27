import asyncio
from datetime import datetime
from app.core.database import db
from app.services.alert_service import (
    classify_alert_level,
    classify_alert_category,
    build_alert_title,
    build_alert_summary,
)


async def generate_alerts():
    await db.alerts.delete_many({})
    print("Cleared old alerts")

    cursor = db.shipments_raw.find({})
    shipments = await cursor.to_list(length=None)

    alert_docs = []

    for item in shipments:
        delay_hours = float(item.get("delay_hours", 0) or 0)
        weather_risk = float(item.get("weather_risk", 0) or 0)
        port_congestion = float(item.get("port_congestion", 0) or 0)
        inventory_level = float(item.get("inventory_level", 0) or 0)
        safety_stock_level = float(item.get("safety_stock_level", 0) or 0)

        level = classify_alert_level(
            delay_hours=delay_hours,
            weather_risk=weather_risk,
            port_congestion=port_congestion,
            inventory_level=inventory_level,
            safety_stock_level=safety_stock_level,
        )

        if level == "stable":
            continue

        category = classify_alert_category(
            delay_hours=delay_hours,
            weather_risk=weather_risk,
            port_congestion=port_congestion,
            inventory_level=inventory_level,
            safety_stock_level=safety_stock_level,
        )

        supplier_name = item.get("supplier_name", "Unknown Supplier")
        destination_port = item.get("tier3_destination_port", "Unknown Port")

        alert_id = f"ALT_{str(item.get('_id'))[-8:]}"
        timestamp = item.get("date") or str(datetime.utcnow())

        alert_docs.append({
            "alert_id": alert_id,
            "title": build_alert_title(category, supplier_name, destination_port),
            "summary": build_alert_summary(
                category,
                delay_hours,
                weather_risk,
                port_congestion,
                inventory_level,
                safety_stock_level,
            ),
            "category": category,
            "level": level,
            "status": "active",
            "timestamp": timestamp,
            "supplier_id": item.get("supplier_id"),
            "supplier_name": supplier_name,
            "product_id": item.get("product_id"),
            "origin_port": item.get("tier1_origin_port"),
            "transit_port": item.get("tier2_transit_port"),
            "destination_port": destination_port,
            "delay_hours": delay_hours,
            "weather_risk": weather_risk,
            "port_congestion": port_congestion,
            "inventory_level": inventory_level,
            "safety_stock_level": safety_stock_level,
            "supplier_region": item.get("supplier_region"),
            "business_unit": item.get("business_unit"),
            "priority_level": item.get("priority_level"),
        })

    if alert_docs:
        await db.alerts.insert_many(alert_docs)

    print(f"Generated {len(alert_docs)} alerts")


if __name__ == "__main__":
    asyncio.run(generate_alerts())