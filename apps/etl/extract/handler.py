# point d'entrée Extract : lit le référentiel des sites depuis l'API Mock et le renvoie en DataFrame pandas
from __future__ import annotations

import pandas as pd

from extract.api_client import get_json
from extract.config import get_base_url

SITES_PATH = "/api/v1/sites"


def fetch_sites() -> pd.DataFrame:
    base_url = get_base_url()
    sites = get_json(base_url, SITES_PATH)
    return pd.DataFrame(sites)
