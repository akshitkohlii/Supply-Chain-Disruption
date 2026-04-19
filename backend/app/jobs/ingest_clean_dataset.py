import asyncio
import math
import os
from pathlib import Path

import pandas as pd
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "scdews"
COLLECTION_NAME = "shipments_raw"
BATCH_SIZE = 1000

BASE_DIR = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = BASE_DIR / "data" / "raw"
DEFAULT_CSV_PATH = RAW_DATA_DIR / "scdews_final_schema_dataset.csv"
FALLBACK_CSV_PATH = RAW_DATA_DIR / "clean_dataset_final.csv"


def resolve_csv_path() -> Path:
    configured = os.getenv("SHIPMENTS_CSV_PATH")
    if configured:
        return Path(configured).expanduser().resolve()
    if DEFAULT_CSV_PATH.exists():
        return DEFAULT_CSV_PATH
    return FALLBACK_CSV_PATH


def _null_if_empty(value):
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _build_route_key(row: pd.Series) -> str:
    parts = [
        row.get("origin_port"),
        row.get("transit_port"),
        row.get("destination_port"),
    ]
    cleaned = [_null_if_empty(value) for value in parts]
    return "|".join([value for value in cleaned if value]) or "NA"


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    rename_map = {
        "date": "timestamp",
        "units_sold": "units_sold_7d",
        "expected_time": "expected_time_hours",
        "actual_time": "actual_time_hours",
        "order_value_usd": "order_value",
        "tier1_origin_port": "origin_port",
        "tier2_transit_port": "transit_port",
        "tier3_destination_port": "destination_port",
    }
    existing = {old: new for old, new in rename_map.items() if old in df.columns}
    df = df.rename(columns=existing)

    if "custom_clearance_hours" in df.columns and "customs_clearance_hours" not in df.columns:
        df = df.rename(columns={"custom_clearance_hours": "customs_clearance_hours"})

    if "port_congestion" in df.columns:
        if "port_congestion_origin" not in df.columns:
            df["port_congestion_origin"] = df["port_congestion"]
        if "port_congestion_destination" not in df.columns:
            df["port_congestion_destination"] = df["port_congestion"]

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
        "origin_country",
        "origin_lat",
        "origin_lng",
        "transit_port",
        "destination_port",
        "destination_country",
        "destination_lat",
        "destination_lng",
        "route_key",
        "route_distance_km",
        "transport_mode",
        "carrier_name",
        "expected_time_hours",
        "actual_time_hours",
        "delay_hours",
        "shipment_status",
        "port_congestion_origin",
        "port_congestion_destination",
        "customs_clearance_hours",
        "inventory_level",
        "safety_stock_level",
        "units_sold_7d",
        "demand_volatility",
        "fuel_price_index",
        "order_value",
        "temperature_control_required",
    ]

    for col in expected_columns:
        if col not in df.columns:
            df[col] = None

    if "origin_country" not in df.columns or df["origin_country"].isna().all():
        df["origin_country"] = df["supplier_country"]
    if "destination_country" not in df.columns or df["destination_country"].isna().all():
        df["destination_country"] = df["supplier_country"]

    if "route_key" not in df.columns or df["route_key"].isna().all():
        df["route_key"] = df.apply(_build_route_key, axis=1)

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
        "route_distance_km",
        "origin_lat",
        "origin_lng",
        "destination_lat",
        "destination_lng",
        "port_congestion_origin",
        "port_congestion_destination",
        "fuel_price_index",
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

    string_cols = [
        "shipment_id",
        "product_id",
        "supplier_id",
        "supplier_name",
        "supplier_country",
        "supplier_region",
        "business_unit",
        "product_category",
        "priority_level",
        "origin_port",
        "origin_country",
        "transit_port",
        "destination_port",
        "destination_country",
        "route_key",
        "transport_mode",
        "carrier_name",
        "shipment_status",
    ]
    for col in string_cols:
        df[col] = df[col].map(_null_if_empty)

    return df.where(pd.notnull(df), None)


async def ingest() -> None:
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    csv_path = resolve_csv_path()

    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found at: {csv_path}")

    print(f"Reading CSV from: {csv_path}")
    df = pd.read_csv(csv_path)
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
