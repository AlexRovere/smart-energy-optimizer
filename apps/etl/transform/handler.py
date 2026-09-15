# point d'entrée Transform : nettoie les noms de colonnes du référentiel des sites, et le dédoublonne
from __future__ import annotations

import pandas as pd


def clean_site_columns(sites: pd.DataFrame) -> pd.DataFrame:
    return sites.rename(columns=lambda column: column.removeprefix("site_"))


def transform_sites(sites: pd.DataFrame) -> pd.DataFrame:
    return clean_site_columns(sites)


def dedupe_sites(sites: pd.DataFrame) -> pd.DataFrame:
    return sites.drop_duplicates(subset="id", keep="first").reset_index(drop=True)
