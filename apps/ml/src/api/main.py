import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from pydantic import Field

from api.schemas import PredictionRequest, PredictionResponse, TrainingResponse
from data import read_history
from features import load_site_schedules
from models import PredictionService, PredictionTarget, load_model
from training import train_model


DEFAULT_DATA_PATH = "datas/all_sites_combined.csv"
DEFAULT_MODEL_PATH = "artifacts/catboost_model.cbm"
DEFAULT_SITE_CONFIG_PATH = "config/sites.json"


def get_data_path() -> str:
    return os.getenv("ML_DATA_PATH", DEFAULT_DATA_PATH)


def get_model_path() -> str:
    return os.getenv("ML_MODEL_PATH", DEFAULT_MODEL_PATH)


def get_site_config_path() -> str:
    return os.getenv("ML_SITE_CONFIG_PATH", DEFAULT_SITE_CONFIG_PATH)


@lru_cache(maxsize=1)
def get_prediction_service() -> PredictionService:
    """Load the data and model once, on the first prediction request."""
    try:
        return PredictionService(
            load_model(get_model_path()),
            read_history(get_data_path()),
            load_site_schedules(get_site_config_path()),
        )
    except (FileNotFoundError, ValueError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


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


@app.post("/training", response_model=TrainingResponse)
def create_training() -> TrainingResponse:
    try:
        result = train_model(get_data_path(), get_model_path())
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    # A prediction service may already hold the previous model in memory.
    # Clearing this one-entry cache makes the next prediction load the new file.
    get_prediction_service.cache_clear()
    return TrainingResponse(**result.__dict__)


@app.post("/predictions", response_model=list[PredictionResponse])
def create_predictions(
    requests: PredictionRequests,
    service: Annotated[PredictionService, Depends(get_prediction_service)],
) -> list[PredictionResponse]:
    targets = [
        PredictionTarget(site_id=request.site_id, timestamp=request.timestamp())
        for request in requests
    ]

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
