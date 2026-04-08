from fastapi import APIRouter, HTTPException, Query

from app.services.signal_service import (
    get_latest_news_signals,
    get_latest_weather_signals,
    ingest_news_signals_for_all_ports,
    ingest_weather_signals_for_all_ports,
)

router = APIRouter()


@router.get("/weather")
async def fetch_latest_weather_signals(limit: int = Query(50, ge=1, le=500)):
    try:
        data = await get_latest_weather_signals(limit=limit)
        return {
            "success": True,
            "count": len(data),
            "data": data,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch weather signals: {exc}")


@router.get("/news")
async def fetch_latest_news_signals(limit: int = Query(50, ge=1, le=500)):
    try:
        data = await get_latest_news_signals(limit=limit)
        return {
            "success": True,
            "count": len(data),
            "data": data,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch news signals: {exc}")


@router.post("/ingest/weather")
async def ingest_weather():
    try:
        summary = await ingest_weather_signals_for_all_ports()
        return {
            "success": True,
            "message": "Weather signals ingested successfully",
            "summary": summary,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Weather ingestion failed: {exc}")


@router.post("/ingest/news")
async def ingest_news():
    try:
        summary = await ingest_news_signals_for_all_ports()
        return {
            "success": True,
            "message": "News signals ingested successfully",
            "summary": summary,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"News ingestion failed: {exc}")