from pathlib import Path
import json

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "processed" / "route_delay_training_data.csv"
MODEL_DIR = BASE_DIR / "data" / "models"
MODEL_PATH = MODEL_DIR / "route_delay_forecast_model.pkl"
METRICS_PATH = MODEL_DIR / "route_delay_forecast_model_metrics.json"


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
        "avg_delay_hours",
        "expected_time_hours",
        "customs_clearance_hours",
        "demand_volatility",
        "inventory_ratio",
        "weather_score",
        "news_score",
        "congestion_score",
        "disruption_probability",
        "target_delay_hours",
    ]
    for col in expected_cols:
        if col not in df.columns:
            df[col] = None
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def build_pipeline() -> Pipeline:
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "model",
                RandomForestRegressor(
                    n_estimators=240,
                    max_depth=12,
                    min_samples_leaf=2,
                    random_state=42,
                ),
            ),
        ]
    )


def main():
    df = normalize_dataset(load_dataset(DATA_PATH))
    feature_columns = [
        "avg_delay_hours",
        "expected_time_hours",
        "customs_clearance_hours",
        "demand_volatility",
        "inventory_ratio",
        "weather_score",
        "news_score",
        "congestion_score",
        "disruption_probability",
    ]
    X = df[feature_columns].copy()
    y = df["target_delay_hours"].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    metrics = {
        "mae": {"target_delay_hours": float(mean_absolute_error(y_test, y_pred))},
        "r2": {"target_delay_hours": float(r2_score(y_test, y_pred))},
        "rows": int(len(df)),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": pipeline,
            "feature_columns": feature_columns,
        },
        MODEL_PATH,
    )

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(json.dumps(metrics, indent=2))
    print(f"Saved model to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
