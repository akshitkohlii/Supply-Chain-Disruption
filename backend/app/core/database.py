from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


def connect_to_mongo() -> None:
    global client, db
    if client is None:
        client = AsyncIOMotorClient(settings.MONGO_URI)
        db = client[settings.DB_NAME]


def close_mongo_connection() -> None:
    global client, db
    if client is not None:
        client.close()
        client = None
        db = None


def get_database() -> AsyncIOMotorDatabase:
    global db
    if db is None:
        connect_to_mongo()
    assert db is not None
    return db