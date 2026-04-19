import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.services.refresh_service import auto_refresh_loop

app = FastAPI(title="SCDEWS Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    connect_to_mongo()
    if settings.AUTO_REFRESH_ENABLED:
        app.state.refresh_task = asyncio.create_task(auto_refresh_loop())


@app.on_event("shutdown")
async def shutdown_event():
    refresh_task = getattr(app.state, "refresh_task", None)
    if refresh_task is not None:
        refresh_task.cancel()
        try:
            await refresh_task
        except asyncio.CancelledError:
            pass
    close_mongo_connection()


app.include_router(api_router, prefix="/api/v1")
