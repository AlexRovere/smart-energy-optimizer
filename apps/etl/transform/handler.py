# point d'entrée Transform : passe-plat du référentiel des sites, règles métier à venir
from __future__ import annotations

import pandas as pd


def transform_sites(sites: pd.DataFrame) -> pd.DataFrame:
    return sites


def dedupe_sites(sites: pd.DataFrame) -> pd.DataFrame:
    return sites.drop_duplicates(subset="site_id", keep="first").reset_index(drop=True)
