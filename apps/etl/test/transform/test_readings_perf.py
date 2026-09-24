# garde-fou de performance de transform_readings() sur un an d'historique, 50 sites
import time

import pandas as pd

from transform.readings import transform_readings

SITES = 50
HOURS_PER_YEAR = 8760
DURATION_THRESHOLD_SECONDS = 5.0


def _make_year_of_readings() -> pd.DataFrame:
    timestamps = pd.date_range("2025-01-01", periods=HOURS_PER_YEAR, freq="h", tz="UTC")
    timestamps_iso = timestamps.astype(str)
    frames = [
        pd.DataFrame(
            {
                "site_id": [f"SITE{site_index:03d}"] * HOURS_PER_YEAR,
                "timestamp": timestamps_iso,
                "site_type": ["office"] * HOURS_PER_YEAR,
                "consumption_kw": [12.5] * HOURS_PER_YEAR,
                "consumption_kwh": [12.5] * HOURS_PER_YEAR,
                "voltage_v": [400.0] * HOURS_PER_YEAR,
                "current_a": [130.0] * HOURS_PER_YEAR,
                "power_factor": [0.92] * HOURS_PER_YEAR,
                "temperature_celsius": [20.0] * HOURS_PER_YEAR,
                "humidity_percent": [55.0] * HOURS_PER_YEAR,
                "data_quality": ["good"] * HOURS_PER_YEAR,
                "null_reasons": [[]] * HOURS_PER_YEAR,
            }
        )
        for site_index in range(SITES)
    ]
    return pd.concat(frames, ignore_index=True)


def test_transform_readings_stays_under_threshold_on_a_year_of_history():
    readings = _make_year_of_readings()

    start = time.perf_counter()
    transform_readings(readings)
    duration = time.perf_counter() - start

    assert duration < DURATION_THRESHOLD_SECONDS
