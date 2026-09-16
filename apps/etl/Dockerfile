# syntax=docker/dockerfile:1

# ---- build ----
FROM python:3.12-slim AS build

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# ---- runtime ----
FROM python:3.12-slim AS runtime

RUN groupadd --system app && useradd --system --gid app --home /app app

WORKDIR /app

COPY --from=build /opt/venv /opt/venv
COPY --from=build --chown=app:app /app /app

ENV PATH="/opt/venv/bin:$PATH"

USER app

CMD ["python", "main.py"]
