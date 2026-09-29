import os
import time
from functools import lru_cache
from typing import Annotated

import mlflow
from catboost import CatBoostRegressor
from fastapi import Depends, FastAPI, HTTPException, Response
from monitoring import REPLAY_HISTORY_HOURS, compute_relative_mae_by_site
from prometheus_client import CONTENT_TYPE_LATEST, Gauge, generate_latest
from pydantic import Field

from api.schemas import PredictionRequest, PredictionResponse, TrainingResponse
from data import read_recent_history
from env_loader import load_root_env
from features import SiteSchedules, load_site_schedules
from models import PredictionService, PredictionTarget, load_model
from training import MLFLOW_MODEL_NAME, train_model

DEFAULT_SITE_CONFIG_PATH = "config/sites.json"
MODEL_UNAVAILABLE_DETAIL = "Aucun modèle champion disponible"
SERVICE_UNAVAILABLE_RESPONSE = {503: {"description": "Service temporairement indisponible"}}
UNPROCESSABLE_ENTITY_RESPONSE = {422: {"description": "Requête métier invalide"}}

mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "sqlite:///artifacts/mlflow.db"))


def get_data_path() -> str:
    data_path = os.getenv("PARQUET_DIR")
    if not data_path:
        raise RuntimeError("PARQUET_DIR is not set")
    return data_path


def get_site_config_path() -> str:
    return os.getenv("ML_SITE_CONFIG_PATH", DEFAULT_SITE_CONFIG_PATH)


# Seuls le modèle CatBoost et la configuration changent rarement. Ils restent
# en mémoire, contrairement à l'historique qui est relu à chaque requête.
@lru_cache(maxsize=1)
def get_prediction_model() -> CatBoostRegressor:
    try:
        return load_model()
    except mlflow.exceptions.MlflowException as error:
        # Même réponse que /model : sans ça, l'absence de modèle se présentait
        # en 500, indiscernable d'un service en panne.
        raise HTTPException(status_code=503, detail=MODEL_UNAVAILABLE_DETAIL) from error


@lru_cache(maxsize=1)
def get_site_schedules() -> SiteSchedules:
    return load_site_schedules(get_site_config_path())


# Évite de rejouer ~4700 prédictions par site à chaque scrape (1 min).
FORECAST_ERROR_CACHE_SECONDS = 600

forecast_relative_mae_gauge = Gauge(
    "ml_forecast_relative_mae_percent",
    "Erreur de prévision moyenne relative (MAE / consommation moyenne), "
    "rejouée sur les 7 derniers jours",
    ["site_id"],
)


@lru_cache(maxsize=1)
def _cached_relative_mae_by_site(cache_key: int) -> dict[str, float]:
    schedules = get_site_schedules()
    model = get_prediction_model()
    history = read_recent_history(get_data_path(), list(schedules), hours=REPLAY_HISTORY_HOURS)
    return compute_relative_mae_by_site(history, model, schedules)


def get_relative_mae_by_site() -> dict[str, float]:
    cache_key = int(time.time() // FORECAST_ERROR_CACHE_SECONDS)
    return _cached_relative_mae_by_site(cache_key)


# Une requête contient entre 1 et 168 prédictions horaires,
# ce qui correspond à l'horizon maximal de 7 jours.
PredictionRequests = Annotated[
    list[PredictionRequest],
    Field(min_length=1, max_length=168),
]

app = FastAPI(
    title="EnerVision ML API",
    description="Hourly electricity-consumption forecasts produced by CatBoost.",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/model", responses=SERVICE_UNAVAILABLE_RESPONSE)
def get_model_info() -> dict[str, object]:
    client = mlflow.MlflowClient()
    try:
        version = client.get_model_version_by_alias(MLFLOW_MODEL_NAME, "champion")
    except mlflow.exceptions.MlflowException as error:
        raise HTTPException(status_code=503, detail=MODEL_UNAVAILABLE_DETAIL) from error
    run = client.get_run(version.run_id)
    return {
        "name": MLFLOW_MODEL_NAME,
        "version": int(version.version),
        "alias": "champion",
        "creation_timestamp": run.info.start_time,
        "metrics": run.data.metrics,
    }


@app.get("/metrics", responses=SERVICE_UNAVAILABLE_RESPONSE)
def metrics() -> Response:
    try:
        relative_mae_by_site = get_relative_mae_by_site()
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except mlflow.exceptions.MlflowException as error:
        # Même dégradation que /model : pas de champion à évaluer.
        raise HTTPException(status_code=503, detail=MODEL_UNAVAILABLE_DETAIL) from error

    for site_id, relative_mae in relative_mae_by_site.items():
        forecast_relative_mae_gauge.labels(site_id=site_id).set(relative_mae)

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.post(
    "/training",
    responses=SERVICE_UNAVAILABLE_RESPONSE | UNPROCESSABLE_ENTITY_RESPONSE,
)
def create_training() -> TrainingResponse:
    try:
        result = train_model(get_data_path())
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    # The next prediction must load the model that has just been trained.
    get_prediction_model.cache_clear()
    return TrainingResponse(**result.__dict__)


@app.post(
    "/predictions",
    responses=SERVICE_UNAVAILABLE_RESPONSE | UNPROCESSABLE_ENTITY_RESPONSE,
)
def create_predictions(
    requests: PredictionRequests,
    model: Annotated[CatBoostRegressor, Depends(get_prediction_model)],
    schedules: Annotated[SiteSchedules, Depends(get_site_schedules)],
) -> list[PredictionResponse]:
    targets = [
        PredictionTarget(site_id=request.site_id, timestamp=request.timestamp())
        for request in requests
    ]
    site_ids = list(dict.fromkeys(target.site_id for target in targets))

    try:
        history = read_recent_history(get_data_path(), site_ids)
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    service = PredictionService(model, history, schedules)
    try:
        predictions = service.predict(targets)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return [
        PredictionResponse(
            site_id=prediction.site_id,
            timestamp=prediction.timestamp,
            consumption_kwh=prediction.consumption_kwh,
        )
        for prediction in predictions
    ]


def run() -> None:
    """Run the development server through the ``ml-api`` command."""
    import uvicorn

    load_root_env()
    uvicorn.run("api.main:app", host=os.getenv("ML_API_HOST", "127.0.0.1"), port=8000)
