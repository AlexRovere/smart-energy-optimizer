from dataclasses import dataclass
from pathlib import Path

import mlflow
from catboost import CatBoostRegressor

from data import read_training_history
from features import FEATURE_COLUMNS, add_training_features


TARGET_COLUMN = "consumption_kwh_corrected"
CATEGORICAL_FEATURES = ["site_id", "site_type"]
MLFLOW_EXPERIMENT = "enervision-training"
MLFLOW_MODEL_NAME = "enervision-catboost"

@dataclass(frozen=True)
class TrainingResult:
    model_version: int
    training_rows: int
    sites: int
    training_start: str
    training_end: str


def train_model(data_path: str | Path) -> TrainingResult:
    """Train and save the final CatBoost configuration selected in the notebook."""
    history = read_training_history(data_path)
    featured = add_training_features(history)

    # The notebook uses the first 70% for training, the next 15% for
    # validation and the final 15% for testing. Once the choices are frozen,
    # its final model is fitted on train + validation, never on the test block.
    validation_end = history["timestamp"].quantile(0.85)
    training_data = featured[featured["timestamp"] <= validation_end].dropna(
        subset=FEATURE_COLUMNS + [TARGET_COLUMN]
    )
    if training_data.empty:
        raise ValueError("Not enough complete history to train the model")

    params = dict(
        iterations=1000,
        depth=8,
        learning_rate=0.10,
        loss_function="RMSE",
        random_seed=42,
        verbose=False,
        allow_writing_files=False,
    )

    model = CatBoostRegressor(**params)

    mlflow.set_experiment(MLFLOW_EXPERIMENT)
    with mlflow.start_run() as run:
        mlflow.log_params({k: v for k, v in params.items()
                           if k not in ("verbose", "allow_writing_files")})
        model.fit(
            training_data[FEATURE_COLUMNS],
            training_data[TARGET_COLUMN],
            cat_features=CATEGORICAL_FEATURES,
        )

        mlflow.log_params({
            "training_start": training_data["timestamp"].min().isoformat(),
            "training_end": training_data["timestamp"].max().isoformat(),
        })
        mlflow.log_metric("training_rows", len(training_data))
        mlflow.catboost.log_model(model, artifact_path="catboost-model")

    model_info = mlflow.register_model(
        f"runs:/{run.info.run_id}/catboost-model",
        MLFLOW_MODEL_NAME
    )
    client = mlflow.MlflowClient()
    client.set_registered_model_alias(MLFLOW_MODEL_NAME, "champion", model_info.version)
    return TrainingResult(
        model_version=int(model_info.version),
        training_rows=len(training_data),
        sites=training_data["site_id"].nunique(),
        training_start=training_data["timestamp"].min().isoformat(),
        training_end=training_data["timestamp"].max().isoformat(),
    )
