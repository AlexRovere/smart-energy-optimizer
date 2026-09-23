# stub CI/local de /api/v1/sites/{site_id}/current, avec la latence et le plafond de la source réelle
from __future__ import annotations

import os
import time
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException

LATENCY_SECONDS = float(os.getenv("MOCK_STUB_LATENCY_MS", "150")) / 1_000
RATE_LIMIT_PER_HOUR = int(os.getenv("MOCK_STUB_RATE_LIMIT_PER_HOUR", "500"))
WINDOW_SECONDS = 3_600.0

app = FastAPI(title="Stub API Mock (CI/local uniquement)")

_recent_calls: list[float] = []


def _prune_old_calls(now: float) -> None:
    cutoff = now - WINDOW_SECONDS
    while _recent_calls and _recent_calls[0] < cutoff:
        _recent_calls.pop(0)


@app.get(
    "/api/v1/sites/{site_id}/current",
    responses={429: {"description": "Quota horaire dépassé"}},
)
def get_current(site_id: str) -> dict[str, object]:
    now = time.monotonic()
    _prune_old_calls(now)

    if len(_recent_calls) >= RATE_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail="Quota horaire dépassé")

    _recent_calls.append(now)
    time.sleep(LATENCY_SECONDS)

    return {
        "timestamp": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f"),
        "site_id": site_id,
        "site_type": "office",
        "consumption_kw": 12.5,
        "consumption_kwh": 12.5,
        "voltage_v": 400.0,
        "current_a": 130.0,
        "power_factor": 0.92,
        "temperature_celsius": 20.0,
        "humidity_percent": 55.0,
        "null_reasons": [],
        "data_quality": "good",
    }
