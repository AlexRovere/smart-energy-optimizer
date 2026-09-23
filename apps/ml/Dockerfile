# syntax=docker/dockerfile:1

# ---- build ----
FROM python:3.12-slim AS build

# Utilise une version figée de uv sans installation via pip.
COPY --from=ghcr.io/astral-sh/uv:0.12.15 /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Cette couche sera réutilisée tant que les dépendances ne changent pas.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-build --no-install-project --no-dev

COPY src ./src
COPY config ./config

RUN uv sync --frozen --no-build --no-dev


# ---- runtime ----
FROM python:3.12-slim AS runtime

# L'image de base publiée traîne des correctifs de sécurité déjà parus chez
# Debian : perl-base y portait trois CVE critiques corrigées en amont, que le
# scan d'image bloque à raison (PR #138). Cette mise à jour les applique sans
# attendre la reconstruction du tag. Elle rend la construction un peu moins
# reproductible d'un jour à l'autre, et c'est le but : un correctif publié doit
# entrer dans l'image le jour où il paraît, pas le jour où l'amont s'en occupe.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home /app app

WORKDIR /app

# Copie l'application et son environnement virtuel depuis l'étape de build.
COPY --from=build --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    MLFLOW_ARTIFACT_ROOT=/app/artifacts/mlruns \
    MLFLOW_TRACKING_URI=sqlite:////app/artifacts/mlflow.db \
    ML_SITE_CONFIG_PATH=/app/config/sites.json

# Le répertoire Parquet (PARQUET_DIR) est monté en lecture seule.
# Le dossier artifacts doit rester accessible en écriture pour l'entraînement.
RUN mkdir -p /data /app/artifacts \
    && chown -R app:app /data /app/artifacts

USER app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
