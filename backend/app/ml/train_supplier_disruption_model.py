from pathlib import Path
import json

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "processed" / "supplier_training_data.csv"
MODEL_DIR = BASE_DIR / "data" / "models"
MODEL_PATH = MODEL_DIR / "supplier_disruption_model.pkl"
METRICS_PATH = MODEL_DIR / "supplier_disruption_model_metrics.json"


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise ValueError("Dataset is empty.")
    return df


def normalize_dataset(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    expected_cols = [
        "supplier_id",
        "supplier_name",
        "supplier_country",
        "supplier_region",
        "business_unit",
        "shipment_count",
        "avg_delay_hours",
        "avg_customs_clearance_hours",
        "avg_inventory_level",
        "avg_safety_stock_level",
        "inventory_gap",
        "inventory_ratio",
        "avg_demand_volatility",
        "avg_order_value",
        "avg_route_risk",
        "avg_route_ml_risk",
        "route_warning_share",
        "route_critical_share",
        "is_disrupted",
    ]

    for col in expected_cols:
        if col not in df.columns:
            df[col] = None

    text_cols = [
        "supplier_id",
        "supplier_name",
        "supplier_country",
        "supplier_region",
        "business_unit",
    ]
    for col in text_cols:
        df[col] = df[col].fillna("").astype(str)

    numeric_cols = [
        "shipment_count",
        "avg_delay_hours",
        "avg_customs_clearance_hours",
        "avg_inventory_level",
        "avg_safety_stock_level",
        "inventory_gap",
        "inventory_ratio",
        "avg_demand_volatility",
        "avg_order_value",
        "avg_route_risk",
        "avg_route_ml_risk",
        "route_warning_share",
        "route_critical_share",
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["is_disrupted"] = pd.to_numeric(df["is_disrupted"], errors="coerce").fillna(0).astype(int)

    return df


def build_pipeline():
    categorical_features = [
        "supplier_country",
        "supplier_region",
        "business_unit",
    ]

    numeric_features = [
        "shipment_count",
        "avg_delay_hours",
        "avg_customs_clearance_hours",
        "avg_inventory_level",
        "avg_safety_stock_level",
        "inventory_gap",
        "inventory_ratio",
        "avg_demand_volatility",
        "avg_order_value",
        "avg_route_risk",
        "avg_route_ml_risk",
        "route_warning_share",
        "route_critical_share",
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_features,
            ),
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                numeric_features,
            ),
        ]
    )

    model = LogisticRegression(
        max_iter=2000,
        class_weight="balanced",
        random_state=42,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def main():
    df = load_dataset(DATA_PATH)
    df = normalize_dataset(df)

    X = df[
        [
            "supplier_country",
            "supplier_region",
            "business_unit",
            "shipment_count",
            "avg_delay_hours",
            "avg_customs_clearance_hours",
            "avg_inventory_level",
            "avg_safety_stock_level",
            "inventory_gap",
            "inventory_ratio",
            "avg_demand_volatility",
            "avg_order_value",
            "avg_route_risk",
            "avg_route_ml_risk",
            "route_warning_share",
            "route_critical_share",
        ]
    ].copy()

    y = df["is_disrupted"].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "classification_report": classification_report(
            y_test, y_pred, output_dict=True, zero_division=0
        ),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(json.dumps(metrics, indent=2))
    print(f"Saved model to: {MODEL_PATH}")


if __name__ == "__main__":
    main()