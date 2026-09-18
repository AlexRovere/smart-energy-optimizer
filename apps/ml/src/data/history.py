from collections.abc import Sequence
from pathlib import Path

import duckdb
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


def read_training_history(path: str | Path, years: int = 2) -> pd.DataFrame:
    """Read the latest training years from one CSV or a Parquet directory."""
    if years < 1:
        raise ValueError("Training history years must be greater than zero")

    data_path = Path(path)
    if data_path.is_file() and data_path.suffix.lower() == ".csv":
        history = _prepare_history(pd.read_csv(data_path))
        latest = history["timestamp"].max()
        cutoff = latest - pd.DateOffset(years=years)
        return history[history["timestamp"] >= cutoff].reset_index(drop=True)

    files = _find_parquet_files(data_path)
    source = _parquet_source(files)
    query = f"""
        SELECT *
        FROM {source}
        WHERE CAST(timestamp AS TIMESTAMP) >= (
            SELECT MAX(CAST(timestamp AS TIMESTAMP)) - INTERVAL {years} YEAR
            FROM {source}
        )
    """
    with duckdb.connect() as connection:
        data = connection.execute(query).fetch_df()
    return _prepare_history(data)


def read_recent_history(
    path: str | Path, site_ids: Sequence[str], hours: int = 168
) -> pd.DataFrame:
    """Read only the recent history required by the requested sites."""
    unique_site_ids = list(dict.fromkeys(site_ids))
    if not unique_site_ids:
        raise ValueError("At least one site is required")
    if hours < 1:
        raise ValueError("History hours must be greater than zero")

    data_path = Path(path)
    if data_path.is_file() and data_path.suffix.lower() == ".csv":
        data = pd.read_csv(data_path)
        data = data[data["site_id"].isin(unique_site_ids)]
    else:
        files = _find_parquet_files(data_path)
        source = _parquet_source(files)
        placeholders = ", ".join("?" for _ in unique_site_ids)
        # Read extra rows so forward fill can use values preceding the final
        # 168-hour window when its first consumption values are missing.
        query_limit = hours * 2
        query = f"""
            WITH recent AS (
                SELECT *, ROW_NUMBER() OVER (
                    PARTITION BY site_id
                    ORDER BY CAST(timestamp AS TIMESTAMP) DESC
                ) AS row_number
                FROM {source}
                WHERE site_id IN ({placeholders})
            )
            SELECT * EXCLUDE (row_number)
            FROM recent
            WHERE row_number <= ?
        """
        parameters = [*unique_site_ids, query_limit]
        with duckdb.connect() as connection:
            data = connection.execute(query, parameters).fetch_df()

    history = _prepare_history(data)
    return (
        history.groupby("site_id", sort=False, group_keys=False).tail(hours).reset_index(drop=True)
    )


def read_history(path: str | Path) -> pd.DataFrame:
    """Compatibility alias for the two-year training history."""
    return read_training_history(path)


def _find_parquet_files(directory: Path) -> list[Path]:
    if not directory.is_dir():
        raise FileNotFoundError(f"Expected a CSV file or Parquet directory: {directory}")

    files = sorted(
        file
        for file in directory.rglob("*")
        if file.is_file() and file.suffix.lower() in {".parquet", ".pq"}
    )
    if not files:
        raise FileNotFoundError(f"No Parquet files found in: {directory}")
    return files


def _parquet_source(files: Sequence[Path]) -> str:
    # File paths cannot be SQL parameters inside read_parquet. Escaping quotes
    # keeps paths valid even when a directory name contains an apostrophe.
    quoted_files = ", ".join(
        "'" + file.resolve().as_posix().replace("'", "''") + "'" for file in files
    )
    return f"read_parquet([{quoted_files}], hive_partitioning = true, union_by_name = true)"


def _prepare_history(data: pd.DataFrame) -> pd.DataFrame:
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

    history["consumption_kwh_corrected"] = history.groupby("site_id", sort=False)[
        "consumption_kwh"
    ].ffill()
    return history
