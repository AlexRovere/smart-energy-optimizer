import mlflow
from catboost import CatBoostRegressor
from training.train import MLFLOW_MODEL_NAME


def load_model(alias: str = "champion") -> CatBoostRegressor:
    """Charge le modèle CatBoost depuis le registre MLflow via son alias."""
    return mlflow.catboost.load_model(f"models:/{MLFLOW_MODEL_NAME}@{alias}")
