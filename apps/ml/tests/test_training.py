from pathlib import Path

import mlflow
import pandas as pd

from features import FEATURE_COLUMNS
from training.train import CATEGORICAL_FEATURES, MLFLOW_EXPERIMENT, MLFLOW_MODEL_NAME, train_model


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


def _make_csv(tmp_path: Path) -> Path:
    data_path = tmp_path / "history.csv"


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
    monkeypatch.setattr("mlflow.catboost.log_model", lambda *a, **kw: None)
    monkeypatch.setattr("mlflow.register_model", lambda *a, **kw: type("R", (), {"version": "1"})())
    monkeypatch.setattr("mlflow.MlflowClient.set_registered_model_alias", lambda *a, **kw: None)
    mlflow.set_tracking_uri(f"sqlite:///{tmp_path}/mlflow.db")

    result = train_model(data_path)
    model = FakeCatBoost.last_instance

    assert model.parameters["iterations"] == 1000
    assert model.parameters["depth"] == 8
    assert model.parameters["learning_rate"] == 0.10
    assert model.categories == CATEGORICAL_FEATURES
    assert list(model.features.columns) == FEATURE_COLUMNS
    assert result.training_rows == len(model.features)
    assert result.sites == 1


def test_training_creates_a_mlflow_run(tmp_path):
    data_path = _make_csv(tmp_path)
    mlflow.set_tracking_uri(f"sqlite:///{tmp_path}/mlflow.db")

    train_model(data_path)

    runs = mlflow.search_runs(experiment_names=[MLFLOW_EXPERIMENT])
    assert len(runs) == 1


def test_training_logs_hyperparameters(tmp_path):
    data_path = _make_csv(tmp_path)
    mlflow.set_tracking_uri(f"sqlite:///{tmp_path}/mlflow.db")

    train_model(data_path)

    runs = mlflow.search_runs(experiment_names=[MLFLOW_EXPERIMENT])
    run = runs.iloc[0]
    assert run["params.iterations"] == "1000"
    assert run["params.depth"] == "8"
    assert run["params.learning_rate"] == "0.1"
    assert run["params.loss_function"] == "RMSE"


def test_training_logue_la_fenetre_temporelle(tmp_path):
    data_path = _make_csv(tmp_path)
    mlflow.set_tracking_uri(f"sqlite:///{tmp_path}/mlflow.db")

    train_model(data_path)

    runs = mlflow.search_runs(experiment_names=[MLFLOW_EXPERIMENT])
    run = runs.iloc[0]
    assert run["params.training_start"] is not None
    assert run["params.training_end"] is not None


def test_training_registre_le_modele_dans_mlflow(tmp_path):
    data_path = _make_csv(tmp_path)
    mlflow.set_tracking_uri(f"sqlite:///{tmp_path}/mlflow.db")

    result = train_model(data_path)

    client = mlflow.MlflowClient()
    versions = client.search_model_versions(f"name='{MLFLOW_MODEL_NAME}'")
    assert len(versions) == 1
    assert result.model_version == int(versions[0].version)


def test_training_pose_lalias_champion(tmp_path):
    data_path = _make_csv(tmp_path)
    mlflow.set_tracking_uri(f"sqlite:///{tmp_path}/mlflow.db")

    train_model(data_path)

    client = mlflow.MlflowClient()
    version = client.get_model_version_by_alias(MLFLOW_MODEL_NAME, "champion")
    assert version is not None
