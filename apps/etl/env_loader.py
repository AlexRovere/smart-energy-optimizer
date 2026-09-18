# appelé par main au démarrage : charge le .env racine du monorepo (partagé avec les autres
# conteneurs)
from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def load_root_env() -> None:
    load_dotenv(REPO_ROOT / ".env", override=False)
