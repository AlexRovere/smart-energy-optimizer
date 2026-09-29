import math
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
    """Read the latest training years from a Parquet directory."""
    if years < 1:
        raise ValueError("Training history years must be greater than zero")

    files = _find_parquet_files(Path(path))
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

    directory = Path(path)
    if not directory.is_dir():
        raise FileNotFoundError(f"Expected a Parquet directory: {directory}")
    if next(_site_parquet_files(directory), None) is None:
        raise FileNotFoundError(f"No Parquet files found in: {directory}")

    # Read extra rows so forward fill can use values preceding the final
    # 168-hour window when its first consumption values are missing.
    query_limit = hours * 2
    frames = [_read_site_tail(directory, site_id, query_limit) for site_id in unique_site_ids]
    data = pd.concat([frame for frame in frames if not frame.empty] or [_empty_history()])

    history = _prepare_history(data)
    return (
        history.groupby("site_id", sort=False, group_keys=False).tail(hours).reset_index(drop=True)
    )


def _read_site_tail(directory: Path, site_id: str, rows: int) -> pd.DataFrame:
    """Read the last rows of one site, opening only its most recent days.

    The ETL writes one file per site and per day, so the history grows by
    thousands of files a year. Starting from enough days for the requested
    rows, the window doubles until it holds them or covers the whole site: a
    gap or a stopped ETL costs a second read, never fewer rows.
    """
    # One more day than the rows need: the most recent day is usually partial.
    days = math.ceil(rows / 24) + 1
    while True:
        files, complete = _recent_site_files(directory, site_id, days)
        if not files:
            return pd.DataFrame()
        query = f"""
            SELECT *
            FROM {_parquet_source(files)}
            WHERE site_id = ?
            ORDER BY CAST(timestamp AS TIMESTAMP) DESC
            LIMIT ?
        """
        with duckdb.connect() as connection:
            data = connection.execute(query, [site_id, rows]).fetch_df()
        if len(data) >= rows or complete:
            return data
        days *= 2


def _recent_site_files(directory: Path, site_id: str, days: int) -> tuple[list[Path], bool]:
    """Files of the ``days`` most recent day partitions of a site.

    Returns the files and whether they cover the whole site. A site written
    without date partitions is read whole.
    """
    site_directory = directory / f"site_id={site_id}"
    if not site_directory.is_dir():
        return [], True
    day_directories = sorted(
        (
            day
            for year in _partitions(site_directory, "year")
            for month in _partitions(year, "month")
            for day in _partitions(month, "day")
        ),
        key=_partition_date,
        reverse=True,
    )
    if not day_directories:
        return sorted(_parquet_files(site_directory)), True
    selected = day_directories[:days]
    files = sorted(file for day in selected for file in _parquet_files(day))
    return files, len(selected) == len(day_directories)


def _partitions(directory: Path, key: str) -> list[Path]:
    return [
        child
        for child in directory.iterdir()
        if child.is_dir() and child.name.startswith(f"{key}=")
    ]


def _partition_date(day: Path) -> tuple[int, int, int]:
    # Numeric, so month=10 comes after month=9 with or without a leading zero.
    return tuple(int(part.name.split("=", 1)[1]) for part in (day.parent.parent, day.parent, day))


def _parquet_files(directory: Path):
    return (
        file
        for file in directory.rglob("*")
        if file.is_file() and file.suffix.lower() in {".parquet", ".pq"}
    )


def _site_parquet_files(directory: Path):
    return (file for file in _parquet_files(directory) if "site_id=" in file.as_posix())


def _empty_history() -> pd.DataFrame:
    return pd.DataFrame({column: pd.Series(dtype="object") for column in REQUIRED_COLUMNS})


def read_history(path: str | Path) -> pd.DataFrame:
    """Compatibility alias for the two-year training history."""
    return read_training_history(path)


def _find_parquet_files(directory: Path) -> list[Path]:
    if not directory.is_dir():
        raise FileNotFoundError(f"Expected a Parquet directory: {directory}")

    files = sorted(
        file
        for file in directory.rglob("*")
        if file.is_file()
        and file.suffix.lower() in {".parquet", ".pq"}
        and "site_id=" in file.as_posix()
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
    if history["timestamp"].dt.tz is not None:
        history["timestamp"] = history["timestamp"].dt.tz_convert("UTC").dt.tz_localize(None)
    history = history.sort_values(["site_id", "timestamp"]).reset_index(drop=True)

    if history.duplicated(["site_id", "timestamp"]).any():
        raise ValueError("A site cannot have two rows for the same timestamp")

    history["consumption_kwh_corrected"] = history.groupby("site_id", sort=False)[
        "consumption_kwh"
    ].ffill()
    return history
