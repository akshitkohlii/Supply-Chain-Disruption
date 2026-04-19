from pathlib import Path
import json

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.multioutput import MultiOutputRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "processed" / "mitigation_training_data.csv"
MODEL_DIR = BASE_DIR / "data" / "models"
MODEL_PATH = MODEL_DIR / "mitigation_outcome_model.pkl"
METRICS_PATH = MODEL_DIR / "mitigation_outcome_model_metrics.json"


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
        "scenario_type",
        "entity_type",
        "port_kind",
        "baseline_risk",
        "baseline_delay",
        "baseline_recovery_days",
        "ml_risk_score",
        "weather_score",
        "news_score",
        "congestion_score",
        "inventory_ratio",
        "has_congestion_factor",
        "has_news_factor",
        "has_customs_factor",
        "has_inventory_factor",
        "has_delay_factor",
        "target_risk_score",
        "target_delay_hours",
        "target_recovery_days",
        "target_cost_impact",
    ]

    for col in expected_cols:
        if col not in df.columns:
            df[col] = None

    text_cols = ["scenario_type", "entity_type", "port_kind"]
    for col in text_cols:
        df[col] = df[col].fillna("").astype(str)

    numeric_cols = [col for col in expected_cols if col not in text_cols]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


def build_pipeline(categorical_features: list[str], numeric_features: list[str]) -> Pipeline:
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

    model = MultiOutputRegressor(
        RandomForestRegressor(
            n_estimators=200,
            max_depth=10,
            min_samples_leaf=2,
            random_state=42,
        )
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def main():
    df = normalize_dataset(load_dataset(DATA_PATH))

    categorical_features = ["scenario_type", "entity_type", "port_kind"]
    numeric_features = [
        "baseline_risk",
        "baseline_delay",
        "baseline_recovery_days",
        "ml_risk_score",
        "weather_score",
        "news_score",
        "congestion_score",
        "inventory_ratio",
        "has_congestion_factor",
        "has_news_factor",
        "has_customs_factor",
        "has_inventory_factor",
        "has_delay_factor",
    ]
    feature_columns = categorical_features + numeric_features

    target_columns = [
        "target_risk_score",
        "target_delay_hours",
        "target_recovery_days",
        "target_cost_impact",
    ]

    X = df[feature_columns].copy()
    y = df[target_columns].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    pipeline = build_pipeline(categorical_features, numeric_features)
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    pred_df = pd.DataFrame(y_pred, columns=target_columns)

    metrics = {
        "mae": {
            column: float(mean_absolute_error(y_test[column], pred_df[column]))
            for column in target_columns
        },
        "r2": {
            column: float(r2_score(y_test[column], pred_df[column]))
            for column in target_columns
        },
        "rows": int(len(df)),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": pipeline,
            "feature_columns": feature_columns,
            "target_columns": target_columns,
        },
        MODEL_PATH,
    )

    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(json.dumps(metrics, indent=2))
    print(f"Saved model to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
