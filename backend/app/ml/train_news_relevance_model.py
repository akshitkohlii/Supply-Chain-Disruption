import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_recall_curve, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "processed" / "news_relevance_training.csv"
MODEL_DIR = BASE_DIR / "data" / "models"
MODEL_PATH = MODEL_DIR / "news_relevance_model.pkl"
METRICS_PATH = MODEL_DIR / "news_relevance_model_metrics.json"


def load_dataset(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    df = pd.read_csv(path)
    if df.empty:
        raise ValueError("Dataset is empty.")
    return df


def normalize_dataset(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["source_type"] = df.get("source_type", "").fillna("").astype(str).str.lower()
    df = df[df["source_type"] == "news"].copy()
    if df.empty:
        raise ValueError("No news rows available in dataset.")

    expected_cols = [
        "title",
        "summary",
        "port_name",
        "country",
        "keyword_hits",
        "strong_disruption_hits",
        "port_context_hits",
        "exact_port_mentions",
        "hotspot_article_count",
        "sentiment_score",
        "contains_disruption_terms",
        "published_age_hours",
        "name_match",
        "country_match",
        "hotspot_match",
        "relevance_score",
        "is_relevant",
    ]

    for col in expected_cols:
        if col not in df.columns:
            df[col] = None

    text_cols = ["title", "summary", "port_name", "country"]
    for col in text_cols:
        df[col] = df[col].fillna("").astype(str)

    numeric_cols = [
        "keyword_hits",
        "strong_disruption_hits",
        "port_context_hits",
        "exact_port_mentions",
        "hotspot_article_count",
        "sentiment_score",
        "contains_disruption_terms",
        "published_age_hours",
        "name_match",
        "country_match",
        "hotspot_match",
        "relevance_score",
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    df["combined_text"] = (
        df["title"].fillna("")
        + " "
        + df["summary"].fillna("")
        + " "
        + df["port_name"].fillna("")
        + " "
        + df["country"].fillna("")
    ).str.strip()
    df["is_relevant"] = pd.to_numeric(df["is_relevant"], errors="coerce").fillna(0).astype(int)
    return df


def build_pipeline() -> Pipeline:
    text_features = "combined_text"
    categorical_features = ["port_name", "country"]
    numeric_features = [
        "keyword_hits",
        "strong_disruption_hits",
        "port_context_hits",
        "exact_port_mentions",
        "hotspot_article_count",
        "sentiment_score",
        "contains_disruption_terms",
        "published_age_hours",
        "name_match",
        "country_match",
        "hotspot_match",
        "relevance_score",
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "text",
                TfidfVectorizer(max_features=4000, ngram_range=(1, 2)),
                text_features,
            ),
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
        max_iter=2500,
        class_weight="balanced",
        random_state=42,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def pick_threshold(y_true: pd.Series, probabilities) -> float:
    precision, recall, thresholds = precision_recall_curve(y_true, probabilities)
    best_threshold = 0.6
    best_f1 = -1.0

    for index, threshold in enumerate(thresholds):
        p = float(precision[index + 1])
        r = float(recall[index + 1])
        f1 = 0.0 if (p + r) == 0 else (2 * p * r) / (p + r)

        if p >= 0.88 and f1 > best_f1:
            best_f1 = f1
            best_threshold = float(threshold)

    if best_f1 >= 0:
        return round(best_threshold, 4)

    for index, threshold in enumerate(thresholds):
        p = float(precision[index + 1])
        r = float(recall[index + 1])
        f1 = 0.0 if (p + r) == 0 else (2 * p * r) / (p + r)
        if f1 > best_f1:
            best_f1 = f1
            best_threshold = float(threshold)

    return round(best_threshold, 4)


def main():
    df = normalize_dataset(load_dataset(DATA_PATH))

    feature_columns = [
        "combined_text",
        "port_name",
        "country",
        "keyword_hits",
        "strong_disruption_hits",
        "port_context_hits",
        "exact_port_mentions",
        "hotspot_article_count",
        "sentiment_score",
        "contains_disruption_terms",
        "published_age_hours",
        "name_match",
        "country_match",
        "hotspot_match",
        "relevance_score",
    ]
    X = df[feature_columns].copy()
    y = df["is_relevant"].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    probabilities = pipeline.predict_proba(X_test)[:, 1]
    threshold = pick_threshold(y_test, probabilities)
    y_pred = (probabilities >= threshold).astype(int)

    metrics = {
        "rows": int(len(df)),
        "news_rows": int(len(df)),
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "classification_report": classification_report(
            y_test, y_pred, output_dict=True, zero_division=0
        ),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": pipeline, "threshold": threshold}, MODEL_PATH)
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(json.dumps(metrics, indent=2))
    print(f"Saved model to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
