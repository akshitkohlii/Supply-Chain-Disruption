import asyncio
import random
import re
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
SOURCE_PATH = BASE_DIR / "data" / "processed" / "emerging_signal_training.csv"
OUTPUT_PATH = BASE_DIR / "data" / "processed" / "news_relevance_training.csv"

TARGET_ROWS = 20000
TARGET_POSITIVE = TARGET_ROWS // 2
TARGET_NEGATIVE = TARGET_ROWS - TARGET_POSITIVE
SEED = 42

DISRUPTION_TERMS = [
    "strike",
    "congestion",
    "disruption",
    "delay",
    "shutdown",
    "blockade",
    "customs",
    "backlog",
    "reroute",
    "closure",
    "queue",
    "queued",
    "bottleneck",
    "diversion",
]

STRONG_TERMS = [
    "strike",
    "shutdown",
    "blockade",
    "closure",
    "closed",
    "halt",
    "suspended",
    "sanction",
    "conflict",
    "war",
    "attack",
    "explosion",
    "cyberattack",
]

PORT_CONTEXT_TERMS = [
    "port",
    "terminal",
    "harbor",
    "harbour",
    "vessel",
    "shipping",
    "maritime",
    "container",
    "customs",
    "cargo",
    "berth",
    "canal",
    "freight",
    "liner",
    "feeder",
]

PORT_POSITIVE_TEMPLATES = [
    "{port_name} operators push some sailings back as berth windows tighten",
    "Container handling at {port_name} slows after prolonged customs processing",
    "Exporters reroute cargo as queues build around {port_name}",
    "{country} shipping lanes see mounting pressure around {port_name}",
    "{port_name} terminal throughput slips as vessel turnaround times climb",
]

PORT_POSITIVE_SUMMARIES = [
    "Cargo owners are facing longer handoff times, slower clearance, and schedule slippage across maritime operations tied to the port.",
    "Carriers report stretched berth availability, delayed gate movements, and growing pressure on container flows touching the corridor.",
    "Operational strain is raising transit risk for shipments linked to the port, even without a full terminal shutdown.",
]

ADVERSARIAL_NEGATIVE_TITLES = [
    "{port_name} study reviews how past strikes changed freight strategy",
    "{country} officials outline long-term congestion relief program for {port_name}",
    "{port_name} expansion aims to reduce customs backlog over the next five years",
    "Shipping alliance discusses delay reduction plan at {port_name}",
    "{port_name} digital program targets smoother cargo handoffs in future phases",
]

ADVERSARIAL_NEGATIVE_SUMMARIES = [
    "The update is forward-looking and does not describe an active disruption, closure, or current cargo delay affecting live operations.",
    "Executives discussed resilience planning, process reform, and future throughput gains rather than a present logistics incident.",
    "The report references congestion and delay as planning targets, but current port activity remains normal and vessel flow is stable.",
]

LOW_LEXICAL_POSITIVE_TITLES = [
    "Vessel turnaround extends at {port_name} after gate processing slows",
    "{port_name} shipping schedules slip as handlers work through accumulation",
    "{country} exporters face longer cargo dwell times around {port_name}",
    "{port_name} berth availability tightens, pushing departures into later windows",
]

LOW_LEXICAL_POSITIVE_SUMMARIES = [
    "Operators are managing a live operational slowdown with freight moving less efficiently than planned across maritime links.",
    "Cargo is still moving, but handling friction and reduced execution speed are materially affecting the monitored corridor.",
    "The issue is operational rather than political, yet it is still causing real timing pressure for shipments tied to the port.",
]

SOFTENER_REPLACEMENTS = {
    "shutdown": "temporary operating limits",
    "strike": "labor action",
    "congestion": "operational pressure",
    "delay": "timing slippage",
    "delays": "timing slippage",
    "disruption": "execution strain",
    "backlog": "accumulation",
    "closure": "restricted activity",
}

HARDENER_INSERTS = [
    "carriers began rerouting cargo",
    "vessel queues extended into the next sailing window",
    "customs processing added extra dwell time",
    "terminal operators reported slower turnaround",
]


def _normalize_text(value: object) -> str:
    return str(value or "").strip()


def _sample_row(df: pd.DataFrame) -> pd.Series:
    return df.sample(n=1, replace=True, random_state=random.randint(0, 10_000_000)).iloc[0]


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _jitter(value: float, low: float, high: float, floor: float = 0.0) -> float:
    return round(max(floor, value + random.uniform(low, high)), 2)


def _lower_phrase_count(text: str, phrases: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for phrase in phrases if phrase in lowered)


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clean_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _compute_text_features(title: str, summary: str, port_name: str, country: str) -> dict[str, float]:
    combined = _clean_spaces(f"{title} {summary}").lower()
    title_lower = title.lower()
    port_name_lower = _normalize_text(port_name).lower()
    country_lower = _normalize_text(country).lower()

    exact_port_mentions = 1.0 if port_name_lower and port_name_lower in title_lower else 0.0
    name_match = 1.0 if port_name_lower and port_name_lower in combined else 0.0
    country_match = 1.0 if country_lower and country_lower in combined else 0.0
    hotspot_match = 1.0 if any(term in combined for term in ["hormuz", "persian gulf", "red sea", "gulf of oman"]) else 0.0
    keyword_hits = float(_lower_phrase_count(combined, DISRUPTION_TERMS))
    strong_hits = float(_lower_phrase_count(combined, STRONG_TERMS))
    port_context_hits = float(_lower_phrase_count(combined, PORT_CONTEXT_TERMS))
    sentiment_score = round(
        _clamp(
            -(strong_hits * 0.18 + keyword_hits * 0.05) + (0.03 if keyword_hits == 0 else 0.0),
            -1.0,
            1.0,
        ),
        3,
    )
    relevance_score = round(
        exact_port_mentions * 3.8
        + name_match * 2.0
        + country_match * 0.5
        + keyword_hits * 0.8
        + strong_hits * 1.1
        + port_context_hits * 0.65
        + hotspot_match * 1.5,
        2,
    )

    return {
        "keyword_hits": keyword_hits,
        "strong_disruption_hits": strong_hits,
        "port_context_hits": port_context_hits,
        "exact_port_mentions": exact_port_mentions,
        "hotspot_article_count": hotspot_match,
        "sentiment_score": sentiment_score,
        "contains_disruption_terms": 1.0 if keyword_hits > 0 else 0.0,
        "name_match": name_match,
        "country_match": country_match,
        "hotspot_match": hotspot_match,
        "relevance_score": relevance_score,
    }


def _base_numeric_fields(seed_row: pd.Series) -> dict[str, float]:
    return {
        "published_age_hours": _safe_float(seed_row.get("published_age_hours"), 48.0),
        "temperature_c": _safe_float(seed_row.get("temperature_c"), 24.0),
        "precipitation_mm": _safe_float(seed_row.get("precipitation_mm"), 5.0),
        "wind_speed_kmh": _safe_float(seed_row.get("wind_speed_kmh"), 18.0),
        "weather_score": _safe_float(seed_row.get("weather_score"), 20.0),
        "shipment_count": _safe_float(seed_row.get("shipment_count"), 140.0),
        "avg_delay_hours": _safe_float(seed_row.get("avg_delay_hours"), 10.0),
        "avg_customs_clearance_hours": _safe_float(seed_row.get("avg_customs_clearance_hours"), 8.0),
        "congestion_score": _safe_float(seed_row.get("congestion_score"), 35.0),
    }


def _assemble_row(
    *,
    seed_row: pd.Series,
    title: str,
    summary: str,
    is_relevant: int,
    harder_positive: bool = False,
    adversarial_negative: bool = False,
) -> dict[str, object]:
    port_name = _normalize_text(seed_row.get("port_name")) or "Unknown Port"
    country = _normalize_text(seed_row.get("country")) or "Unknown"
    base = _base_numeric_fields(seed_row)
    text_features = _compute_text_features(title, summary, port_name, country)

    if is_relevant:
        delay_hours = _jitter(base["avg_delay_hours"], 2.0, 10.0)
        congestion_score = _jitter(base["congestion_score"], 4.0, 18.0)
        customs = _jitter(base["avg_customs_clearance_hours"], 1.0, 6.0)
        keyword_hits = max(text_features["keyword_hits"], 1.0)
        strong_hits = max(text_features["strong_disruption_hits"], 1.0 if not harder_positive else 0.0)
        port_context_hits = max(text_features["port_context_hits"], 2.0)
        relevance_score = max(6.0, text_features["relevance_score"] - (1.3 if harder_positive else 0.0))
        sentiment = min(-0.08, text_features["sentiment_score"])
    else:
        delay_hours = _jitter(base["avg_delay_hours"], -5.0, 1.0)
        congestion_score = _jitter(base["congestion_score"], -12.0, 4.0)
        customs = _jitter(base["avg_customs_clearance_hours"], -4.0, 2.0)
        keyword_hits = min(
            4.0 if adversarial_negative else 2.0,
            max(0.0, text_features["keyword_hits"]),
        )
        strong_hits = 0.0 if adversarial_negative else min(1.0, text_features["strong_disruption_hits"])
        port_context_hits = min(3.0 if adversarial_negative else 2.0, max(1.0, text_features["port_context_hits"]))
        relevance_score = min(5.8 if adversarial_negative else 4.8, text_features["relevance_score"])
        sentiment = max(-0.12, abs(text_features["sentiment_score"]) * 0.2)

    return {
        "source_type": "news",
        "title": _clean_spaces(title),
        "summary": _clean_spaces(summary),
        "port_name": port_name,
        "country": country,
        "keyword_hits": round(keyword_hits, 2),
        "strong_disruption_hits": round(strong_hits, 2),
        "port_context_hits": round(port_context_hits, 2),
        "exact_port_mentions": round(text_features["exact_port_mentions"], 2),
        "hotspot_article_count": round(text_features["hotspot_article_count"], 2),
        "sentiment_score": round(sentiment, 3),
        "contains_disruption_terms": 1 if keyword_hits > 0 else 0,
        "published_age_hours": _jitter(base["published_age_hours"], -18.0, 30.0),
        "temperature_c": _jitter(base["temperature_c"], -5.0, 5.0),
        "precipitation_mm": _jitter(base["precipitation_mm"], -3.0, 6.0),
        "wind_speed_kmh": _jitter(base["wind_speed_kmh"], -8.0, 10.0),
        "weather_score": _jitter(base["weather_score"], -15.0, 15.0),
        "shipment_count": round(max(0.0, base["shipment_count"] + random.randint(-50, 80)), 0),
        "avg_delay_hours": delay_hours,
        "avg_customs_clearance_hours": customs,
        "congestion_score": congestion_score,
        "name_match": round(text_features["name_match"], 2),
        "country_match": round(text_features["country_match"], 2),
        "hotspot_match": round(text_features["hotspot_match"], 2),
        "relevance_score": round(relevance_score, 2),
        "is_relevant": is_relevant,
    }


def _real_row(seed_row: pd.Series) -> dict[str, object]:
    row = seed_row.to_dict()
    row["source_type"] = "news"
    row["title"] = _clean_spaces(_normalize_text(row.get("title")))
    row["summary"] = _clean_spaces(_normalize_text(row.get("summary")))
    row["port_name"] = _normalize_text(row.get("port_name"))
    row["country"] = _normalize_text(row.get("country"))

    text_features = _compute_text_features(
        row["title"],
        row["summary"],
        row["port_name"],
        row["country"],
    )
    numeric_defaults = {
        "strong_disruption_hits": text_features["strong_disruption_hits"],
        "port_context_hits": text_features["port_context_hits"],
        "exact_port_mentions": text_features["exact_port_mentions"],
        "hotspot_article_count": text_features["hotspot_article_count"],
        "name_match": text_features["name_match"],
        "country_match": text_features["country_match"],
        "hotspot_match": text_features["hotspot_match"],
        "relevance_score": text_features["relevance_score"],
    }

    for key, default in numeric_defaults.items():
        row[key] = round(_safe_float(row.get(key), default), 2)

    required_numeric = [
        "keyword_hits",
        "sentiment_score",
        "contains_disruption_terms",
        "published_age_hours",
        "temperature_c",
        "precipitation_mm",
        "wind_speed_kmh",
        "weather_score",
        "shipment_count",
        "avg_delay_hours",
        "avg_customs_clearance_hours",
        "congestion_score",
    ]
    for key in required_numeric:
        row[key] = round(_safe_float(row.get(key), 0.0), 2)

    row["is_relevant"] = int(_safe_float(row.get("is_relevant"), 0))
    return row


def _paraphrased_row(seed_row: pd.Series) -> dict[str, object]:
    title = _normalize_text(seed_row.get("title"))
    summary = _normalize_text(seed_row.get("summary"))
    port_name = _normalize_text(seed_row.get("port_name")) or "Unknown Port"
    country = _normalize_text(seed_row.get("country")) or "Unknown"
    is_relevant = int(_safe_float(seed_row.get("is_relevant"), 0))

    for source, replacement in SOFTENER_REPLACEMENTS.items():
        if source in title.lower():
            title = re.sub(source, replacement, title, flags=re.IGNORECASE)
        if source in summary.lower():
            summary = re.sub(source, replacement, summary, flags=re.IGNORECASE)

    if is_relevant:
        title = random.choice(LOW_LEXICAL_POSITIVE_TITLES).format(
            port_name=port_name,
            country=country,
        )
        summary = f"{random.choice(LOW_LEXICAL_POSITIVE_SUMMARIES)} {summary}".strip()
        return _assemble_row(
            seed_row=seed_row,
            title=title,
            summary=summary,
            is_relevant=1,
            harder_positive=True,
        )

    title = f"{title} with no impact on current cargo execution"
    summary = f"{summary} Current port activity remains stable and carriers report normal turnaround."
    return _assemble_row(
        seed_row=seed_row,
        title=title,
        summary=summary,
        is_relevant=0,
    )


def _adversarial_negative_row(seed_row: pd.Series) -> dict[str, object]:
    port_name = _normalize_text(seed_row.get("port_name")) or "Unknown Port"
    country = _normalize_text(seed_row.get("country")) or "Unknown"
    title = random.choice(ADVERSARIAL_NEGATIVE_TITLES).format(
        port_name=port_name,
        country=country,
    )
    summary = random.choice(ADVERSARIAL_NEGATIVE_SUMMARIES)
    if random.random() < 0.5:
        summary = f"{summary} The article references delay, congestion, and customs only as targets for improvement."
    return _assemble_row(
        seed_row=seed_row,
        title=title,
        summary=summary,
        is_relevant=0,
        adversarial_negative=True,
    )


def _hard_positive_row(seed_row: pd.Series) -> dict[str, object]:
    port_name = _normalize_text(seed_row.get("port_name")) or "Unknown Port"
    country = _normalize_text(seed_row.get("country")) or "Unknown"
    title = random.choice(PORT_POSITIVE_TEMPLATES).format(
        port_name=port_name,
        country=country,
    )
    summary = f"{random.choice(LOW_LEXICAL_POSITIVE_SUMMARIES)} {random.choice(HARDENER_INSERTS)}."
    return _assemble_row(
        seed_row=seed_row,
        title=title,
        summary=summary,
        is_relevant=1,
        harder_positive=True,
    )


def generate_dataset() -> pd.DataFrame:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"Source dataset not found: {SOURCE_PATH}")

    random.seed(SEED)
    df = pd.read_csv(SOURCE_PATH)
    news_df = df[df["source_type"].astype(str).str.lower() == "news"].copy()
    if news_df.empty:
        raise ValueError("No news rows found in source dataset.")

    positives = news_df[news_df["is_relevant"] == 1].reset_index(drop=True)
    negatives = news_df[news_df["is_relevant"] == 0].reset_index(drop=True)
    if positives.empty or negatives.empty:
        raise ValueError("Source dataset must contain both positive and negative news rows.")

    target_mix = {
        "real_positive": 3000,
        "real_negative": 3000,
        "paraphrased_positive": 3000,
        "paraphrased_negative": 3000,
        "hard_positive": 4000,
        "adversarial_negative": 4000,
    }

    rows: list[dict[str, object]] = []
    for _ in range(target_mix["real_positive"]):
        rows.append(_real_row(_sample_row(positives)))
    for _ in range(target_mix["real_negative"]):
        rows.append(_real_row(_sample_row(negatives)))
    for _ in range(target_mix["paraphrased_positive"]):
        rows.append(_paraphrased_row(_sample_row(positives)))
    for _ in range(target_mix["paraphrased_negative"]):
        rows.append(_paraphrased_row(_sample_row(negatives)))
    for _ in range(target_mix["hard_positive"]):
        rows.append(_hard_positive_row(_sample_row(positives)))
    for _ in range(target_mix["adversarial_negative"]):
        rows.append(_adversarial_negative_row(_sample_row(negatives)))

    generated_df = pd.DataFrame(rows).sample(frac=1.0, random_state=SEED).reset_index(drop=True)
    if len(generated_df) != TARGET_ROWS:
        raise ValueError(f"Generated {len(generated_df)} rows, expected {TARGET_ROWS}.")
    return generated_df


async def main():
    df = generate_dataset()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)
    print(
        {
            "output_path": str(OUTPUT_PATH),
            "rows": int(len(df)),
            "positive_rows": int((df["is_relevant"] == 1).sum()),
            "negative_rows": int((df["is_relevant"] == 0).sum()),
            "columns": df.columns.tolist(),
        }
    )


if __name__ == "__main__":
    asyncio.run(main())
