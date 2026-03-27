from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.suppliers import router as suppliers_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.map import router as map_router
from app.api.v1.logistics import router as logistics_router
from app.api.v1.analytics import router as analytics_router

api_router = APIRouter()

api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(suppliers_router, prefix="/suppliers", tags=["suppliers"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["alerts"])
api_router.include_router(map_router, prefix="/map", tags=["map"])
api_router.include_router(logistics_router, prefix="/logistics", tags=["logistics"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])