import numpy as np
import pandas as pd
import pytest

from monitoring import compute_relative_mae_by_site

SCHEDULES = {
    "SITE001": {
        "working_days": [0, 1, 2, 3, 4, 5, 6],
        "start_hour": 8,
        "end_hour_inclusive": 18,
    },
    "SITE002": {
        "working_days": [0, 1, 2, 3, 4, 5, 6],
        "start_hour": 8,
        "end_hour_inclusive": 18,
    },
}


class ConstantModel:
    """Always predicts the same value, so the expected error is known in advance."""

    def __init__(self, value: float) -> None:
        self.value = value

    def predict(self, data: pd.DataFrame) -> list[float]:
        return [self.value]


def make_history(site_id: str, hours: int, consumption: float) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "site_id": [site_id] * hours,
            "site_type": ["office"] * hours,
            "timestamp": pd.date_range("2025-01-01", periods=hours, freq="h"),
            "consumption_kwh": [consumption] * hours,
            "consumption_kwh_corrected": [consumption] * hours,
        }
    )


def test_relative_mae_matches_the_manual_calculation():
    # 360 h covers the 7-day replay window, the 168 h of history it needs before
    # its earliest origin, and the 24 h horizon after its latest origin.
    history = make_history("SITE001", hours=360, consumption=80.0)
    model = ConstantModel(value=100.0)

    result = compute_relative_mae_by_site(history, model, SCHEDULES)

    # |100 - 80| / 80 * 100, identical on every replayed hour since both the
    # model and the history are constant.
    assert result["SITE001"] == pytest.approx(25.0)


def test_relative_mae_ignores_hours_with_no_recorded_actual():
    history = make_history("SITE001", hours=360, consumption=80.0)
    # The most recent 24 h have no sensor reading: they fall inside the replay
    # window as a target, never as required input history.
    history.loc[history.index[-24:], "consumption_kwh"] = np.nan

    result = compute_relative_mae_by_site(history, ConstantModel(value=100.0), SCHEDULES)

    assert result["SITE001"] == pytest.approx(25.0)


def test_relative_mae_is_computed_independently_per_site():
    history = pd.concat(
        [
            make_history("SITE001", hours=360, consumption=80.0),
            make_history("SITE002", hours=360, consumption=40.0),
        ],
        ignore_index=True,
    )
    model = ConstantModel(value=100.0)

    result = compute_relative_mae_by_site(history, model, SCHEDULES)

    assert result["SITE001"] == pytest.approx(25.0)
    assert result["SITE002"] == pytest.approx(150.0)


def test_relative_mae_skips_a_site_without_enough_history():
    history = make_history("SITE001", hours=100, consumption=80.0)

    result = compute_relative_mae_by_site(history, ConstantModel(value=100.0), SCHEDULES)

    assert result == {}
