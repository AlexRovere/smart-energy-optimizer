from pathlib import Path

import pandas as pd


# Weather columns are intentionally absent: the notebook showed that they did
# not improve validation results, so the final CatBoost model does not use them.
REQUIRED_COLUMNS = [
    "site_id",
    "site_type",
    "timestamp",
    "consumption_kwh",
    "hour",
    "day_of_week",
    "month",
    "is_weekend",
    "is_working_hours",
]


def read_history(path: str | Path) -> pd.DataFrame:
    """Read CSV or Parquet data and apply the notebook basic cleaning."""
    data_path = Path(path)
    if not data_path.is_file():
        raise FileNotFoundError(f"Consumption history not found: {data_path}")

    if data_path.suffix.lower() == ".csv":
        data = pd.read_csv(data_path)
    elif data_path.suffix.lower() in {".parquet", ".pq"}:
        data = pd.read_parquet(data_path)
    else:
        raise ValueError("Consumption history must be a CSV or Parquet file")

    missing_columns = set(REQUIRED_COLUMNS).difference(data.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"Missing history columns: {missing}")

    # Keep the raw target unchanged. The corrected value is used only to build
# lags when a simulated sensor outage left consumption_kwh empty.
    history = data[REQUIRED_COLUMNS].copy()
    history["timestamp"] = pd.to_datetime(history["timestamp"], errors="raise")
    history = history.sort_values(["site_id", "timestamp"]).reset_index(drop=True)

    if history.duplicated(["site_id", "timestamp"]).any():
        raise ValueError("A site cannot have two rows for the same timestamp")

    history["consumption_kwh_corrected"] = history.groupby(
        "site_id", sort=False
    )["consumption_kwh"].ffill()
    return history
