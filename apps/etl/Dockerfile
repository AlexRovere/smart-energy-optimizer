# syntax=docker/dockerfile:1

# ---- build ----
FROM python:3.12-slim AS build

RUN pip install --no-cache-dir uv

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

COPY . .
RUN uv sync --frozen --no-dev

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
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system app && useradd --system --gid app --home /app app

WORKDIR /app

COPY --from=build --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH"

USER app

CMD ["python", "main.py"]
