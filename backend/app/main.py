import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import connect_to_mongo, close_mongo_connection
from app.services.refresh.refresh_service import auto_refresh_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect_to_mongo()
    if settings.AUTO_REFRESH_ENABLED:
        app.state.refresh_task = asyncio.create_task(auto_refresh_loop())

    try:
        yield
    finally:
        refresh_task = getattr(app.state, "refresh_task", None)
        if refresh_task is not None:
            refresh_task.cancel()
            try:
                await refresh_task
            except asyncio.CancelledError:
                pass
        close_mongo_connection()


app = FastAPI(title="SCDEWS Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
