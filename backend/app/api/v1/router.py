from fastapi import APIRouter

from app.api.v1.suppliers import router as suppliers_router, supplier_ml_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.analytics import (
    router as analytics_router,
    dashboard_router,
    logistics_router,
    map_router,
)
from app.api.v1.signals import router as signals_router
from app.api.v1.ml import router as ml_router
from app.api.v1.emerging import emerging_ml_router, emerging_signals_router
from app.api.v1.alerts import mitigation_router

api_router = APIRouter()

@api_router.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}

api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(suppliers_router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["alerts"])
api_router.include_router(map_router, prefix="/map", tags=["map"])
api_router.include_router(logistics_router, prefix="/logistics", tags=["logistics"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(mitigation_router, prefix="/mitigation", tags=["mitigation"])
api_router.include_router(signals_router, prefix="/signals", tags=["signals"])
api_router.include_router(ml_router, prefix="/ml", tags=["ml"])
api_router.include_router(emerging_ml_router, prefix="/emerging-ml", tags=["emerging-ml"])
api_router.include_router(emerging_signals_router, prefix="/emerging-signals", tags=["emerging-signals"])
api_router.include_router(supplier_ml_router, prefix="/supplier-ml", tags=["supplier-ml"])
