# point d'entrée Extract : lit le référentiel des sites et l'historique des mesures depuis l'API
# Mock
from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime

import pandas as pd

from extract.api_client import get_json
from extract.config import get_base_url
from extract.readings import fetch_all_readings

SITES_PATH = "/api/v1/sites"


def fetch_sites() -> pd.DataFrame:
    base_url = get_base_url()
    sites = get_json(base_url, SITES_PATH)
    return pd.DataFrame(sites)


def fetch_readings(
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    on_window: Callable[[], None] | None = None,
    already_covered_days: dict[str, set[date]] | None = None,
) -> pd.DataFrame:
    base_url = get_base_url()
    sites = fetch_sites()
    site_ids = sites["site_id"].tolist() if not sites.empty else []
    return fetch_all_readings(
        base_url,
        site_ids,
        start_time,
        end_time,
        on_window=on_window,
        already_covered_days=already_covered_days,
    )
