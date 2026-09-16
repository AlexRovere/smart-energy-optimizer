from datetime import datetime

import pandas as pd
from fastapi.testclient import TestClient

from api.main import app, get_prediction_service
from models import PredictionService
from training import TrainingResult


SCHEDULES = {
    "SITE001": {
        "working_days": [0, 1, 2, 3, 4, 5, 6],
        "start_hour": 8,
        "end_hour_inclusive": 18,
    }
}


class ConstantModel:
    def predict(self, data: pd.DataFrame) -> list[float]:
        return [42.5]


def make_service() -> PredictionService:
    history = pd.DataFrame(
        {
            "site_id": ["SITE001"] * 168,
            "site_type": ["office"] * 168,
            "timestamp": pd.date_range("2025-01-01", periods=168, freq="h"),
            "consumption_kwh": [10.0] * 168,
            "consumption_kwh_corrected": [10.0] * 168,
        }
    )
    return PredictionService(ConstantModel(), history, SCHEDULES)


def test_predictions_endpoint_accepts_and_returns_a_list():
    app.dependency_overrides[get_prediction_service] = make_service
    client = TestClient(app)

    response = client.post(
        "/predictions",
        json=[
            {"site_id": "SITE001", "date": "2025-01-08", "hour": 1},
            {"site_id": "SITE001", "date": "2025-01-08", "hour": 0},
        ],
    )
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == [
        {
            "site_id": "SITE001",
            "timestamp": datetime(2025, 1, 8, 1).isoformat(),
            "consumption_kwh": 42.5,
        },
        {
            "site_id": "SITE001",
            "timestamp": datetime(2025, 1, 8, 0).isoformat(),
            "consumption_kwh": 42.5,
        },
    ]


def test_predictions_endpoint_rejects_more_than_168_requests():
    app.dependency_overrides[get_prediction_service] = make_service
    client = TestClient(app)
    request = {"site_id": "SITE001", "date": "2025-01-08", "hour": 0}

    response = client.post("/predictions", json=[request] * 169)
    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_training_endpoint_returns_training_summary(monkeypatch):
    monkeypatch.setattr(
        "api.main.train_model",
        lambda data_path, model_path: TrainingResult(
            model_path=model_path,
            training_rows=100,
            sites=2,
            training_start="2023-01-08T00:00:00",
            training_end="2024-09-13T00:00:00",
        ),
    )
    client = TestClient(app)

    response = client.post("/training")

    assert response.status_code == 200
    assert response.json()["training_rows"] == 100
    assert response.json()["sites"] == 2
    assert response.json()["model_path"] == "artifacts/catboost_model.cbm"
