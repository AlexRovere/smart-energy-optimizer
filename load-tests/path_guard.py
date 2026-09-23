# confine les chemins reçus en ligne de commande par les scripts de charge au dépôt
from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def resolve_within(raw_path: str, root: Path = REPO_ROOT) -> Path:
    base = os.path.realpath(root)
    candidate = os.path.realpath(raw_path)
    if os.path.commonpath([base, candidate]) != base:
        raise ValueError(f"{raw_path} sort du répertoire autorisé {base}")
    return Path(candidate)
