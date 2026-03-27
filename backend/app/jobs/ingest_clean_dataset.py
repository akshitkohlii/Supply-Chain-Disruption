import asyncio
import math
from pathlib import Path

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "scdews"
COLLECTION_NAME = "shipments_raw"
BATCH_SIZE = 1000

BASE_DIR = Path(__file__).resolve().parents[2]
CSV_PATH = BASE_DIR / "data" / "raw" / "clean_dataset_final.csv"


async def ingest() -> None:
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found at: {CSV_PATH}")

    print(f"Reading CSV from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)

    print(f"Total rows found: {len(df)}")

    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
        df["date"] = df["date"].astype(str)

    df = df.where(pd.notnull(df), None)

    await collection.delete_many({})
    print(f"Cleared existing documents in {COLLECTION_NAME}")

    records = df.to_dict(orient="records")
    total_batches = math.ceil(len(records) / BATCH_SIZE)

    for batch_num, start in enumerate(range(0, len(records), BATCH_SIZE), start=1):
        batch = records[start:start + BATCH_SIZE]
        await collection.insert_many(batch)
        print(f"Inserted batch {batch_num}/{total_batches} ({len(batch)} rows)")

    print("Ingestion complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(ingest())