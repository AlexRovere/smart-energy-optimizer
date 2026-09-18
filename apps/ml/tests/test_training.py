from pathlib import Path

import pandas as pd
import mlflow

from features import FEATURE_COLUMNS
from training.train import CATEGORICAL_FEATURES, train_model


class FakeCatBoost:
    last_instance = None

    def __init__(self, **parameters) -> None:
        self.parameters = parameters
        self.features = None
        self.categories = None
        FakeCatBoost.last_instance = self

    def fit(self, features, target, cat_features) -> None:
        self.features = features
        self.categories = cat_features

    def save_model(self, path: str) -> None:
        Path(path).write_text("fake model")


def test_training_uses_notebook_configuration_and_saves_model(tmp_path, monkeypatch):
    data_path = tmp_path / "history.csv"
    model_path = tmp_path / "artifacts" / "model.cbm"
    hours = 400
    timestamps = pd.date_range("2025-01-01", periods=hours, freq="h")
    pd.DataFrame(
        {
            "site_id": ["SITE001"] * hours,
            "site_type": ["office"] * hours,
            "timestamp": timestamps,
            "consumption_kwh": range(hours),
            "hour": timestamps.hour,
            "day_of_week": timestamps.dayofweek,
            "month": timestamps.month,
            "is_weekend": (timestamps.dayofweek >= 5).astype(int),
            "is_working_hours": [1] * hours,
        }
    ).to_csv(data_path, index=False)
    monkeypatch.setattr("training.train.CatBoostRegressor", FakeCatBoost)

    result = train_model(data_path, model_path)
    model = FakeCatBoost.last_instance

    assert model_path.read_text() == "fake model"
    assert model.parameters["iterations"] == 1000
    assert model.parameters["depth"] == 8
    assert model.parameters["learning_rate"] == 0.10
    assert model.categories == CATEGORICAL_FEATURES
    assert list(model.features.columns) == FEATURE_COLUMNS
    assert result.training_rows == len(model.features)
    assert result.sites == 1

def test_training_creates_a_mlflow_run(tmp_path, monkeypatch):
    data_path = tmp_path / "history.csv"
    model_path = tmp_path / "artifacts" / "model.cbm"
    hours = 400
    timestamps = pd.date_range("2025-01-01", periods=hours, freq="h")
    pd.DataFrame(
        {
            "site_id": ["SITE001"] * hours,
            "site_type": ["office"] * hours,
            "timestamp": timestamps,
            "consumption_kwh": range(hours),
            "hour": timestamps.hour,
            "day_of_week": timestamps.dayofweek,
            "month": timestamps.month,
            "is_weekend": (timestamps.dayofweek >= 5).astype(int),
            "is_working_hours": [1] * hours,
        }
    ).to_csv(data_path, index=False)
    monkeypatch.setattr("training.train.CatBoostRegressor", FakeCatBoost)
    mlflow.set_tracking_uri(f"sqlite:///{tmp_path}/mlflow.db")

    train_model(data_path, model_path)

    runs = mlflow.search_runs(experiment_names=["enervision-training"])
    assert len(runs) == 1

def test_training_logs_hyperparameters(tmp_path, monkeypatch):
    data_path = tmp_path / "history.csv"
    model_path = tmp_path / "artifacts" / "model.cbm"
    hours = 400
    timestamps = pd.date_range("2025-01-01", periods=hours, freq="h")
    pd.DataFrame(
        {
            "site_id": ["SITE001"] * hours,
            "site_type": ["office"] * hours,
            "timestamp": timestamps,
            "consumption_kwh": range(hours),
            "hour": timestamps.hour,
            "day_of_week": timestamps.dayofweek,
            "month": timestamps.month,
            "is_weekend": (timestamps.dayofweek >= 5).astype(int),
            "is_working_hours": [1] * hours,
        }
    ).to_csv(data_path, index=False)
    monkeypatch.setattr("training.train.CatBoostRegressor", FakeCatBoost)
    mlflow.set_tracking_uri(f"sqlite:///{tmp_path}/mlflow.db")

    train_model(data_path, model_path)

    runs = mlflow.search_runs(experiment_names=["enervision-training"])
    run = runs.iloc[0]
    assert run["params.iterations"] == "1000"
    assert run["params.depth"] == "8"
    assert run["params.learning_rate"] == "0.1"
    assert run["params.loss_function"] == "RMSE"