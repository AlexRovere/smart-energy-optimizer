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

RUN uv sync --frozen --no-build --no-dev


# ---- runtime ----
FROM python:3.12-slim AS runtime

# Même motif que l'image ML : appliquer les correctifs Debian parus depuis la
# publication de l'image de base, que le scan d'image bloquerait sinon.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home /app app

WORKDIR /app

COPY --from=build --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH"

USER app

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "mock_api.app:app", "--host", "0.0.0.0", "--port", "8000"]
