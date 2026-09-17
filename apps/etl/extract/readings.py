# appelé par le handler Extract : lit l'historique des mesures par site (GET /api/v1/readings), un point par heure
from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone

import pandas as pd

from extract.api_client import get_json

READINGS_PATH = "/api/v1/readings"
DEFAULT_WINDOW = timedelta(days=7)
PAGE_SIZE = timedelta(days=1)


def resolve_time_range(
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    now = now or datetime.now(timezone.utc)

    if start_time is None and end_time is None:
        return now - DEFAULT_WINDOW, now
    if end_time is None:
        return start_time, start_time + DEFAULT_WINDOW
    if start_time is None:
        return end_time - DEFAULT_WINDOW, end_time
    return start_time, end_time


def hourly_reading_limit(start: datetime, end: datetime) -> int:
    return max(1, round((end - start) / timedelta(hours=1)))


def plan_fetch_windows(
    start: datetime, end: datetime, already_covered_days: set[date] | None = None
) -> list[tuple[datetime, datetime]]:
    already_covered_days = already_covered_days or set()

    all_windows: list[tuple[datetime, datetime]] = []
    window_start = start
    while window_start < end:
        window_end = min(window_start + PAGE_SIZE, end)
        all_windows.append((window_start, window_end))
        window_start = window_end

    requested_days = [window[0].date() for window in all_windows]
    missing_days = {day for day in requested_days if day not in already_covered_days}
    if not missing_days:
        return []

    days_to_fetch = set(missing_days)
    for day in missing_days:
        for neighbor in (day - timedelta(days=1), day + timedelta(days=1)):
            if neighbor in requested_days and neighbor in already_covered_days:
                days_to_fetch.add(neighbor)

    return [window for window in all_windows if window[0].date() in days_to_fetch]


def fetch_readings_window(
    base_url: str,
    site_id: str,
    start_time: datetime,
    end_time: datetime,
    limit: int = 1000,
) -> pd.DataFrame:
    params = {
        "site_id": site_id,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "limit": limit,
    }
    records = get_json(base_url, READINGS_PATH, params=params)
    return pd.DataFrame(records)


def fetch_readings(
    base_url: str,
    site_id: str,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    on_window: Callable[[], None] | None = None,
    already_covered_days: set[date] | None = None,
) -> pd.DataFrame:
    start, end = resolve_time_range(start_time, end_time)
    windows = plan_fetch_windows(start, end, already_covered_days)

    pages: list[pd.DataFrame] = []
    for window_start, window_end in windows:
        limit = hourly_reading_limit(window_start, window_end)
        pages.append(fetch_readings_window(base_url, site_id, window_start, window_end, limit=limit))
        if on_window is not None:
            on_window()

    if not pages:
        return pd.DataFrame()
    return pd.concat(pages, ignore_index=True)


def fetch_all_readings(
    base_url: str,
    site_ids: list[str],
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    on_window: Callable[[], None] | None = None,
    already_covered_days: dict[str, set[date]] | None = None,
) -> pd.DataFrame:
    already_covered_days = already_covered_days or {}
    pages = [
        fetch_readings(
            base_url,
            site_id,
            start_time,
            end_time,
            on_window=on_window,
            already_covered_days=already_covered_days.get(site_id),
        )
        for site_id in site_ids
    ]
    non_empty_pages = [page for page in pages if not page.empty]

    if not non_empty_pages:
        return pd.DataFrame()
    return pd.concat(non_empty_pages, ignore_index=True)
