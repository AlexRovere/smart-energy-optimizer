import pandas as pd
import pytest

from data import read_history, read_recent_history, read_training_history


def calendar_columns(rows: int) -> dict[str, list[int]]:
    return {
        "hour": [0] * rows,
        "day_of_week": [2] * rows,
        "month": [1] * rows,
        "is_weekend": [0] * rows,
        "is_working_hours": [0] * rows,
    }


def make_rows(site_id: str, timestamps: pd.DatetimeIndex) -> pd.DataFrame:
    rows = len(timestamps)
    return pd.DataFrame(
        {
            "site_id": [site_id] * rows,
            "site_type": ["office"] * rows,
            "timestamp": timestamps,
            "consumption_kwh": range(rows),
            **calendar_columns(rows),
        }
    )


def test_read_history_combines_parquet_files_and_forward_fills(tmp_path):
    directory = tmp_path / "history"
    directory.mkdir()
    make_rows(
        "SITE001", pd.date_range("2025-01-01", periods=1, freq="h")
    ).assign(consumption_kwh=10.0).to_parquet(directory / "part-1.parquet")
    make_rows(
        "SITE001", pd.date_range("2025-01-01 01:00", periods=1, freq="h")
    ).assign(consumption_kwh=None).to_parquet(directory / "part-2.parquet")

    history = read_history(directory)

    assert len(history) == 2
    assert pd.isna(history.loc[1, "consumption_kwh"])
    assert history.loc[1, "consumption_kwh_corrected"] == 10.0


def test_read_history_accepts_current_csv_format(tmp_path):
    path = tmp_path / "history.csv"
    make_rows(
        "SITE001", pd.date_range("2025-01-01", periods=1, freq="h")
    ).to_csv(path, index=False)

    history = read_history(path)

    assert history.loc[0, "timestamp"] == pd.Timestamp("2025-01-01 00:00:00")
    assert history.loc[0, "consumption_kwh_corrected"] == 0.0


def test_recent_history_reads_only_requested_site_and_hours(tmp_path):
    directory = tmp_path / "history"
    directory.mkdir()
    site_one = make_rows(
        "SITE001", pd.date_range("2025-01-01", periods=200, freq="h")
    )
    site_two = make_rows(
        "SITE002", pd.date_range("2025-01-01", periods=200, freq="h")
    )
    site_one.iloc[:100].to_parquet(directory / "part-1.parquet")
    site_one.iloc[100:].to_parquet(directory / "part-2.parquet")
    site_two.to_parquet(directory / "part-3.parquet")

    history = read_recent_history(directory, ["SITE001"], hours=168)

    assert len(history) == 168
    assert history["site_id"].unique().tolist() == ["SITE001"]
    assert history["timestamp"].min() == pd.Timestamp("2025-01-02 08:00:00")


def test_training_history_keeps_only_latest_two_years(tmp_path):
    path = tmp_path / "history.csv"
    timestamps = pd.DatetimeIndex(["2020-01-01", "2023-01-01", "2025-01-01"])
    make_rows("SITE001", timestamps).to_csv(path, index=False)

    history = read_training_history(path, years=2)

    assert history["timestamp"].tolist() == [
        pd.Timestamp("2023-01-01"),
        pd.Timestamp("2025-01-01"),
    ]


def test_single_parquet_file_is_rejected(tmp_path):
    path = tmp_path / "history.parquet"
    make_rows(
        "SITE001", pd.date_range("2025-01-01", periods=1, freq="h")
    ).to_parquet(path)

    with pytest.raises(FileNotFoundError, match="CSV file or Parquet directory"):
        read_history(path)
