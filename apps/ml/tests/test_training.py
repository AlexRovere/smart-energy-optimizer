from pathlib import Path

import pandas as pd

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
    directory = tmp_path / "history"
    partition = directory / "site_id=SITE001"
    partition.mkdir(parents=True)
    data_path = directory
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
    ).to_parquet(partition / "part-1.parquet")
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
