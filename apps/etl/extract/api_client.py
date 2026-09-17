# appelé par le handler Extract : requête HTTP GET générique vers l'API Mock, avec retry sur les pannes transitoires
from __future__ import annotations

import time
from typing import Any

import requests

MAX_ATTEMPTS = 4
BACKOFF_SECONDS = 1
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def get_json(base_url: str, path: str, params: dict[str, Any] | None = None) -> Any:
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except (requests.ConnectionError, requests.Timeout):
            if attempt == MAX_ATTEMPTS:
                raise
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            if status not in RETRYABLE_STATUS_CODES or attempt == MAX_ATTEMPTS:
                raise

        time.sleep(BACKOFF_SECONDS * (2 ** (attempt - 1)))
