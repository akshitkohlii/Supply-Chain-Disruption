from datetime import datetime, timezone
from typing import Any, Dict, List

from app.core.database import get_database


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def normalize_metric(value: float, low: float, high: float) -> float:
    if high <= low:
        return 0.0
    if value <= low:
        return 0.0
    if value >= high:
        return 100.0
    return ((value - low) / (high - low)) * 100.0


def build_port_congestion_signal_from_routes(
    port_name: str,
    route_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    shipment_count = sum(int(r.get("shipment_count") or 0) for r in route_rows)

    avg_delay_hours = (
        sum(float(r.get("avg_delay_hours") or 0) for r in route_rows) / len(route_rows)
        if route_rows
        else 0.0
    )

    avg_customs_clearance_hours = (
        sum(float(r.get("avg_customs_clearance_hours") or 0) for r in route_rows) / len(route_rows)
        if route_rows
        else 0.0
    )

    avg_demand_volatility = (
        sum(float(r.get("avg_demand_volatility") or 0) for r in route_rows) / len(route_rows)
        if route_rows
        else 0.0
    )

    shipment_pressure = normalize_metric(float(shipment_count), 5, 150)
    delay_pressure = normalize_metric(float(avg_delay_hours), 2, 72)
    customs_pressure = normalize_metric(float(avg_customs_clearance_hours), 4, 48)
    volatility_pressure = min(max(avg_demand_volatility * 100.0, 0.0), 100.0)

    congestion_score = clamp_score(
        0.30 * shipment_pressure
        + 0.30 * delay_pressure
        + 0.20 * customs_pressure
        + 0.20 * volatility_pressure
    )

    return {
        "entity_type": "port",
        "entity_id": port_name,
        "port_name": port_name,
        "signal_type": "port_congestion",
        "severity": congestion_score,
        "confidence": 0.70,
        "features": {
            "shipment_count": shipment_count,
            "avg_delay_hours": round(avg_delay_hours, 2),
            "avg_customs_clearance_hours": round(avg_customs_clearance_hours, 2),
            "avg_demand_volatility": round(avg_demand_volatility, 4),
            "shipment_pressure": round(shipment_pressure, 2),
            "delay_pressure": round(delay_pressure, 2),
            "customs_pressure": round(customs_pressure, 2),
            "volatility_pressure": round(volatility_pressure, 2),
        },
        "event_time": datetime.now(timezone.utc),
        "fetched_at": datetime.now(timezone.utc),
        "source": "derived_from_routes_master",
    }


async def ingest_port_congestion_signals() -> Dict[str, Any]:
    db = get_database()

    routes = await db.routes_master.find(
        {"active": {"$ne": False}},
        {
            "route_key": 1,
            "origin_port": 1,
            "destination_port": 1,
            "shipment_count": 1,
            "avg_delay_hours": 1,
            "avg_customs_clearance_hours": 1,
            "avg_demand_volatility": 1,
        },
    ).to_list(length=100000)

    grouped: Dict[str, List[Dict[str, Any]]] = {}

    for route in routes:
        origin = route.get("origin_port")
        destination = route.get("destination_port")

        if origin:
            grouped.setdefault(origin, []).append(route)
        if destination:
            grouped.setdefault(destination, []).append(route)

    inserted = 0

    await db.port_congestion_signals.delete_many({})

    for port_name, route_rows in grouped.items():
        signal_doc = build_port_congestion_signal_from_routes(port_name, route_rows)

        port = await db.ports_master.find_one(
            {"port_name": port_name},
            {"lat": 1, "lng": 1, "country": 1},
        )
        if port:
            signal_doc["lat"] = port.get("lat")
            signal_doc["lng"] = port.get("lng")
            signal_doc["country"] = port.get("country")

        await db.port_congestion_signals.insert_one(signal_doc)
        inserted += 1

    return {
        "success": True,
        "ports_processed": len(grouped),
        "signals_inserted": inserted,
    }


async def get_latest_port_congestion_signals(limit: int = 50):
    db = get_database()
    cursor = (
        db.port_congestion_signals.find({})
        .sort("fetched_at", -1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)

    serialized = []
    for doc in docs:
        item = dict(doc)
        if "_id" in item:
            item["_id"] = str(item["_id"])
        serialized.append(item)

    return serialized