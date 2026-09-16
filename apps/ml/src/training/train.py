from dataclasses import dataclass
from pathlib import Path

from catboost import CatBoostRegressor

from data import read_history
from features import FEATURE_COLUMNS, add_training_features


TARGET_COLUMN = "consumption_kwh_corrected"
CATEGORICAL_FEATURES = ["site_id", "site_type"]


@dataclass(frozen=True)
class TrainingResult:
    model_path: str
    training_rows: int
    sites: int
    training_start: str
    training_end: str


def train_model(data_path: str | Path, model_path: str | Path) -> TrainingResult:
    """Train and save the final CatBoost configuration selected in the notebook."""
    history = read_history(data_path)
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

    model = CatBoostRegressor(
        iterations=1000,
        depth=8,
        learning_rate=0.10,
        loss_function="RMSE",
        random_seed=42,
        verbose=False,
        allow_writing_files=False,
    )
    model.fit(
        training_data[FEATURE_COLUMNS],
        training_data[TARGET_COLUMN],
        cat_features=CATEGORICAL_FEATURES,
    )

    destination = Path(model_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(str(destination))

    return TrainingResult(
        model_path=str(destination),
        training_rows=len(training_data),
        sites=training_data["site_id"].nunique(),
        training_start=training_data["timestamp"].min().isoformat(),
        training_end=training_data["timestamp"].max().isoformat(),
    )
