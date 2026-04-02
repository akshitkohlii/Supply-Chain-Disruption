from app.core.database import db


def classify_alert_level(delay_hours: float, weather_risk: float, port_congestion: float, inventory_level: float, safety_stock_level: float) -> str:
    inventory_pressure = 1 if inventory_level < safety_stock_level else 0

    score = (
        (delay_hours * 0.4)
        + (weather_risk * 25)
        + (port_congestion * 25)
        + (inventory_pressure * 15)
    )

    if score >= 45:
        return "critical"
    elif score >= 25:
        return "warning"
    return "stable"


def classify_alert_category(delay_hours: float, weather_risk: float, port_congestion: float, inventory_level: float, safety_stock_level: float) -> str:
    if weather_risk >= 0.7:
        return "climate"
    if port_congestion >= 0.7:
        return "port"
    if inventory_level < safety_stock_level:
        return "supplier"
    if delay_hours >= 20:
        return "logistics"
    return "geo"


def build_alert_title(category: str, supplier_name: str, destination_port: str) -> str:
    titles = {
        "climate": f"Weather disruption risk near {destination_port}",
        "port": f"Port congestion detected at {destination_port}",
        "supplier": f"Inventory pressure for {supplier_name}",
        "logistics": f"Shipment delay escalation for {destination_port}",
        "geo": f"Route risk signal affecting {destination_port}",
    }
    return titles.get(category, f"Supply chain risk detected for {destination_port}")


def build_alert_summary(category: str, delay_hours: float, weather_risk: float, port_congestion: float, inventory_level: float, safety_stock_level: float) -> str:
    if category == "climate":
        return f"High weather risk detected with score {round(weather_risk, 2)}."
    if category == "port":
        return f"Port congestion elevated with score {round(port_congestion, 2)}."
    if category == "supplier":
        return f"Inventory level {round(inventory_level, 2)} is below safety stock {round(safety_stock_level, 2)}."
    if category == "logistics":
        return f"Delay has reached {round(delay_hours, 2)} hours."
    return "Multiple route risk indicators exceeded normal range."


async def get_all_alerts(limit: int = 50):
    cursor = db.alerts.find({}).sort([
        ("risk_score", -1), 
        ("timestamp", -1)
    ]).limit(limit)
    alerts = await cursor.to_list(length=limit)

    for alert in alerts:
        alert["_id"] = str(alert["_id"])

    return alerts


async def get_alert_summary():
    total_alerts = await db.alerts.count_documents({})
    active_alerts = await db.alerts.count_documents({"status": "active"})
    critical_alerts = await db.alerts.count_documents({"level": "critical"})
    warning_alerts = await db.alerts.count_documents({"level": "warning"})

    top_category_pipeline = [
        {
            "$group": {
                "_id": "$category",
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"count": -1}},
        {"$limit": 1}
    ]

    result = await db.alerts.aggregate(top_category_pipeline).to_list(1)
    top_category = result[0]["_id"] if result else "N/A"

    return {
        "total_alerts": total_alerts,
        "active_alerts": active_alerts,
        "critical_alerts": critical_alerts,
        "warning_alerts": warning_alerts,
        "top_category": top_category
    }


async def update_alert_status(alert_id: str, status: str):
    result = await db.alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {"status": status}}
    )
    return result.modified_count > 0