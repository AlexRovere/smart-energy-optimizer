from pathlib import Path

from catboost import CatBoostRegressor


def load_model(path: str | Path) -> CatBoostRegressor:
    """Load the CatBoost artifact produced after model training."""
    model_path = Path(path)
    if not model_path.is_file():
        raise FileNotFoundError(f"CatBoost model not found: {model_path}")

    model = CatBoostRegressor()
    model.load_model(str(model_path))
    return model
