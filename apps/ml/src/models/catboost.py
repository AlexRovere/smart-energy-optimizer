import mlflow

from catboost import CatBoostRegressor


def load_model(alias: str = "champion") -> CatBoostRegressor:
    """Load the CatBoost model from MLflow registry with its alias."""
    from training.train import MLFLOW_MODEL_NAME
    return mlflow.catboost.load_model(f"models:/{MLFLOW_MODEL_NAME}@{alias}")
