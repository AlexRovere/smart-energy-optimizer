from datetime import datetime

import pandas as pd
import pytest
from features import (
    add_training_features,
    build_prediction_features,
    is_working_hour,
    load_site_schedules,
)

SCHEDULES = {
    "SITE001": {
        "working_days": [0, 1, 2, 3, 4],
        "start_hour": 8,
        "end_hour_inclusive": 18,
    }
}


def test_prediction_features_use_timestamp_schedule_and_past_history():
    history = list(range(168))

    features = build_prediction_features(
        site_id="SITE001",
        site_type="office",
        timestamp=datetime(2025, 1, 6, 9),
        history=history,
        schedules=SCHEDULES,
    ).iloc[0]

    assert features["hour"] == 9
    assert features["day_of_week"] == 0
    assert features["month"] == 1
    assert features["is_weekend"] == 0
    assert features["is_working_hours"] == 1
    assert features["consumption_lag_1h"] == 167
    assert features["consumption_lag_2h"] == 166
    assert features["consumption_lag_168h"] == 0
    assert features["rolling_mean_24h"] == sum(range(144, 168)) / 24
    assert features["rolling_mean_168h"] == sum(range(168)) / 168


def test_training_keeps_calendar_values_from_dataset():
    data = pd.DataFrame(
        {
            "site_id": ["SITE001"] * 169,
            "site_type": ["office"] * 169,
            "timestamp": pd.date_range("2025-01-01", periods=169, freq="h"),
            "consumption_kwh_corrected": range(169),
            "hour": [7] * 169,
            "day_of_week": [4] * 169,
            "month": [12] * 169,
            "is_weekend": [1] * 169,
            "is_working_hours": [0] * 169,
        }
    )

    featured = add_training_features(data)

    assert featured.loc[168, "consumption_lag_168h"] == 0
    assert featured.loc[168, "rolling_mean_168h"] == sum(range(168)) / 168
    assert featured.loc[168, "hour"] == 7
    assert featured.loc[168, "day_of_week"] == 4
    assert featured.loc[168, "month"] == 12
    assert featured.loc[168, "is_weekend"] == 1
    assert featured.loc[168, "is_working_hours"] == 0


def test_working_hours_reject_unknown_site():
    with pytest.raises(ValueError, match="No working-hours configuration"):
        is_working_hour("UNKNOWN", datetime(2025, 1, 6, 9), SCHEDULES)


def test_schedule_loader_rejects_invalid_hours(tmp_path):
    path = tmp_path / "sites.json"
    path.write_text('{"SITE001": {"start_hour": 18, "end_hour_inclusive": 8, "working_days": [0]}}')

    with pytest.raises(ValueError, match="Invalid working-hours configuration"):
        load_site_schedules(path)
