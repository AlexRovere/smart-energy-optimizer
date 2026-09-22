from __future__ import annotations

from collections.abc import Iterable
from datetime import timedelta

import pandas as pd

DEFAULT_PERIODS_DAYS = (30, 90, 365)
PEAK_THRESHOLDS_PERCENT = (50, 60, 70, 80, 90, 100)


def _number(value: object, digits: int = 2) -> float | None:
    return None if pd.isna(value) else round(float(value), digits)


def _change_percent(current: float | None, previous: float | None) -> float | None:
    if current is None or previous in (None, 0):
        return None
    return _number((current / previous - 1) * 100)


def _change_points(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return _number(current - previous)


def _window_metrics(frame: pd.DataFrame, start: pd.Timestamp, end: pd.Timestamp) -> dict:
    window = frame[(frame["timestamp"] >= start) & (frame["timestamp"] < end)]
    days = (end - start).days
    site_count = frame["site_id"].nunique()
    expected_hours = days * 24 * site_count
    actual_hours = window[["site_id", "timestamp"]].drop_duplicates().shape[0]

    energy = window["consumption_kwh_corrected"].sum(min_count=1)
    power = (
        window.dropna(subset=["consumption_kw_corrected"])
        .groupby("timestamp")["consumption_kw_corrected"]
        .sum(min_count=1)
    )
    mean_power = power.mean()
    max_power = power.max()
    reliable_hours = int(window["data_quality"].eq("good").sum())

    peaks = {}
    valid_consumption = window.dropna(subset=["consumption_kwh_corrected"])
    for percent in PEAK_THRESHOLDS_PERCENT:
        peak_count = 0
        for _, site in valid_consumption.groupby("site_id", observed=True):
            threshold = site["consumption_kwh_corrected"].mean() * (1 + percent / 100)
            peak_count += int(site["consumption_kwh_corrected"].gt(threshold).sum())
        peaks[str(percent)] = {
            "count": peak_count,
            "rate_percent": (
                _number(peak_count / len(valid_consumption) * 100)
                if len(valid_consumption)
                else None
            ),
        }

    return {
        "total_energy_kwh": _number(energy),
        "average_daily_kwh": _number(energy / days) if not pd.isna(energy) else None,
        "p95_kw": _number(power.quantile(0.95)) if not power.empty else None,
        "load_factor_percent": (
            _number(mean_power / max_power * 100)
            if not pd.isna(mean_power) and not pd.isna(max_power) and max_power != 0
            else None
        ),
        "reliable_rate_percent": (
            _number(reliable_hours / expected_hours * 100) if expected_hours else None
        ),
        "coverage_rate_percent": (
            _number(actual_hours / expected_hours * 100) if expected_hours else None
        ),
        "available_hours": len(valid_consumption),
        "expected_hours": expected_hours,
        "peaks": peaks,
    }


def _comparison(current: dict, previous: dict) -> dict:
    percent_metrics = ["total_energy_kwh", "average_daily_kwh", "p95_kw"]
    point_metrics = ["load_factor_percent", "reliable_rate_percent", "coverage_rate_percent"]
    result = {
        key: {
            "value": current[key],
            "previous": previous[key],
            "change_percent": _change_percent(current[key], previous[key]),
        }
        for key in percent_metrics
    }
    result.update(
        {
            key: {
                "value": current[key],
                "previous": previous[key],
                "change_points": _change_points(current[key], previous[key]),
            }
            for key in point_metrics
        }
    )
    result["available_hours"] = current["available_hours"]
    result["expected_hours"] = current["expected_hours"]
    result["peaks"] = {
        percent: {
            "count": values["count"],
            "rate_percent": values["rate_percent"],
            "previous_rate_percent": previous["peaks"][percent]["rate_percent"],
            "change_points": _change_points(
                values["rate_percent"], previous["peaks"][percent]["rate_percent"]
            ),
        }
        for percent, values in current["peaks"].items()
    }
    return result


def _entities(frame: pd.DataFrame) -> Iterable[dict[str, object]]:
    all_sites = sorted(frame["site_id"].dropna().unique())
    yield {"key": "all", "label": "Tous les sites", "kind": "global", "site_ids": all_sites}
    for site_type, group in frame.groupby("site_type", observed=True):
        yield {
            "key": f"type:{site_type}",
            "label": f"Type · {site_type}",
            "kind": "type",
            "site_ids": sorted(group["site_id"].dropna().unique()),
        }
    for site_id, group in frame.groupby("site_id", observed=True):
        site_type = str(group["site_type"].dropna().iloc[0])
        yield {
            "key": f"site:{site_id}",
            "label": f"{site_id} · {site_type}",
            "kind": "site",
            "site_ids": [str(site_id)],
        }


def build_kpis(
    frame: pd.DataFrame, periods_days: tuple[int, ...] = DEFAULT_PERIODS_DAYS
) -> dict[str, object]:
    required = {
        "site_id",
        "site_type",
        "timestamp",
        "consumption_kwh_corrected",
        "consumption_kw_corrected",
        "data_quality",
    }
    missing = sorted(required - set(frame.columns))
    if missing:
        raise ValueError(f"Colonnes manquantes pour les KPI: {', '.join(missing)}")

    data = frame[list(required)].copy()
    data["timestamp"] = pd.to_datetime(data["timestamp"], utc=True)
    last_complete_day = (data["timestamp"].max() + timedelta(hours=1)).normalize()
    entities = list(_entities(data))
    results = {}
    for entity in entities:
        entity_frame = data[data["site_id"].isin(entity["site_ids"])]
        results[entity["key"]] = {}
        for days in periods_days:
            current_start = last_complete_day - timedelta(days=days)
            previous_start = current_start - timedelta(days=days)
            current = _window_metrics(entity_frame, current_start, last_complete_day)
            previous = _window_metrics(entity_frame, previous_start, current_start)
            results[entity["key"]][str(days)] = _comparison(current, previous)

    return {
        "anchor_end_utc": last_complete_day.isoformat(),
        "periods_days": list(periods_days),
        "peak_thresholds_percent": list(PEAK_THRESHOLDS_PERCENT),
        "entities": entities,
        "results": results,
        "method": (
            "Fenêtres UTC complètes de même durée. Les taux de pics utilisent la moyenne "
            "de chaque site sur la fenêtre sélectionnée."
        ),
    }
