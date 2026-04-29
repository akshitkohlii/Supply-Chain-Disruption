import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "raw" / "scdews_final_schema_dataset.csv"
MODEL_DIR = BASE_DIR / "data" / "models"
MODEL_PATH = MODEL_DIR / "disruption_model.pkl"
METRICS_PATH = MODEL_DIR / "disruption_model_metrics.json"


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise ValueError("Dataset is empty.")
    return df


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    rename_map = {
        "date": "timestamp",
        "shipment_date": "timestamp",
        "units_sold": "units_sold_7d",
        "expected_time": "expected_time_hours",
        "actual_time": "actual_time_hours",
        "order_value_usd": "order_value",
    }
    existing = {old: new for old, new in rename_map.items() if old in df.columns}
    df = df.rename(columns=existing)

    expected = [
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
        "destination_port",
        "destination_country",
        "route_key",
        "route_distance_km",
        "transport_mode",
        "carrier_name",
        "sku_group",
        "expected_time_hours",
        "actual_time_hours",
        "delay_hours",
        "shipment_status",
        "port_congestion_origin",
        "port_congestion_destination",
        "fuel_price_index",
        "inventory_level",
        "safety_stock_level",
        "units_sold_7d",
        "demand_volatility",
        "order_value",
        "carrier_name",
        "temperature_control_required",
        "customs_clearance_hours",
    ]
    for col in expected:
        if col not in df.columns:
            df[col] = None

    return df


def create_target(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    delay = pd.to_numeric(df["delay_hours"], errors="coerce").fillna(0)
    customs = pd.to_numeric(df["customs_clearance_hours"], errors="coerce").fillna(0)
    status = df["shipment_status"].fillna("").astype(str).str.lower()

    df["target_disruption"] = (
        (delay >= 18)
        | (customs >= 24)
        | status.isin(["customs_hold", "port_hold", "delayed"])
    ).astype(int)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    if "route_key" not in df.columns:
        df["route_key"] = None

    missing_route_key = df["route_key"].isna() | (df["route_key"].astype(str).str.strip() == "")
    df.loc[missing_route_key, "route_key"] = (
        df.loc[missing_route_key, "origin_port"].fillna("Unknown").astype(str)
        + "|"
        + df.loc[missing_route_key, "destination_port"].fillna("Unknown").astype(str)
    )

    numeric_defaults = {
        "expected_time_hours": 0,
        "route_distance_km": 0,
        "inventory_level": 0,
        "safety_stock_level": 1,
        "units_sold_7d": 0,
        "demand_volatility": 0,
        "order_value": 0,
        "customs_clearance_hours": 0,
        "port_congestion_origin": 0,
        "port_congestion_destination": 0,
        "fuel_price_index": 0,
    }
    for col, default in numeric_defaults.items():
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(default)

    safety_stock = df["safety_stock_level"].replace(0, 1)
    df["inventory_gap"] = df["inventory_level"] - df["safety_stock_level"]
    df["inventory_ratio"] = df["inventory_level"] / safety_stock
    df["route_pressure"] = (
        df["port_congestion_origin"] * 0.45
        + df["port_congestion_destination"] * 0.55
    )

    if "timestamp" in df.columns:
        ts = pd.to_datetime(df["timestamp"], errors="coerce")
        df["month"] = ts.dt.month.fillna(0).astype(int)
        df["day_of_week"] = ts.dt.dayofweek.fillna(0).astype(int)
    else:
        df["month"] = 0
        df["day_of_week"] = 0

    return df


def select_features(df: pd.DataFrame):
    feature_columns = [
        "route_key",
        "supplier_country",
        "supplier_region",
        "business_unit",
        "product_category",
        "priority_level",
        "transport_mode",
        "carrier_name",
        "origin_country",
        "destination_country",
        "sku_group",
        "temperature_control_required",
        "expected_time_hours",
        "route_distance_km",
        "inventory_level",
        "safety_stock_level",
        "units_sold_7d",
        "demand_volatility",
        "order_value",
        "customs_clearance_hours",
        "port_congestion_origin",
        "port_congestion_destination",
        "fuel_price_index",
        "route_pressure",
        "inventory_gap",
        "inventory_ratio",
        "month",
        "day_of_week",
    ]

    X = df[feature_columns].copy()
    y = df["target_disruption"].copy()

    categorical_features = [
        "route_key",
        "supplier_country",
        "supplier_region",
        "business_unit",
        "product_category",
        "priority_level",
        "transport_mode",
        "carrier_name",
        "origin_country",
        "destination_country",
        "sku_group",
        "temperature_control_required",
    ]
    numeric_features = [
        "expected_time_hours",
        "route_distance_km",
        "inventory_level",
        "safety_stock_level",
        "units_sold_7d",
        "demand_volatility",
        "order_value",
        "customs_clearance_hours",
        "port_congestion_origin",
        "port_congestion_destination",
        "fuel_price_index",
        "route_pressure",
        "inventory_gap",
        "inventory_ratio",
        "month",
        "day_of_week",
    ]

    return X, y, categorical_features, numeric_features


def build_pipeline(categorical_features, numeric_features) -> Pipeline:
    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", categorical_transformer, categorical_features),
            ("num", numeric_transformer, numeric_features),
        ]
    )

    model = LogisticRegression(
        max_iter=4000,
        random_state=42,
        class_weight="balanced",
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def evaluate_model(model: Pipeline, X_test, y_test) -> dict:
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]

    return {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
        "positive_rate_test": float(y_test.mean()),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "classification_report": classification_report(
            y_test, y_pred, output_dict=True, zero_division=0
        ),
    }


def save_artifacts(model: Pipeline, metrics: dict):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"Saved model to: {MODEL_PATH}")
    print(f"Saved metrics to: {METRICS_PATH}")


def main():
    print("Loading dataset...")
    df = load_dataset(DATA_PATH)

    print("Normalizing columns...")
    df = normalize_columns(df)

    print("Creating target...")
    df = create_target(df)

    print("Engineering features...")
    df = engineer_features(df)

    X, y, categorical_features, numeric_features = select_features(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    pipeline = build_pipeline(categorical_features, numeric_features)

    print("Training model...")
    pipeline.fit(X_train, y_train)

    print("Evaluating model...")
    metrics = evaluate_model(pipeline, X_test, y_test)
    metrics["rows"] = int(len(df))
    metrics["positive_rate_train"] = float(y_train.mean())
    print(json.dumps(metrics, indent=2))

    print("Saving artifacts...")
    save_artifacts(pipeline, metrics)

    print("Training complete.")


if __name__ == "__main__":
    main()
