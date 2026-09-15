# point d'entrée Load : écrit le référentiel des sites (Parquet, et sites manquants en base)
from __future__ import annotations

from pathlib import Path

import pandas as pd

from load.config import get_output_dir
from load.db import get_connection
from load.sites_repository import get_existing_site_ids, insert_sites


def load_sites(sites: pd.DataFrame) -> str:
    output_dir = Path(get_output_dir())
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / "sites.parquet"
    sites.to_parquet(target, engine="pyarrow", index=False)
    return str(target)


def load_sites_to_db(sites: pd.DataFrame) -> int:
    connection = get_connection()
    try:
        existing_ids = get_existing_site_ids(connection)
        new_sites = sites[~sites["site_id"].isin(existing_ids)]
        return insert_sites(connection, new_sites)
    finally:
        connection.close()
