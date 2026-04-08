from app.core.database import get_database


async def get_dashboard_overview():
    db = get_database()

    latest_snapshots = await db.risk_snapshots.find(
        {"entity_type": "route"}
    ).sort("snapshot_time", -1).to_list(length=5000)

    latest_by_route = {}
    for snapshot in latest_snapshots:
        route_key = snapshot.get("route_key") or snapshot.get("entity_id")
        if route_key and route_key not in latest_by_route:
            latest_by_route[route_key] = snapshot

    latest_route_snapshots = list(latest_by_route.values())

    if latest_route_snapshots:
        global_risk_score = round(
            sum((snap.get("scores", {}) or {}).get("final_risk", 0) for snap in latest_route_snapshots)
            / len(latest_route_snapshots),
            2,
        )
        high_risk_routes = sum(
            1
            for snap in latest_route_snapshots
            if int((snap.get("scores", {}) or {}).get("final_risk", 0)) >= 65
        )
    else:
        global_risk_score = 0
        high_risk_routes = 0

    total_shipments = await db.shipments_raw.count_documents({})
    delayed_shipments = await db.shipments_raw.count_documents({"delay_hours": {"$gt": 0}})
    delayed_shipments_percent = round(
        (delayed_shipments / total_shipments) * 100, 2
    ) if total_shipments else 0

    route_delay_pipeline = [
        {
            "$group": {
                "_id": None,
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
            }
        }
    ]
    route_delay_result = await db.shipments_raw.aggregate(route_delay_pipeline).to_list(1)
    avg_route_delay_hours = round(
        float(route_delay_result[0]["avg_delay_hours"]) if route_delay_result else 0,
        2,
    )

    critical_alerts = await db.alerts.count_documents(
        {"level": "critical", "status": "active"}
    )

    return {
        "globalRiskScore": global_risk_score,
        "criticalAlerts": critical_alerts,
        "highRiskRoutes": high_risk_routes,
        "delayedShipmentsPercent": delayed_shipments_percent,
        "avgRouteDelayHours": avg_route_delay_hours,
    }