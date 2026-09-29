import asyncio
import os
import time
from collections import deque
from collections.abc import Awaitable, Callable, Mapping
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from mock_api.catalog import SITES, SITES_BY_ID, Site
from mock_api.generator import reading
from mock_api.park import alerts, sensors_status, summary

DEFAULT_WINDOW = timedelta(hours=24)
QUOTA_WINDOW_SECONDS = 3600.0
API_PREFIX = "/api/v1/"

ROOT = {
    "service": "EnerVision Mock API",
    "version": "1.1.0",
    "status": "running",
    "note": (
        "Cette API génère intentionnellement des valeurs null pour simuler des pannes "
        "capteurs réalistes. Consultez /docs pour la documentation complète."
    ),
    "endpoints": {
        "sites": "/api/v1/sites",
        "site_detail": "/api/v1/sites/{site_id}",
        "current_reading": "/api/v1/sites/{site_id}/current",
        "readings_history": "/api/v1/readings",
        "alerts": "/api/v1/alerts",
        "summary_stats": "/api/v1/stats/summary",
        "sensor_status": "/api/v1/sensors/status",
        "simulate_spike": "/api/v1/simulate/spike/{site_id}",
        "health": "/health",
        "docs": "/docs",
    },
}


def _site_or_404(site_id: str) -> Site:
    site = SITES_BY_ID.get(site_id)
    if site is None:
        raise HTTPException(status_code=404, detail=f"Site {site_id} non trouvé")
    return site


def _as_utc(moment: datetime) -> datetime:
    # Une date sans fuseau est de l'UTC, comme pour l'API réelle.
    return moment.replace(tzinfo=UTC) if moment.tzinfo is None else moment.astimezone(UTC)


def _history_timestamp(moment: datetime) -> str:
    # « Z », et les microsecondes seulement si elles existent : la forme exacte
    # de l'historique réel.
    return moment.replace(tzinfo=None).isoformat() + "Z"


def _current_timestamp(moment: datetime) -> str:
    # Sans fuseau et toujours avec microsecondes, comme la lecture courante réelle.
    return moment.strftime("%Y-%m-%dT%H:%M:%S.%f")


def _spread(start: datetime, end: datetime, count: int) -> list[datetime]:
    # L'API réelle ne pagine pas : elle répartit `count` points à pas constant
    # sur la fenêtre, fin exclue. D'où un point par heure quand l'ETL demande
    # autant de points que d'heures.
    step = (end - start) / count
    return [start + step * i for i in range(count)]


def settings_from_env(env: Mapping[str, str]) -> dict[str, float | int]:
    """Latence et quota, coupés par défaut : seuls les tests de charge les posent.

    Le quota vaut pour tout le processus, pas par client. C'est plus strict que
    la source réelle (500 appels par heure et par client), et suffit à en
    reproduire le goulot pour un seul consommateur.
    """
    return {
        "latency_ms": float(env.get("MOCK_LATENCY_MS", "0")),
        "rate_limit_per_hour": int(env.get("MOCK_RATE_LIMIT_PER_HOUR", "0")),
    }


def create_app(
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
    latency_ms: float = 0.0,
    rate_limit_per_hour: int = 0,
    clock: Callable[[], float] = time.monotonic,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> FastAPI:
    app = FastAPI(title="EnerVision Mock API", version="1.1.0")
    recent_calls: deque[float] = deque()

    @app.middleware("http")
    async def throttle(request: Request, call_next):
        if not request.url.path.startswith(API_PREFIX):
            return await call_next(request)
        if rate_limit_per_hour:
            instant = clock()
            while recent_calls and recent_calls[0] <= instant - QUOTA_WINDOW_SECONDS:
                recent_calls.popleft()
            if len(recent_calls) >= rate_limit_per_hour:
                return JSONResponse(status_code=429, content={"detail": "Quota horaire dépassé"})
            recent_calls.append(instant)
        # Attente asynchrone : un sommeil bloquant ici sérialiserait toutes les
        # requêtes, et le test de charge mesurerait le simulateur, pas le dashboard.
        if latency_ms:
            await sleep(latency_ms / 1000)
        return await call_next(request)

    @app.get("/")
    def root() -> dict[str, object]:
        return ROOT

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "healthy", "timestamp": _current_timestamp(_as_utc(now()))}

    @app.get("/api/v1/sites")
    def list_sites() -> list[dict[str, object]]:
        return [site.info() for site in SITES]

    @app.get("/api/v1/sites/{site_id}")
    def get_site(site_id: str) -> dict[str, object]:
        return _site_or_404(site_id).info()

    @app.get("/api/v1/sites/{site_id}/current")
    def get_current(site_id: str) -> dict[str, object]:
        site = _site_or_404(site_id)
        moment = _as_utc(now())
        return {"timestamp": _current_timestamp(moment), **reading(site, moment)}

    @app.get("/api/v1/readings")
    def get_readings(
        site_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    ) -> list[dict[str, object]]:
        end = _as_utc(end_time) if end_time else _as_utc(now())
        start = _as_utc(start_time) if start_time else end - DEFAULT_WINDOW
        if site_id is None:
            sites = list(SITES)
            per_site = limit // len(sites)
        else:
            sites = [SITES_BY_ID[site_id]] if site_id in SITES_BY_ID else []
            per_site = limit
        if per_site == 0:
            return []

        return [
            {"timestamp": _history_timestamp(moment), **reading(site, moment)}
            for moment in _spread(start, end, per_site)
            for site in sites
        ]

    @app.get("/api/v1/alerts")
    def get_alerts(
        site_id: str | None = None, severity: str | None = None
    ) -> list[dict[str, object]]:
        return [
            alert
            for alert in alerts(_as_utc(now()))
            if (site_id is None or alert["site_id"] == site_id)
            and (severity is None or alert["severity"] == severity)
        ]

    @app.get("/api/v1/sensors/status")
    def get_sensors_status() -> dict[str, object]:
        return sensors_status(_as_utc(now()))

    @app.get("/api/v1/stats/summary")
    def get_summary() -> dict[str, object]:
        return summary(_as_utc(now()))

    return app


app = create_app(**settings_from_env(os.environ))
