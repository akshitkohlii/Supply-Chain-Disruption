from fastapi import APIRouter, HTTPException, Query

from app.services.emerging_signal_store_service import (
    build_emerging_signals,
    get_emerging_signals,
)

router = APIRouter()


@router.get("")
async def list_emerging_signals(
    limit: int = Query(20, ge=1, le=100),
    relevant_only: bool = Query(True),
    source_type: str | None = Query(None),
):
    try:
      return await get_emerging_signals(
          limit=limit,
          relevant_only=relevant_only,
          source_type=source_type,
      )
    except Exception as exc:
      raise HTTPException(status_code=500, detail=f"Failed to fetch emerging signals: {exc}")


@router.post("/build")
async def rebuild_emerging_signals(
    limit_per_source: int = Query(200, ge=1, le=1000),
    save_all: bool = Query(True),
):
    try:
        return await build_emerging_signals(
            limit_per_source=limit_per_source,
            save_all=save_all,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build emerging signals: {exc}")