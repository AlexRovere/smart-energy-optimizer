# point d'entrée Load : écrit le référentiel des sites et l'historique des mesures (Parquet), et la base
from __future__ import annotations

from collections.abc import Callable
from datetime import date
from pathlib import Path

import pandas as pd

from load.config import get_output_dir
from load.db import get_connection
from load.readings import existing_days, read_context_days, write_readings
from load.sites_repository import get_existing_site_ids, insert_sites


def load_sites(sites: pd.DataFrame) -> str:
    output_dir = Path(get_output_dir())
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / "sites.parquet"
    sites.to_parquet(target, engine="pyarrow", index=False)
    return str(target)


def load_readings(
    readings: pd.DataFrame, on_file_written: Callable[[], None] | None = None
) -> list[str]:
    return write_readings(readings, get_output_dir(), on_file_written=on_file_written)


def get_existing_days(site_id: str) -> set[date]:
    return existing_days(get_output_dir(), site_id)


def get_context_days(site_id: str, days: set[date]) -> pd.DataFrame:
    return read_context_days(get_output_dir(), site_id, days)


def load_sites_to_db(sites: pd.DataFrame) -> int:
    connection = get_connection()
    try:
        existing_ids = get_existing_site_ids(connection)
        new_sites = sites[~sites["id"].isin(existing_ids)]
        return insert_sites(connection, new_sites)
    finally:
        connection.close()
