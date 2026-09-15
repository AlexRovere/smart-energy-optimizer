# appelé par le handler Extract : requête HTTP GET générique vers l'API Mock, renvoie le JSON décodé
from __future__ import annotations

from typing import Any

import requests


def get_json(base_url: str, path: str) -> Any:
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return response.json()
