from datetime import datetime

import pandas as pd
import pytest

from models import PredictionService, PredictionTarget


SCHEDULES = {
    "SITE001": {
        "working_days": [0, 1, 2, 3, 4, 5, 6],
        "start_hour": 8,
        "end_hour_inclusive": 18,
    }
}


class IncrementModel:
    """Predict one more than the latest lag so recursion is easy to verify."""

    def __init__(self) -> None:
        self.calls = 0
        self.feature_rows = []

    def predict(self, data: pd.DataFrame) -> list[float]:
        self.calls += 1
        self.feature_rows.append(data.iloc[0].to_dict())
        return [float(data.iloc[0]["consumption_lag_1h"]) + 1]


def make_history(hours: int = 168) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "site_id": ["SITE001"] * hours,
            "site_type": ["office"] * hours,
            "timestamp": pd.date_range("2025-01-01", periods=hours, freq="h"),
            "consumption_kwh": range(hours),
            "consumption_kwh_corrected": range(hours),
        }
    )


def test_recursive_prediction_fills_intermediate_hours_and_keeps_request_order():
    model = IncrementModel()
    service = PredictionService(model, make_history(), SCHEDULES)

    predictions = service.predict(
        [
            PredictionTarget("SITE001", datetime(2025, 1, 8, 2)),
            PredictionTarget("SITE001", datetime(2025, 1, 8, 0)),
        ]
    )

    assert model.calls == 3
    assert model.feature_rows[0]["consumption_lag_1h"] == 167
    assert model.feature_rows[1]["consumption_lag_1h"] == 168
    assert [prediction.consumption_kwh for prediction in predictions] == [170.0, 168.0]


def test_prediction_rejects_horizon_above_168_hours():
    service = PredictionService(IncrementModel(), make_history(), SCHEDULES)

    with pytest.raises(ValueError, match="between 1 and 168 hours"):
        service.predict(
            [PredictionTarget("SITE001", datetime(2025, 1, 15, 0))]
        )


def test_prediction_rejects_incomplete_hourly_history():
    history = make_history(169).drop(index=100)
    service = PredictionService(IncrementModel(), history, SCHEDULES)

    with pytest.raises(ValueError, match="consecutive hours"):
        service.predict(
            [PredictionTarget("SITE001", datetime(2025, 1, 8, 1))]
        )


def test_prediction_accepts_exactly_168_hour_horizon():
    model = IncrementModel()
    service = PredictionService(model, make_history(), SCHEDULES)

    predictions = service.predict(
        [PredictionTarget("SITE001", datetime(2025, 1, 14, 23))]
    )

    assert model.calls == 168
    assert predictions[0].consumption_kwh == 335.0


def test_prediction_rejects_less_than_168_hours_of_initial_history():
    service = PredictionService(IncrementModel(), make_history(20), SCHEDULES)

    with pytest.raises(ValueError, match="at least 168 hours of history"):
        service.predict(
            [PredictionTarget("SITE001", datetime(2025, 1, 1, 20))]
        )
