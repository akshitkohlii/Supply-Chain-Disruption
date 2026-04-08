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
CSV_PATH = BASE_DIR / "data" / "raw" / "scdews_final_schema_dataset.csv"


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    rename_map = {
        "date": "timestamp",
        "units_sold": "units_sold_7d",
        "expected_time": "expected_time_hours",
        "actual_time": "actual_time_hours",
    }
    existing = {old: new for old, new in rename_map.items() if old in df.columns}
    df = df.rename(columns=existing)

    expected_columns = [
        "shipment_id",
        "timestamp",
        "product_id",
        "supplier_id",
        "supplier_name",
        "supplier_country",
        "supplier_region",
        "business_unit",
        "product_category",
        "priority_level",
        "origin_port",
        "destination_port",
        "transport_mode",
        "expected_time_hours",
        "actual_time_hours",
        "delay_hours",
        "shipment_status",
        "inventory_level",
        "safety_stock_level",
        "units_sold_7d",
        "demand_volatility",
        "order_value",
        "carrier_name",
        "temperature_control_required",
        "customs_clearance_hours",
    ]

    for col in expected_columns:
        if col not in df.columns:
            df[col] = None

    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df["timestamp"] = df["timestamp"].astype(str)

    numeric_cols = [
        "expected_time_hours",
        "actual_time_hours",
        "delay_hours",
        "inventory_level",
        "safety_stock_level",
        "units_sold_7d",
        "demand_volatility",
        "order_value",
        "customs_clearance_hours",
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    if "temperature_control_required" in df.columns:
        df["temperature_control_required"] = df["temperature_control_required"].map(
            lambda x: True if str(x).strip().lower() in {"true", "1", "yes"} else False
            if pd.notna(x)
            else None
        )

    return df.where(pd.notnull(df), None)


async def ingest() -> None:
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found at: {CSV_PATH}")

    print(f"Reading CSV from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)
    print(f"Total rows found: {len(df)}")

    df = normalize_dataframe(df)

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