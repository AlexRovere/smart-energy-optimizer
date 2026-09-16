FROM python:3.12-slim

# Copy uv from its official image instead of installing it with pip.
COPY --from=ghcr.io/astral-sh/uv:0.12.15 /uv /uvx /bin/

WORKDIR /app

# uv creates the virtual environment in /app/.venv. Adding it to PATH lets the
# container start uvicorn directly, without keeping uv as the parent process.
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" \
    ML_DATA_PATH=/app/datas/all_sites_combined.csv \
    ML_MODEL_PATH=/app/artifacts/catboost_model.cbm \
    ML_SITE_CONFIG_PATH=/app/config/sites.json

# Install dependencies first. Docker can reuse this slow layer while only the
# application source code changes.
COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-dev --no-install-project

COPY src ./src
COPY config ./config
RUN uv sync --frozen --no-dev

# The CSV is mounted read-only. The artifact directory stays writable because
# POST /training saves the new CatBoost model there.
RUN useradd --create-home --uid 10001 app \
    && mkdir -p /app/datas /app/artifacts \
    && chown -R app:app /app/datas /app/artifacts

USER app

EXPOSE 8000

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
