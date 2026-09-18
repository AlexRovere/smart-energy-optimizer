import os
from functools import lru_cache
from typing import Annotated

import mlflow
from catboost import CatBoostRegressor
from fastapi import Depends, FastAPI, HTTPException
from pydantic import Field

from api.schemas import PredictionRequest, PredictionResponse, TrainingResponse
from data import read_recent_history
from features import SiteSchedules, load_site_schedules
from models import PredictionService, PredictionTarget, load_model
from training import MLFLOW_MODEL_NAME, train_model

DEFAULT_DATA_PATH = "datas/all_sites_combined.csv"
DEFAULT_SITE_CONFIG_PATH = "config/sites.json"

mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "sqlite:///artifacts/mlflow.db"))


def get_data_path() -> str:
    return os.getenv("ML_DATA_PATH", DEFAULT_DATA_PATH)


def get_site_config_path() -> str:
    return os.getenv("ML_SITE_CONFIG_PATH", DEFAULT_SITE_CONFIG_PATH)


# Seuls le modèle CatBoost et la configuration changent rarement. Ils restent
# en mémoire, contrairement à l'historique qui est relu à chaque requête.
@lru_cache(maxsize=1)
def get_prediction_model() -> CatBoostRegressor:
    return load_model()


@lru_cache(maxsize=1)
def get_site_schedules() -> SiteSchedules:
    return load_site_schedules(get_site_config_path())


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


@app.get("/model")
def get_model_info() -> dict[str, object]:
    client = mlflow.MlflowClient()
    try:
        version = client.get_model_version_by_alias(MLFLOW_MODEL_NAME, "champion")
    except mlflow.exceptions.MlflowException as error:
        raise HTTPException(status_code=503, detail="Aucun modèle champion disponible") from error
    return {"name": MLFLOW_MODEL_NAME, "version": int(version.version), "alias": "champion"}


@app.post("/training", response_model=TrainingResponse)
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


@app.post("/predictions", response_model=list[PredictionResponse])
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

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000)
