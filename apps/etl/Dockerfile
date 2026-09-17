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

RUN groupadd --system app && useradd --system --gid app --home /app app

WORKDIR /app

COPY --from=build --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH"

USER app

CMD ["python", "main.py"]
