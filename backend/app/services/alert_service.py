from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.core.database import get_database


def _serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    if "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


def _category_from_scores(scores: Dict[str, Any]) -> str:
    weather = int(scores.get("weather", 0) or 0)
    news = int(scores.get("news", 0) or 0)
    logistics = int(scores.get("logistics", 0) or 0)
    congestion = int(scores.get("congestion", 0) or 0)

    if weather >= 60:
        return "climate"
    if logistics >= 50 or congestion >= 50:
        return "logistics"
    if news >= 70:
        return "geo"
    return "logistics"


def _build_alert_title(route: Dict[str, Any], category: str) -> str:
    origin = route.get("origin_port") or "Unknown origin"
    destination = route.get("destination_port") or "Unknown destination"

    if category == "climate":
        return f"Weather disruption risk on {origin} → {destination}"
    if category == "logistics":
        return f"Logistics disruption risk on {origin} → {destination}"
    return f"News disruption risk on {origin} → {destination}"


def _build_alert_summary(route: Dict[str, Any], scores: Dict[str, Any]) -> str:
    weather = int(scores.get("weather", 0) or 0)
    news = int(scores.get("news", 0) or 0)
    logistics = int(scores.get("logistics", 0) or 0)
    congestion = int(scores.get("congestion", 0) or 0)
    final_risk = int(scores.get("final_risk", 0) or 0)

    return (
        f"Route risk score is {final_risk}. "
        f"Weather={weather}, News={news}, Logistics={logistics}, Congestion={congestion}."
    )


def _alert_level_from_route(route: Dict[str, Any]) -> str:
    scores = route.get("scores", {}) or {}
    final_risk = int(scores.get("final_risk", 0) or 0)
    news = int(scores.get("news", 0) or 0)
    weather = int(scores.get("weather", 0) or 0)
    logistics = int(scores.get("logistics", 0) or 0)
    congestion = int(scores.get("congestion", 0) or 0)

    if final_risk >= 65:
        return "critical"

    if (
        final_risk >= 35
        or (news >= 80 and (logistics >= 30 or congestion >= 30))
        or (weather >= 80 and congestion >= 30)
        or logistics >= 60
        or congestion >= 60
    ):
        return "warning"

    return "stable"


def _should_create_alert(route: Dict[str, Any]) -> bool:
    scores = route.get("scores", {}) or {}
    final_risk = int(scores.get("final_risk", 0) or 0)
    news = int(scores.get("news", 0) or 0)
    weather = int(scores.get("weather", 0) or 0)
    logistics = int(scores.get("logistics", 0) or 0)
    congestion = int(scores.get("congestion", 0) or 0)

    return (
        final_risk >= 35
        or (news >= 70 and (logistics >= 25 or congestion >= 25))
        or (weather >= 70 and congestion >= 25)
        or logistics >= 60
        or congestion >= 60
    )


async def _get_port_coordinates(port_name: Optional[str]) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    if not port_name:
        return None, None, None

    db = get_database()
    port = await db.ports_master.find_one({"port_name": port_name})
    if not port:
        return None, None, None

    return port.get("lat"), port.get("lng"), port.get("country")


async def _build_alert_doc(route: Dict[str, Any]) -> Dict[str, Any]:
    scores = route.get("scores", {}) or {}
    category = _category_from_scores(scores)
    level = _alert_level_from_route(route)
    route_key = route.get("route_key") or route.get("entity_id")

    origin = route.get("origin_port")
    destination = route.get("destination_port")

    preferred_port = destination or origin
    lat, lng, country = await _get_port_coordinates(preferred_port)

    now = datetime.now(timezone.utc)

    return {
        "alert_id": f"route::{route_key}",
        "entity_type": "route",
        "entity_id": route_key,
        "route_key": route_key,
        "title": _build_alert_title(route, category),
        "summary": _build_alert_summary(route, scores),
        "category": category,
        "level": level,
        "status": "active",
        "timestamp": now,
        "location": f"{origin} → {destination}",
        "origin_port": origin,
        "destination_port": destination,
        "risk_score": int(scores.get("final_risk", 0) or 0),
        "scores": {
            "weather": int(scores.get("weather", 0) or 0),
            "news": int(scores.get("news", 0) or 0),
            "logistics": int(scores.get("logistics", 0) or 0),
            "congestion": int(scores.get("congestion", 0) or 0),
            "final_risk": int(scores.get("final_risk", 0) or 0),
        },
        "top_drivers": route.get("top_drivers", []),
        "lat": lat,
        "lng": lng,
        "country": country or "Unknown",
        "updated_at": now,
    }


async def generate_alerts_from_route_snapshots() -> Dict[str, Any]:
    db = get_database()

    latest_snapshots = await db.risk_snapshots.find(
        {"entity_type": "route"}
    ).sort("snapshot_time", -1).to_list(length=5000)

    latest_by_route: Dict[str, Dict[str, Any]] = {}
    for snapshot in latest_snapshots:
        route_key = snapshot.get("route_key") or snapshot.get("entity_id")
        if route_key and route_key not in latest_by_route:
            latest_by_route[route_key] = snapshot

    created_or_updated = 0
    skipped = 0

    for _, snapshot in latest_by_route.items():
        if not _should_create_alert(snapshot):
            skipped += 1
            continue

        alert_doc = await _build_alert_doc(snapshot)

        await db.alerts.update_one(
            {"alert_id": alert_doc["alert_id"]},
            {"$set": alert_doc},
            upsert=True,
        )
        created_or_updated += 1

    return {
        "success": True,
        "routes_evaluated": len(latest_by_route),
        "alerts_upserted": created_or_updated,
        "skipped": skipped,
    }


async def get_all_alerts(limit: int = 50) -> List[Dict[str, Any]]:
    db = get_database()
    cursor = db.alerts.find({}).sort(
        [("risk_score", -1), ("timestamp", -1)]
    ).limit(limit)

    alerts = await cursor.to_list(length=limit)
    return [_serialize_doc(alert) for alert in alerts]


async def get_alert_summary() -> Dict[str, Any]:
    db = get_database()

    total_alerts = await db.alerts.count_documents({})
    active_alerts = await db.alerts.count_documents({"status": "active"})
    critical_alerts = await db.alerts.count_documents({"level": "critical"})
    warning_alerts = await db.alerts.count_documents({"level": "warning"})

    top_category_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 1},
    ]

    result = await db.alerts.aggregate(top_category_pipeline).to_list(1)
    top_category = result[0]["_id"] if result else "N/A"

    return {
        "total_alerts": total_alerts,
        "active_alerts": active_alerts,
        "critical_alerts": critical_alerts,
        "warning_alerts": warning_alerts,
        "top_category": top_category,
    }


async def update_alert_status(alert_id: str, status: str) -> bool:
    db = get_database()
    result = await db.alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc)}},
    )
    return result.modified_count > 0