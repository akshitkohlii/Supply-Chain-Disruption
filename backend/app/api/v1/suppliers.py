from fastapi import APIRouter, HTTPException

from app.services.supplier_service import (
    get_all_suppliers,
    get_suppliers_overview,
    predict_supplier_disruption,
)

router = APIRouter()
supplier_ml_router = APIRouter()


@router.get("")
async def list_suppliers():
    try:
        return await get_all_suppliers()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch suppliers: {exc}")


@router.get("/overview")
async def suppliers_overview():
    try:
        return await get_suppliers_overview()
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch supplier overview: {exc}"
        )


@supplier_ml_router.get("/predict/{supplier_id}")
async def predict_supplier(supplier_id: str):
    try:
        return await predict_supplier_disruption(supplier_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Supplier prediction failed: {exc}")
