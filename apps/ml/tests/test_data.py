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
    partition = directory / "site_id=SITE001"
    partition.mkdir(parents=True)
    make_rows("SITE001", pd.date_range("2025-01-01", periods=1, freq="h")).assign(
        consumption_kwh=10.0
    ).to_parquet(partition / "part-1.parquet")
    make_rows("SITE001", pd.date_range("2025-01-01 01:00", periods=1, freq="h")).assign(
        consumption_kwh=None
    ).to_parquet(partition / "part-2.parquet")

    history = read_history(directory)

    assert len(history) == 2
    assert pd.isna(history.loc[1, "consumption_kwh"])
    assert history.loc[1, "consumption_kwh_corrected"] == 10.0


def test_recent_history_reads_only_requested_site_and_hours(tmp_path):
    directory = tmp_path / "history"
    partition_one = directory / "site_id=SITE001"
    partition_two = directory / "site_id=SITE002"
    partition_one.mkdir(parents=True)
    partition_two.mkdir(parents=True)
    site_one = make_rows("SITE001", pd.date_range("2025-01-01", periods=200, freq="h"))
    site_two = make_rows("SITE002", pd.date_range("2025-01-01", periods=200, freq="h"))
    site_one.iloc[:100].to_parquet(partition_one / "part-1.parquet")
    site_one.iloc[100:].to_parquet(partition_one / "part-2.parquet")
    site_two.to_parquet(partition_two / "part-3.parquet")

    history = read_recent_history(directory, ["SITE001"], hours=168)

    assert len(history) == 168
    assert history["site_id"].unique().tolist() == ["SITE001"]
    assert history["timestamp"].min() == pd.Timestamp("2025-01-02 08:00:00")


def test_training_history_keeps_only_latest_two_years(tmp_path):
    directory = tmp_path / "history"
    partition = directory / "site_id=SITE001"
    partition.mkdir(parents=True)
    timestamps = pd.DatetimeIndex(["2020-01-01", "2023-01-01", "2025-01-01"])
    make_rows("SITE001", timestamps).to_parquet(partition / "part-1.parquet")

    history = read_training_history(directory, years=2)

    assert history["timestamp"].tolist() == [
        pd.Timestamp("2023-01-01"),
        pd.Timestamp("2025-01-01"),
    ]


def test_read_history_ignores_files_outside_a_site_partition(tmp_path):
    directory = tmp_path / "history"
    partition = directory / "site_id=SITE001"
    partition.mkdir(parents=True)
    make_rows("SITE001", pd.date_range("2025-01-01", periods=1, freq="h")).to_parquet(
        partition / "readings.parquet"
    )
    pd.DataFrame({"id": ["SITE001"], "name": ["Bureau Paris"], "capacity_kw": [100]}).to_parquet(
        directory / "sites.parquet"
    )

    history = read_history(directory)

    assert len(history) == 1
    assert history.loc[0, "site_id"] == "SITE001"


def test_read_history_drops_the_timezone_from_etl_timestamps(tmp_path):
    directory = tmp_path / "history"
    partition = directory / "site_id=SITE001"
    partition.mkdir(parents=True)
    rows = make_rows("SITE001", pd.date_range("2025-01-01", periods=1, freq="h", tz="UTC"))
    rows.to_parquet(partition / "readings.parquet")

    history = read_history(directory)

    assert history["timestamp"].dt.tz is None
    assert history.loc[0, "timestamp"] == pd.Timestamp("2025-01-01T00:00:00")


def test_single_parquet_file_is_rejected(tmp_path):
    path = tmp_path / "history.parquet"
    make_rows("SITE001", pd.date_range("2025-01-01", periods=1, freq="h")).to_parquet(path)

    with pytest.raises(FileNotFoundError, match="Parquet directory"):
        read_history(path)


def write_days(directory, site_id, start, days, rows_per_day=24):
    """Écrit l'arbre de l'ETL : site_id=/year=/month=/day=/readings.parquet."""
    first_day = pd.Timestamp(start)
    for offset in range(days):
        day = first_day + pd.Timedelta(days=offset)
        partition = (
            directory
            / f"site_id={site_id}"
            / f"year={day.year}"
            / f"month={day.month:02d}"
            / f"day={day.day:02d}"
        )
        partition.mkdir(parents=True)
        timestamps = pd.date_range(day, periods=rows_per_day, freq=f"{24 // rows_per_day}h")
        make_rows(site_id, timestamps).to_parquet(partition / "readings.parquet")


def files_read(monkeypatch):
    """Capture les fichiers remis à DuckDB."""
    import data.history as history_module

    captured: list = []
    original = history_module._parquet_source

    def spy(files):
        captured.extend(files)
        return original(files)

    monkeypatch.setattr(history_module, "_parquet_source", spy)
    return captured


def test_recent_history_opens_only_recent_days_of_requested_sites(tmp_path, monkeypatch):
    directory = tmp_path / "history"
    write_days(directory, "SITE001", "2025-01-01", days=60)
    write_days(directory, "SITE002", "2025-01-01", days=60)
    captured = files_read(monkeypatch)

    history = read_recent_history(directory, ["SITE001"], hours=168)

    assert len(history) == 168
    assert history["timestamp"].max() == pd.Timestamp("2025-03-01 23:00:00")
    assert all("site_id=SITE001" in file.as_posix() for file in captured)
    # 336 lignes utiles au plus (le double de la fenêtre, pour le forward fill),
    # soit 14 jours, plus un de marge : jamais les 60 jours du site.
    assert len(captured) <= 15


def test_recent_history_matches_a_full_read_including_forward_fill(tmp_path):
    directory = tmp_path / "history"
    write_days(directory, "SITE001", "2025-01-01", days=30)
    # Les premières heures de la fenêtre sont vides : le forward fill doit
    # reprendre une valeur antérieure à la fenêtre, donc lue quand même.
    day = directory / "site_id=SITE001" / "year=2025" / "month=01" / "day=24"
    rows = pd.read_parquet(day / "readings.parquet")
    rows["consumption_kwh"] = None
    rows.to_parquet(day / "readings.parquet")

    history = read_recent_history(directory, ["SITE001"], hours=168)

    first = history.iloc[0]
    assert first["timestamp"] == pd.Timestamp("2025-01-24 00:00:00")
    assert pd.isna(first["consumption_kwh"])
    assert first["consumption_kwh_corrected"] == 23


def test_recent_history_widens_the_window_when_recent_days_are_sparse(tmp_path):
    directory = tmp_path / "history"
    # Trente jours complets, puis vingt jours où l'ETL n'a écrit qu'une ligne.
    write_days(directory, "SITE001", "2025-01-01", days=30)
    write_days(directory, "SITE001", "2025-01-31", days=20, rows_per_day=1)

    history = read_recent_history(directory, ["SITE001"], hours=168)

    assert len(history) == 168
    assert history["timestamp"].max() == pd.Timestamp("2025-02-19 00:00:00")
    assert history["timestamp"].min() == pd.Timestamp("2025-01-24 20:00:00")


def test_recent_history_is_empty_for_a_site_without_data(tmp_path):
    directory = tmp_path / "history"
    write_days(directory, "SITE001", "2025-01-01", days=2)

    assert read_recent_history(directory, ["SITE999"], hours=24).empty


def test_recent_history_rejects_a_missing_directory(tmp_path):
    with pytest.raises(FileNotFoundError, match="Expected a Parquet directory"):
        read_recent_history(tmp_path / "absent", ["SITE001"])


def test_recent_history_rejects_a_directory_without_parquet(tmp_path):
    (tmp_path / "site_id=SITE001").mkdir()

    with pytest.raises(FileNotFoundError, match="No Parquet files found"):
        read_recent_history(tmp_path, ["SITE001"])
