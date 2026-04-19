from typing import Any, Dict, List

from app.core.database import get_database


DAY_NAME_MAP = {
    1: "Sunday",
    2: "Monday",
    3: "Tuesday",
    4: "Wednesday",
    5: "Thursday",
    6: "Friday",
    7: "Saturday",
}

DAY_ORDER = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
    "Sunday": 7,
}


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


async def get_logistics_overview():
    db = get_database()

    pipeline = [
        {
            "$group": {
                "_id": None,
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                "avg_expected_time": {"$avg": {"$ifNull": ["$expected_time_hours", 0]}},
                "avg_actual_time": {"$avg": {"$ifNull": ["$actual_time_hours", 0]}},
                "total_shipments": {"$sum": 1},
            }
        }
    ]

    result = await db.shipments_raw.aggregate(pipeline).to_list(1)

    if not result:
        return {
            "total_shipments": 0,
            "avg_delay_hours": 0,
            "avg_expected_time_hours": 0,
            "avg_actual_time_hours": 0,
            "avg_throughput_pct": 0,
            "peak_delay_day": None,
            "delay_distribution": {"low": 0, "medium": 0, "high": 0},
        }

    data = result[0]

    avg_delay = round(_safe_float(data.get("avg_delay_hours")), 2)
    avg_expected = round(_safe_float(data.get("avg_expected_time")), 2)
    avg_actual = round(_safe_float(data.get("avg_actual_time")), 2)

    avg_throughput_pct = round(
        max(0, min(100, 100 - ((avg_delay / avg_expected) * 100))) if avg_expected > 0 else 0,
        2,
    )

    peak_day_pipeline = [
        {
            "$addFields": {
                "parsed_timestamp": {
                    "$dateFromString": {
                        "dateString": "$timestamp",
                        "onError": None,
                        "onNull": None,
                    }
                }
            }
        },
        {
            "$match": {
                "parsed_timestamp": {"$ne": None},
            }
        },
        {
            "$group": {
                "_id": {"$dayOfWeek": "$parsed_timestamp"},
                "avg_delay": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
            }
        },
        {"$sort": {"avg_delay": -1}},
        {"$limit": 1},
    ]

    peak_day_result = await db.shipments_raw.aggregate(peak_day_pipeline).to_list(1)
    peak_delay_day = (
        {
            "day": DAY_NAME_MAP.get(peak_day_result[0]["_id"], "Unknown"),
            "avg_delay_hours": round(_safe_float(peak_day_result[0].get("avg_delay")), 2),
        }
        if peak_day_result
        else None
    )

    low = await db.shipments_raw.count_documents({"delay_hours": {"$lte": 8}})
    medium = await db.shipments_raw.count_documents({"delay_hours": {"$gt": 8, "$lte": 20}})
    high = await db.shipments_raw.count_documents({"delay_hours": {"$gt": 20}})

    return {
        "total_shipments": int(data.get("total_shipments") or 0),
        "avg_delay_hours": avg_delay,
        "avg_expected_time_hours": avg_expected,
        "avg_actual_time_hours": avg_actual,
        "avg_throughput_pct": avg_throughput_pct,
        "peak_delay_day": peak_delay_day,
        "delay_distribution": {
            "low": low,
            "medium": medium,
            "high": high,
        },
    }


async def get_logistics_timeseries():
    db = get_database()

    pipeline = [
        {
            "$addFields": {
                "parsed_timestamp": {
                    "$dateFromString": {
                        "dateString": "$timestamp",
                        "onError": None,
                        "onNull": None,
                    }
                }
            }
        },
        {
            "$match": {
                "parsed_timestamp": {"$ne": None},
            }
        },
        {
            "$group": {
                "_id": {"$dayOfWeek": "$parsed_timestamp"},
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                "avg_expected_time_hours": {"$avg": {"$ifNull": ["$expected_time_hours", 0]}},
            }
        },
    ]

    raw = await db.shipments_raw.aggregate(pipeline).to_list(None)

    rows: List[Dict[str, Any]] = []
    for item in raw:
        avg_delay = round(_safe_float(item.get("avg_delay_hours")), 2)
        avg_expected = round(_safe_float(item.get("avg_expected_time_hours")), 2)
        throughput = round(
            max(0, min(100, 100 - ((avg_delay / avg_expected) * 100))) if avg_expected > 0 else 0,
            2,
        )

        day_name = DAY_NAME_MAP.get(item["_id"], "Unknown")

        rows.append(
            {
                "day": day_name,
                "avg_delay_hours": avg_delay,
                "throughput_pct": throughput,
            }
        )

    rows.sort(key=lambda x: DAY_ORDER.get(x["day"], 99))
    return rows
