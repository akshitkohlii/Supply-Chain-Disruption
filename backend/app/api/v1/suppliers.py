from fastapi import APIRouter
from app.services.supplier_service import get_suppliers_overview

router = APIRouter()

@router.get("/overview")
async def suppliers_overview():
    return await get_suppliers_overview()