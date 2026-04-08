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
    emerging = int(scores.get("emerging", 0) or 0)
    final_risk = int(scores.get("final_risk", 0) or 0)

    summary = (
        f"Route risk score is {final_risk}. "
        f"Weather={weather}, News={news}, Logistics={logistics}, Congestion={congestion}"
    )

    if emerging > 0:
        summary += f", Emerging={emerging}"

    return summary + "."


def _alert_level_from_route(route: Dict[str, Any]) -> str:
    scores = route.get("scores", {}) or {}
    final_risk = int(scores.get("final_risk", 0) or 0)
    news = int(scores.get("news", 0) or 0)
    weather = int(scores.get("weather", 0) or 0)
    logistics = int(scores.get("logistics", 0) or 0)
    congestion = int(scores.get("congestion", 0) or 0)
    emerging = int(scores.get("emerging", 0) or 0)

    if final_risk >= 60 or emerging >= 70:
        return "critical"

    if (
        final_risk >= 30
        or emerging >= 35
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
    ml = int(scores.get("ml", 0) or 0)
    emerging = int(scores.get("emerging", 0) or 0)

    return (
        final_risk >= 30
        or news >= 50
        or weather >= 50
        or logistics >= 45
        or congestion >= 45
        or ml >= 50
        or emerging >= 35
    )


async def _get_port_coordinates(preferred_port: Optional[str]) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    if not preferred_port:
        return None, None, None

    db = get_database()
    port_doc = await db.ports_master.find_one({"port_name": preferred_port})
    if not port_doc:
        return None, None, None

    return (
        port_doc.get("lat"),
        port_doc.get("lng"),
        port_doc.get("country"),
    )


def _build_alert_doc(route: Dict[str, Any]) -> Dict[str, Any]:
    scores = route.get("scores", {}) or {}
    ml_prediction = route.get("ml_prediction", {}) or {}
    emerging_impact = route.get("emerging_impact", {}) or {}

    category = _category_from_scores(scores)

    origin_port = route.get("origin_port")
    destination_port = route.get("destination_port")
    route_key = route.get("route_key")

    return {
        "alert_id": f"route::{route_key}",
        "entity_type": "route",
        "entity_id": route_key,
        "route_key": route_key,
        "title": _build_alert_title(route, category),
        "summary": _build_alert_summary(route, scores),
        "category": category,
        "level": _alert_level_from_route(route),
        "status": "active",
        "timestamp": route.get("snapshot_time") or datetime.now(timezone.utc),
        "location": f"{origin_port or 'Unknown'} → {destination_port or 'Unknown'}",
        "origin_port": origin_port,
        "destination_port": destination_port,
        "risk_score": int(scores.get("final_risk", 0) or 0),
        "scores": {
            "weather": int(scores.get("weather", 0) or 0),
            "news": int(scores.get("news", 0) or 0),
            "logistics": int(scores.get("logistics", 0) or 0),
            "congestion": int(scores.get("congestion", 0) or 0),
            "emerging": int(scores.get("emerging", 0) or 0),
            "ml": int(scores.get("ml", 0) or 0),
            "final_risk": int(scores.get("final_risk", 0) or 0),
        },
        "ml_prediction": {
            "disruption_probability": float(
                ml_prediction.get("disruption_probability", 0) or 0
            ),
            "ml_risk_score": int(ml_prediction.get("ml_risk_score", 0) or 0),
            "predicted_delay_hours": float(
                ml_prediction.get("predicted_delay_hours", 0) or 0
            ),
            "top_factors": list(ml_prediction.get("top_factors", []) or []),
        },
        "emerging_impact": {
            "score": int(emerging_impact.get("score", 0) or 0),
            "top_ports": list(emerging_impact.get("top_ports", []) or []),
            "signals": list(emerging_impact.get("signals", []) or []),
        },
        "top_drivers": list(route.get("top_drivers", []) or []),
        "updated_at": route.get("snapshot_time") or datetime.now(timezone.utc),
    }


async def generate_alerts_from_snapshots() -> Dict[str, Any]:
    db = get_database()

    snapshots = (
        await db.risk_snapshots.find({"entity_type": "route"})
        .sort("snapshot_time", -1)
        .to_list(length=5000)
    )

    await db.alerts.delete_many({})

    inserted = 0
    skipped = 0
    processed_route_keys = set()

    for route in snapshots:
        route_key = route.get("route_key")
        if not route_key or route_key in processed_route_keys:
            continue

        processed_route_keys.add(route_key)

        if not _should_create_alert(route):
            skipped += 1
            continue

        alert_doc = _build_alert_doc(route)

        preferred_port = route.get("destination_port") or route.get("origin_port")
        lat, lng, country = await _get_port_coordinates(preferred_port)

        if lat is not None:
            alert_doc["lat"] = lat
        if lng is not None:
            alert_doc["lng"] = lng
        if country:
            alert_doc["country"] = country

        await db.alerts.insert_one(alert_doc)
        inserted += 1

    return {
        "success": True,
        "routes_evaluated": len(processed_route_keys),
        "alerts_upserted": inserted,
        "skipped": skipped,
    }


async def list_alerts(limit: int = 50) -> List[Dict[str, Any]]:
    db = get_database()
    docs = (
        await db.alerts.find({})
        .sort("timestamp", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [_serialize_doc(doc) for doc in docs]


async def get_alert_summary() -> Dict[str, Any]:
    db = get_database()
    alerts = await db.alerts.find({}).to_list(length=5000)

    total_alerts = len(alerts)
    active_alerts = sum(1 for a in alerts if a.get("status") == "active")
    critical_alerts = sum(1 for a in alerts if a.get("level") == "critical")
    warning_alerts = sum(1 for a in alerts if a.get("level") == "warning")

    category_counts: Dict[str, int] = {}
    for alert in alerts:
        category = alert.get("category", "unknown")
        category_counts[category] = category_counts.get(category, 0) + 1

    top_category = (
        max(category_counts.items(), key=lambda x: x[1])[0]
        if category_counts
        else "none"
    )

    return {
        "total_alerts": total_alerts,
        "active_alerts": active_alerts,
        "critical_alerts": critical_alerts,
        "warning_alerts": warning_alerts,
        "top_category": top_category,
    }


async def update_alert_status(alert_id: str, status: str) -> Dict[str, Any]:
    db = get_database()

    await db.alerts.update_one(
        {"alert_id": alert_id},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    return {
        "message": "Alert status updated successfully",
        "alert_id": alert_id,
        "status": status,
    }