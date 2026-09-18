from datetime import datetime

import pandas as pd
import pytest
from fastapi.testclient import TestClient

import api.main as api_main
from api.main import app, get_prediction_model, get_site_schedules
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


def make_history() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "site_id": ["SITE001"] * 168,
            "site_type": ["office"] * 168,
            "timestamp": pd.date_range("2025-01-01", periods=168, freq="h"),
            "consumption_kwh": [10.0] * 168,
            "consumption_kwh_corrected": [10.0] * 168,
        }
    )


def set_prediction_dependencies(monkeypatch) -> None:
    monkeypatch.setenv("PARQUET_DIR", "/data")
    app.dependency_overrides[get_prediction_model] = ConstantModel
    app.dependency_overrides[get_site_schedules] = lambda: SCHEDULES
    monkeypatch.setattr(
        api_main, "read_recent_history", lambda path, site_ids: make_history()
    )


def test_get_data_path_reads_parquet_dir_env_var(monkeypatch):
    monkeypatch.setenv("PARQUET_DIR", "/data")

    assert api_main.get_data_path() == "/data"


def test_get_data_path_requires_the_env_var(monkeypatch):
    monkeypatch.delenv("PARQUET_DIR", raising=False)

    with pytest.raises(RuntimeError, match="PARQUET_DIR is not set"):
        api_main.get_data_path()


def test_run_loads_the_root_env_before_starting_uvicorn(monkeypatch):
    calls = []
    monkeypatch.setattr(api_main, "load_root_env", lambda: calls.append("env"))
    monkeypatch.setattr("uvicorn.run", lambda *args, **kwargs: calls.append("uvicorn"))

    api_main.run()

    assert calls == ["env", "uvicorn"]


def test_predictions_endpoint_accepts_and_returns_a_list(monkeypatch):
    set_prediction_dependencies(monkeypatch)
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


def test_predictions_endpoint_rejects_more_than_168_requests(monkeypatch):
    set_prediction_dependencies(monkeypatch)
    client = TestClient(app)
    request = {"site_id": "SITE001", "date": "2025-01-08", "hour": 0}

    response = client.post("/predictions", json=[request] * 169)
    app.dependency_overrides.clear()

    assert response.status_code == 422


def test_training_endpoint_returns_training_summary(monkeypatch):
    monkeypatch.setenv("PARQUET_DIR", "/data")
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


def test_predictions_reload_history_but_reuse_model_and_schedules(monkeypatch):
    monkeypatch.setenv("PARQUET_DIR", "/data")
    calls = {"model": 0, "history": 0, "schedules": 0}

    def fake_load_model(path):
        calls["model"] += 1
        return ConstantModel()

    def fake_read_recent_history(path, site_ids):
        calls["history"] += 1
        return make_history()

    def fake_load_schedules(path):
        calls["schedules"] += 1
        return SCHEDULES

    monkeypatch.setattr(api_main, "load_model", fake_load_model)
    monkeypatch.setattr(api_main, "read_recent_history", fake_read_recent_history)
    monkeypatch.setattr(api_main, "load_site_schedules", fake_load_schedules)
    api_main.get_prediction_model.cache_clear()
    api_main.get_site_schedules.cache_clear()
    client = TestClient(app)
    request = [{"site_id": "SITE001", "date": "2025-01-08", "hour": 0}]

    first_response = client.post("/predictions", json=request)
    second_response = client.post("/predictions", json=request)

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert calls == {"model": 1, "history": 2, "schedules": 1}

    api_main.get_prediction_model.cache_clear()
    api_main.get_site_schedules.cache_clear()
