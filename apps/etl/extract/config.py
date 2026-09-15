# appelé par le handler Extract : expose l'URL de base de l'API Mock depuis l'environnement
from __future__ import annotations

import os


def get_base_url() -> str:
    base_url = os.getenv("MOCK_API_URL")
    if not base_url:
        raise RuntimeError("MOCK_API_URL is not set")
    return base_url
