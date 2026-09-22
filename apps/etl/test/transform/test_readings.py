# teste la transformation de l'historique des mesures : clone {colonne}_corrected, champs
# calendaires — les lags et moyennes glissantes sont calculés par le service ML, pas ici
import pandas as pd

from transform.readings import (
    CORRECTABLE_COLUMNS,
    add_calendar_features,
    align_timestamps_to_the_hour,
    transform_readings,
)

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
            {"site_id": "SITE001", "timestamp": "2026-09-15T03:18:25Z"},
            {"site_id": "SITE001", "timestamp": "2026-09-15T04:10:52Z"},
            {"site_id": "SITE001", "timestamp": "2026-09-15T04:59:14Z"},
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


def test_transform_readings_deduplicates_rows_that_round_to_the_same_hour():
    # le contexte (deja sur disque, deja arrondi) et le nouveau point extrait (heure encore brute)
    # peuvent finir sur la meme heure une fois arrondis : sans dedoublonnage, la ligne la plus
    # recente n'ecrase pas l'ancienne et le lot devient incoherent
    readings = pd.DataFrame(
        [
            {**SAMPLE_ROW, "timestamp": "2026-09-17T13:58:00Z", "consumption_kw": 10.0},
            {**SAMPLE_ROW, "timestamp": "2026-09-17T14:02:00Z", "consumption_kw": 20.0},
        ]
    )

    result = transform_readings(readings)

    assert len(result) == 1
    assert result.loc[0, "timestamp"] == pd.Timestamp("2026-09-17T14:00:00Z")
    assert result.loc[0, "consumption_kw"] == 20.0


def test_transform_readings_clones_each_correctable_column():
    readings = pd.DataFrame([SAMPLE_ROW, NULL_ROW])

    result = transform_readings(readings)

    for column in CORRECTABLE_COLUMNS:
        assert result[f"{column}_corrected"].equals(result[column])
    added_columns = [f"{column}_corrected" for column in CORRECTABLE_COLUMNS] + CALENDAR_COLUMNS
    expected = readings.copy()
    expected["timestamp"] = pd.to_datetime(expected["timestamp"], utc=True, format="ISO8601")
    pd.testing.assert_frame_equal(
        result.drop(columns=added_columns).reset_index(drop=True), expected
    )


def test_transform_readings_forward_fills_corrected_columns_per_site():
    readings = pd.DataFrame(
        [
            {
                **SAMPLE_ROW,
                "site_id": "SITE001",
                "timestamp": "2026-09-15T00:00:00Z",
                "consumption_kw": 10.0,
                "voltage_v": 400.0,
            },
            {
                **SAMPLE_ROW,
                "site_id": "SITE001",
                "timestamp": "2026-09-15T01:00:00Z",
                "consumption_kw": None,
                "voltage_v": None,
            },
            {
                **SAMPLE_ROW,
                "site_id": "SITE001",
                "timestamp": "2026-09-15T02:00:00Z",
                "consumption_kw": None,
                "voltage_v": None,
            },
            {
                **SAMPLE_ROW,
                "site_id": "SITE001",
                "timestamp": "2026-09-15T03:00:00Z",
                "consumption_kw": 30.0,
                "voltage_v": 402.0,
            },
            {
                **SAMPLE_ROW,
                "site_id": "SITE002",
                "timestamp": "2026-09-15T00:00:00Z",
                "consumption_kw": None,
                "voltage_v": None,
            },
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
            # UTC 2026-09-15T21:20:00, mais la date dans la chaîne ("16") la fait paraître plus
            # tardive
            {
                **SAMPLE_ROW,
                "site_id": "SITE001",
                "timestamp": "2026-09-16T00:20:00+03:00",
                "consumption_kw": 1.0,
            },
            # UTC 2026-09-15T23:40:00, chronologiquement après, mais la chaîne ("15") la fait
            # paraître plus tôt
            {
                **SAMPLE_ROW,
                "site_id": "SITE001",
                "timestamp": "2026-09-15T23:40:00Z",
                "consumption_kw": 2.0,
            },
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



def test_transform_readings_does_not_produce_lag_or_rolling_columns():
    readings = pd.DataFrame([SAMPLE_ROW])

    result = transform_readings(readings)

    lag_columns = [f"consumption_lag_{h}h" for h in [1, 2, 24, 48, 168]]
    rolling_columns = [f"rolling_mean_{h}h" for h in [24, 168]]
    for column in lag_columns + rolling_columns:
        assert column not in result.columns


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
