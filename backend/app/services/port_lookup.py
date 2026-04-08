from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[2]
PORTS_CSV = BASE_DIR / "data" / "reference" / "ports_master_clean.csv"

PORT_ALIASES = {
    "busan port": "busan",
    "los angeles port": "los angeles",
    "shanghai port": "shanghai",
    "hamburg port": "hamburg",
    "mumbai port": "mumbai",
}

COUNTRY_ALIASES = {
    "united states": "us",
    "usa": "us",
    "u s a": "us",
    "us": "us",
    "china": "cn",
    "cn": "cn",
    "germany": "de",
    "de": "de",
    "india": "in",
    "in": "in",
    "south korea": "kr",
    "korea south": "kr",
    "republic of korea": "kr",
    "kr": "kr",
    "russia": "ru",
    "russian federation": "ru",
    "ru": "ru",
    "japan": "jp",
    "jp": "jp",
}


def _norm(value: object) -> str:
    if value is None:
        return ""

    text = " ".join(str(value).strip().lower().split())

    for phrase in ["port of", "port", "harbour", "harbor"]:
        text = text.replace(phrase, " ")

    for ch in [".", ",", "-", "_", "/", "(", ")"]:
        text = text.replace(ch, " ")

    text = " ".join(text.split())
    return text


def _norm_country(value: object) -> str:
    base = _norm(value)
    return COUNTRY_ALIASES.get(base, base)


def _safe_float(value: object) -> Optional[float]:
    try:
        if value is None or str(value).strip() == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=1)
def load_ports_df() -> pd.DataFrame:
    if not PORTS_CSV.exists():
        raise FileNotFoundError(f"ports_master_clean.csv not found at: {PORTS_CSV}")

    df = pd.read_csv(PORTS_CSV)

    required = {
        "port_key",
        "port_id",
        "port_name",
        "country",
        "latitude",
        "longitude",
        "harbor_size",
        "harbor_type",
        "max_vessel",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Missing required columns in ports_master_clean.csv: {sorted(missing)}"
        )

    df = df.copy()
    df = df.where(pd.notnull(df), None)
    df = df.astype(object)

    df["port_name_norm"] = df["port_name"].apply(_norm)
    df["country_norm"] = df["country"].apply(_norm_country)

    return df


def find_port(
    port_name: str,
    country: Optional[str] = None,
) -> Optional[dict]:
    if not port_name or not str(port_name).strip():
        return None

    df = load_ports_df()

    port_name_norm = _norm(port_name)
    port_name_norm = PORT_ALIASES.get(port_name_norm, port_name_norm)

    matches = df[df["port_name_norm"] == port_name_norm]

    if matches.empty:
        matches = df[
            df["port_name_norm"].apply(
                lambda x: port_name_norm in x or x in port_name_norm
            )
        ]

    if matches.empty:
        return None

    if len(matches) > 1 and country:
        country_norm = _norm_country(country)
        country_matches = matches[matches["country_norm"] == country_norm]
        if not country_matches.empty:
            matches = country_matches

    row = matches.iloc[0]

    latitude = _safe_float(row["latitude"])
    longitude = _safe_float(row["longitude"])

    if latitude is None or longitude is None:
        return None

    port_id = row["port_id"]
    if port_id is not None and str(port_id).strip() != "":
        try:
            port_id = int(port_id)
        except (TypeError, ValueError):
            port_id = str(port_id)
    else:
        port_id = None

    return {
        "port_key": None if row["port_key"] is None else str(row["port_key"]),
        "port_id": port_id,
        "port_name": None if row["port_name"] is None else str(row["port_name"]),
        "country": None if row["country"] is None else str(row["country"]),
        "latitude": float(latitude),
        "longitude": float(longitude),
        "harbor_size": None if row["harbor_size"] is None else str(row["harbor_size"]),
        "harbor_type": None if row["harbor_type"] is None else str(row["harbor_type"]),
        "max_vessel": None if row["max_vessel"] is None else str(row["max_vessel"]),
    }


def get_coordinates(
    port_name: str,
    country: Optional[str] = None,
) -> Optional[dict]:
    port = find_port(port_name, country)
    if not port:
        return None

    return {
        "lat": port["latitude"],
        "lng": port["longitude"],
    }