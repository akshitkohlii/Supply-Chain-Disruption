import asyncio
from datetime import datetime, timezone
from typing import Optional

from app.core.database import get_database
from app.services.emerging_route_impact_service import get_route_emerging_impact
from app.services.ml_service import predict_route_disruption


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def port_signal_score(signal: Optional[dict]) -> int:
    if not signal:
        return 0
    return int(signal.get("severity", 0) or 0)


def avg_signal(*signals: Optional[dict]) -> int:
    values = [port_signal_score(s) for s in signals if s]
    if not values:
        return 0
    return clamp_score(sum(values) / len(values))


def logistics_score(route_doc: dict) -> int:
    avg_delay_hours = float(route_doc.get("avg_delay_hours") or 0)
    avg_customs_clearance_hours = float(route_doc.get("avg_customs_clearance_hours") or 0)
    avg_demand_volatility = float(route_doc.get("avg_demand_volatility") or 0)

    score = 0.0

    if avg_delay_hours >= 72:
        score += 50
    elif avg_delay_hours >= 48:
        score += 35
    elif avg_delay_hours >= 24:
        score += 20
    elif avg_delay_hours > 0:
        score += 10

    if avg_customs_clearance_hours >= 48:
        score += 20
    elif avg_customs_clearance_hours >= 24:
        score += 10

    score += min(avg_demand_volatility * 30, 20)
    return clamp_score(score)


def route_level(final_risk: int) -> str:
    if final_risk >= 60:
        return "critical"
    if final_risk >= 30:
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

    await db.risk_snapshots.delete_many({})

    routes = await db.routes_master.find({"active": {"$ne": False}}).to_list(length=100000)

    inserted = 0

    for route in routes:
        origin = route.get("origin_port")
        destination = route.get("destination_port")
        route_key = route.get("route_key")

        origin_weather = await latest_signal(origin, "weather_signals")
        destination_weather = await latest_signal(destination, "weather_signals")

        origin_news = await latest_signal(origin, "news_signals")
        destination_news = await latest_signal(destination, "news_signals")

        origin_congestion = await latest_signal(origin, "port_congestion_signals")
        destination_congestion = await latest_signal(destination, "port_congestion_signals")

        weather_score = avg_signal(origin_weather, destination_weather)
        news_score = avg_signal(origin_news, destination_news)
        congestion_score = avg_signal(origin_congestion, destination_congestion)
        logistics = logistics_score(route)

        try:
            ml_prediction = await predict_route_disruption(
                route_key=route_key,
                origin_port=origin,
                destination_port=destination,
                weather_score=weather_score,
                news_score=news_score,
                congestion_score=congestion_score,
            )
            ml_risk_score = int(ml_prediction["ml_risk_score"])
            ml_probability = float(ml_prediction["disruption_probability"])
            predicted_delay_hours = float(ml_prediction["predicted_delay_hours"])
            top_factors = ml_prediction.get("top_factors", [])
        except Exception:
            ml_risk_score = 0
            ml_probability = 0.0
            predicted_delay_hours = float(route.get("avg_delay_hours") or 0)
            top_factors = []

        emerging_impact = await get_route_emerging_impact(route)
        emerging_score = int(emerging_impact.get("score", 0) or 0)

        final_risk = clamp_score(
            0.13 * weather_score
            + 0.18 * news_score
            + 0.18 * logistics
            + 0.18 * congestion_score
            + 0.21 * ml_risk_score
            + 0.12 * emerging_score
        )

        drivers = []
        if weather_score >= 40:
          drivers.append("weather")
        if news_score >= 40:
          drivers.append("news")
        if logistics >= 40:
          drivers.append("logistics")
        if congestion_score >= 40:
          drivers.append("congestion")
        if ml_risk_score >= 40:
          drivers.append("ml")
        if emerging_score >= 25:
          drivers.append("emerging")

        snapshot = {
            "entity_type": "route",
            "entity_id": route_key,
            "route_key": route_key,
            "origin_port": origin,
            "destination_port": destination,
            "scores": {
                "weather": weather_score,
                "news": news_score,
                "logistics": logistics,
                "congestion": congestion_score,
                "ml": ml_risk_score,
                "emerging": emerging_score,
                "final_risk": final_risk,
            },
            "ml_prediction": {
                "disruption_probability": ml_probability,
                "ml_risk_score": ml_risk_score,
                "predicted_delay_hours": predicted_delay_hours,
                "top_factors": top_factors,
            },
            "emerging_impact": emerging_impact,
            "risk_level": route_level(final_risk),
            "top_drivers": drivers,
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