import asyncio
from datetime import datetime, timezone
from typing import Dict, Optional

from app.core.database import get_database


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def port_signal_score(signal: Optional[dict]) -> int:
    if not signal:
        return 0
    return int(signal.get("severity", 0) or 0)


def logistics_score(route_doc: dict) -> int:
    avg_delay_hours = float(route_doc.get("avg_delay_hours") or 0)
    avg_port_congestion = float(route_doc.get("avg_port_congestion") or 0)

    score = 0.0

    if avg_delay_hours >= 72:
        score += 60
    elif avg_delay_hours >= 48:
        score += 40
    elif avg_delay_hours >= 24:
        score += 20
    elif avg_delay_hours > 0:
        score += 10

    score += avg_port_congestion * 30
    return clamp_score(score)


def route_level(final_risk: int) -> str:
    if final_risk >= 65:
        return "critical"
    if final_risk >= 35:
        return "warning"
    return "stable"


async def latest_signal(entity_id: Optional[str], signal_collection: str) -> Optional[dict]:
    if not entity_id:
        return None
    db = get_database()
    return await db[signal_collection].find_one(
        {"entity_id": entity_id},
        sort=[("fetched_at", -1)],
    )


async def main():
    db = get_database()
    routes = await db.routes_master.find({"active": {"$ne": False}}).to_list(length=100000)

    inserted = 0

    for route in routes:
        origin = route.get("origin_port")
        transit = route.get("transit_port")
        destination = route.get("destination_port")

        origin_weather = await latest_signal(origin, "weather_signals")
        transit_weather = await latest_signal(transit, "weather_signals")
        destination_weather = await latest_signal(destination, "weather_signals")

        origin_news = await latest_signal(origin, "news_signals")
        transit_news = await latest_signal(transit, "news_signals")
        destination_news = await latest_signal(destination, "news_signals")

        weather_score = clamp_score(
            (
                port_signal_score(origin_weather)
                + port_signal_score(transit_weather)
                + port_signal_score(destination_weather)
            ) / 3
        )

        news_score = clamp_score(
            (
                port_signal_score(origin_news)
                + port_signal_score(transit_news)
                + port_signal_score(destination_news)
            ) / 3
        )

        logistics = logistics_score(route)

        final_risk = clamp_score(
            0.35 * weather_score
            + 0.25 * news_score
            + 0.40 * logistics
        )

        top_drivers = []
        if weather_score >= 40:
            top_drivers.append("weather")
        if news_score >= 40:
            top_drivers.append("news")
        if logistics >= 40:
            top_drivers.append("logistics")

        snapshot = {
            "entity_type": "route",
            "entity_id": route.get("route_key"),
            "route_key": route.get("route_key"),
            "origin_port": origin,
            "transit_port": transit,
            "destination_port": destination,
            "scores": {
                "weather": weather_score,
                "news": news_score,
                "logistics": logistics,
                "final_risk": final_risk,
            },
            "risk_level": route_level(final_risk),
            "top_drivers": top_drivers,
            "snapshot_time": datetime.now(timezone.utc),
        }

        await db.risk_snapshots.insert_one(snapshot)
        inserted += 1

    print(
        {
            "success": True,
            "routes_processed": len(routes),
            "snapshots_inserted": inserted,
        }
    )


if __name__ == "__main__":
    asyncio.run(main())