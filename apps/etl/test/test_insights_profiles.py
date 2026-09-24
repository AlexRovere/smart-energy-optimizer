import pandas as pd
import pytest
from insights.profiles import build_consumption_profiles


def _row(site_id: str, timestamp: str, consumption: float, temperature: float, humidity: float):
    return {
        "site_id": site_id,
        "site_type": "office",
        "timestamp": timestamp,
        "consumption_kwh_corrected": consumption,
        "temperature_celsius_corrected": temperature,
        "humidity_percent_corrected": humidity,
    }


def test_profiles_balance_sites_before_aggregating_type():
    frame = pd.DataFrame(
        [
            _row("SITE001", "2026-09-07T00:00:00Z", 10.0, 12.0, 42.0),
            _row("SITE001", "2026-09-14T00:00:00Z", 10.0, 17.0, 52.0),
            _row("SITE002", "2026-09-07T00:00:00Z", 30.0, 22.0, 62.0),
        ]
    )

    result = build_consumption_profiles(frame)

    monday_midnight = result["weekday_hour"]["office"][0]
    assert monday_midnight == {
        "day_of_week": 0,
        "hour": 0,
        "mean_kwh": 20.0,
        "samples": 3,
        "sites": 2,
    }
    assert result["summaries"]["office"]["mean_kwh"] == 20.0
    assert result["monthly"]["office"][0]["month"] == 9
    assert [row["site_id"] for row in result["site_monthly"]] == ["SITE001", "SITE002"]
    assert result["temperature"]["office"][0]["label"] == "10–15"
    assert result["peak_thresholds_percent"] == [50, 60, 70, 80, 90, 100]
    site_peaks = result["peaks"]["office"]
    assert site_peaks[0]["thresholds"]["50"]["count"] == 0
    assert site_peaks[1]["thresholds"]["50"]["threshold_kwh"] == 45.0
    assert "Ces relations sont descriptives" in result["summaries"]["office"]["conclusion"]


def test_profiles_reject_missing_columns():
    frame = pd.DataFrame({"site_id": ["SITE001"]})

    with pytest.raises(ValueError, match="Colonnes manquantes"):
        build_consumption_profiles(frame)


def test_peak_threshold_is_relative_to_each_site_mean():
    frame = pd.DataFrame(
        [
            _row("SITE001", "2026-09-07T08:00:00Z", 10.0, 12.0, 42.0),
            _row("SITE001", "2026-09-07T09:00:00Z", 10.0, 12.0, 42.0),
            _row("SITE001", "2026-09-08T10:00:00Z", 30.0, 12.0, 42.0),
        ]
    )

    result = build_consumption_profiles(frame)
    peak = result["peaks"]["office"][0]["thresholds"]["50"]

    assert peak["threshold_kwh"] == 25.0
    assert peak["count"] == 1
    assert peak["rate_percent"] == 33.33
    assert peak["maximum_kwh"] == 30.0
    assert peak["average_excess_kwh"] == 5.0
    assert peak["peak_hour"] == 10
    assert peak["peak_day_of_week"] == 1
