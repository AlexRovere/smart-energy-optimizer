# teste la transformation de l'historique des mesures : clone {colonne}_corrected, sans règle de nettoyage pour l'instant
import pandas as pd

from transform.readings import (
    CORRECTABLE_COLUMNS,
    LAG_HOURS,
    ROLLING_WINDOWS_HOURS,
    add_calendar_features,
    add_consumption_lags,
    add_rolling_means,
    align_timestamps_to_the_hour,
    transform_readings,
)

ROLLING_COLUMNS = [f"rolling_mean_{hours}h" for hours in ROLLING_WINDOWS_HOURS]

SAMPLE_ROW = {
    "site_id": "SITE001",
    "timestamp": "2026-09-15T00:00:00Z",
    "site_type": "office",
    "consumption_kw": 12.5,
    "consumption_kwh": 12.5,
    "voltage_v": 400.0,
    "current_a": 130.0,
    "power_factor": 0.92,
    "temperature_celsius": 20.0,
    "humidity_percent": 55.0,
    "data_quality": "good",
    "null_reasons": [],
}

NULL_ROW = {
    **SAMPLE_ROW,
    "site_id": "SITE002",
    "consumption_kw": None,
    "consumption_kwh": None,
    "voltage_v": None,
    "current_a": None,
    "power_factor": None,
    "temperature_celsius": None,
    "humidity_percent": None,
    "data_quality": "critical",
    "null_reasons": ["network_loss"],
}


CALENDAR_COLUMNS = ["hour", "day_of_week", "month", "is_weekend", "is_working_hours"]


def test_align_timestamps_to_the_hour_rounds_to_the_nearest_hour():
    readings = pd.DataFrame(
        [
            {"timestamp": "2026-09-15T03:18:25Z"},
            {"timestamp": "2026-09-15T04:10:52Z"},
            {"timestamp": "2026-09-15T04:59:14Z"},
        ]
    )

    result = align_timestamps_to_the_hour(readings)

    assert list(result["timestamp"]) == [
        pd.Timestamp("2026-09-15T03:00:00Z"),
        pd.Timestamp("2026-09-15T04:00:00Z"),
        pd.Timestamp("2026-09-15T05:00:00Z"),
    ]


def test_transform_readings_shifts_timestamps_to_the_nearest_exact_hour():
    readings = pd.DataFrame([{**SAMPLE_ROW, "timestamp": "2026-09-15T03:18:25Z"}])

    result = transform_readings(readings)

    assert result.loc[0, "timestamp"] == pd.Timestamp("2026-09-15T03:00:00Z")


def test_transform_readings_clones_each_correctable_column():
    readings = pd.DataFrame([SAMPLE_ROW, NULL_ROW])

    result = transform_readings(readings)

    for column in CORRECTABLE_COLUMNS:
        assert result[f"{column}_corrected"].equals(result[column])
    lag_columns = [f"consumption_lag_{hours}h" for hours in LAG_HOURS]
    added_columns = (
        [f"{column}_corrected" for column in CORRECTABLE_COLUMNS]
        + lag_columns
        + ROLLING_COLUMNS
        + CALENDAR_COLUMNS
    )
    expected = readings.copy()
    expected["timestamp"] = pd.to_datetime(expected["timestamp"], utc=True, format="ISO8601")
    pd.testing.assert_frame_equal(
        result.drop(columns=added_columns).reset_index(drop=True), expected
    )


def test_transform_readings_forward_fills_corrected_columns_per_site():
    readings = pd.DataFrame(
        [
            {**SAMPLE_ROW, "site_id": "SITE001", "timestamp": "2026-09-15T00:00:00Z", "consumption_kw": 10.0, "voltage_v": 400.0},
            {**SAMPLE_ROW, "site_id": "SITE001", "timestamp": "2026-09-15T01:00:00Z", "consumption_kw": None, "voltage_v": None},
            {**SAMPLE_ROW, "site_id": "SITE001", "timestamp": "2026-09-15T02:00:00Z", "consumption_kw": None, "voltage_v": None},
            {**SAMPLE_ROW, "site_id": "SITE001", "timestamp": "2026-09-15T03:00:00Z", "consumption_kw": 30.0, "voltage_v": 402.0},
            {**SAMPLE_ROW, "site_id": "SITE002", "timestamp": "2026-09-15T00:00:00Z", "consumption_kw": None, "voltage_v": None},
        ]
    )

    result = transform_readings(readings)

    site1 = result[result["site_id"] == "SITE001"].sort_values("timestamp")
    assert list(site1["consumption_kw_corrected"]) == [10.0, 10.0, 10.0, 30.0]
    assert list(site1["voltage_v_corrected"]) == [400.0, 400.0, 400.0, 402.0]
    site2 = result[result["site_id"] == "SITE002"]
    assert site2["consumption_kw_corrected"].isna().all()


def test_transform_readings_sorts_by_actual_time_not_string_lexicographic_order():
    readings = pd.DataFrame(
        [
            # UTC 2026-09-15T21:20:00, mais la date dans la chaine ("16") la fait paraitre plus tardive
            {**SAMPLE_ROW, "site_id": "SITE001", "timestamp": "2026-09-16T00:20:00+03:00", "consumption_kw": 1.0},
            # UTC 2026-09-15T23:40:00, chronologiquement apres, mais la chaine ("15") la fait paraitre plus tot
            {**SAMPLE_ROW, "site_id": "SITE001", "timestamp": "2026-09-15T23:40:00Z", "consumption_kw": 2.0},
        ]
    )

    result = transform_readings(readings)

    ordered = result.sort_values("timestamp")
    assert list(ordered["consumption_kw"]) == [1.0, 2.0]


def test_transform_readings_adds_calendar_columns():
    readings = pd.DataFrame([SAMPLE_ROW])

    result = transform_readings(readings)

    for column in CALENDAR_COLUMNS:
        assert column in result.columns


def test_transform_readings_returns_empty_dataframe_when_no_reading():
    readings = pd.DataFrame()

    result = transform_readings(readings)

    assert isinstance(result, pd.DataFrame)
    assert result.empty


def test_add_consumption_lags_looks_up_value_at_each_horizon_per_site():
    times = pd.date_range("2026-09-15T00:00:00Z", periods=7, freq="30min")
    readings = pd.DataFrame(
        {
            "site_id": ["SITE001"] * 7,
            "timestamp": times,
            "consumption_kwh_corrected": [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0],
        }
    )

    result = add_consumption_lags(readings)

    # a t=120min (index 4), lag_1h retrouve la valeur a t=60min (index 2) = 12.0
    assert result.loc[4, "consumption_lag_1h"] == 12.0
    # a t=180min (index 6), lag_2h retrouve la valeur a t=60min (index 2) = 12.0
    assert result.loc[6, "consumption_lag_2h"] == 12.0
    # a t=0min (index 0), aucun historique disponible
    assert pd.isna(result.loc[0, "consumption_lag_1h"])
    assert pd.isna(result.loc[0, "consumption_lag_24h"])


def test_add_consumption_lags_does_not_leak_across_sites():
    times = pd.date_range("2026-09-15T00:00:00Z", periods=3, freq="1h")
    readings = pd.DataFrame(
        {
            "site_id": ["SITE001", "SITE001", "SITE002"],
            "timestamp": [times[0], times[2], times[2]],
            "consumption_kwh_corrected": [100.0, 200.0, 999.0],
        }
    )

    result = add_consumption_lags(readings)

    site1_last = result[(result["site_id"] == "SITE001") & (result["timestamp"] == times[2])]
    assert site1_last["consumption_lag_2h"].iloc[0] == 100.0
    site2_last = result[(result["site_id"] == "SITE002") & (result["timestamp"] == times[2])]
    assert pd.isna(site2_last["consumption_lag_2h"].iloc[0])


def test_add_rolling_means_computes_trailing_time_based_average_per_site():
    times = pd.date_range("2026-09-15T00:00:00Z", periods=5, freq="12h")
    readings = pd.DataFrame(
        {
            "site_id": ["SITE001"] * 5,
            "timestamp": times,
            "consumption_kwh_corrected": [10.0, 20.0, 30.0, 40.0, 50.0],
        }
    )

    result = add_rolling_means(readings)

    # a t=0h (index 0), aucune donnee anterieure : la fenetre ne contient que le point lui-meme
    assert result.loc[0, "rolling_mean_24h"] == 10.0
    # a t=36h (index 3), la fenetre 24h couvre t=24h (30.0) et t=36h (40.0)
    assert result.loc[3, "rolling_mean_24h"] == 35.0
    # a t=48h (index 4), la fenetre 168h couvre toute la serie disponible (48h de donnees)
    assert result.loc[4, "rolling_mean_168h"] == 30.0


def test_add_rolling_means_does_not_leak_across_sites():
    times = pd.date_range("2026-09-15T00:00:00Z", periods=2, freq="1h")
    readings = pd.DataFrame(
        {
            "site_id": ["SITE001", "SITE002"],
            "timestamp": [times[0], times[1]],
            "consumption_kwh_corrected": [10.0, 990.0],
        }
    )

    result = add_rolling_means(readings)

    site2_row = result[result["site_id"] == "SITE002"]
    assert site2_row["rolling_mean_24h"].iloc[0] == 990.0


def test_add_calendar_features_derives_hour_day_month_weekend_and_working_hours():
    readings = pd.DataFrame(
        [
            {"timestamp": "2026-09-14T09:30:00Z"},  # lundi, dans les heures ouvrees
            {"timestamp": "2026-09-14T20:00:00Z"},  # lundi, hors heures ouvrees (soir)
            {"timestamp": "2026-09-14T07:59:00Z"},  # lundi, hors heures ouvrees (avant 8h)
            {"timestamp": "2026-09-19T09:30:00Z"},  # samedi, week-end
        ]
    )

    result = add_calendar_features(readings)

    assert list(result["hour"]) == [9, 20, 7, 9]
    assert list(result["day_of_week"]) == [0, 0, 0, 5]
    assert list(result["month"]) == [9, 9, 9, 9]
    assert list(result["is_weekend"]) == [False, False, False, True]
    assert list(result["is_working_hours"]) == [True, False, False, False]
