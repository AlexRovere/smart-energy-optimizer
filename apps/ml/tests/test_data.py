import pandas as pd

from data import read_history


def calendar_columns(rows: int) -> dict[str, list[int]]:
    return {
        "hour": [0] * rows,
        "day_of_week": [2] * rows,
        "month": [1] * rows,
        "is_weekend": [0] * rows,
        "is_working_hours": [0] * rows,
    }


def test_read_history_keeps_raw_values_and_forward_fills(tmp_path):
    path = tmp_path / "history.parquet"
    pd.DataFrame(
        {
            "site_id": ["SITE001", "SITE001"],
            "site_type": ["office", "office"],
            "timestamp": ["2025-01-01 00:00:00", "2025-01-01 01:00:00"],
            "consumption_kwh": [10.0, None],
            **calendar_columns(2),
        }
    ).to_parquet(path)

    history = read_history(path)

    assert pd.isna(history.loc[1, "consumption_kwh"])
    assert history.loc[1, "consumption_kwh_corrected"] == 10.0


def test_read_history_accepts_current_csv_format(tmp_path):
    path = tmp_path / "history.csv"
    pd.DataFrame(
        {
            "site_id": ["SITE001"],
            "site_type": ["office"],
            "timestamp": ["2025-01-01 00:00:00"],
            "consumption_kwh": [10.0],
            **calendar_columns(1),
        }
    ).to_csv(path, index=False)

    history = read_history(path)

    assert history.loc[0, "timestamp"] == pd.Timestamp("2025-01-01 00:00:00")
    assert history.loc[0, "consumption_kwh_corrected"] == 10.0
