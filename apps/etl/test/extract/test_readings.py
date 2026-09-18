# teste la résolution de la fenêtre temporelle par défaut pour l'historique des sites
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

import pandas as pd
from extract.readings import (
    fetch_all_readings,
    fetch_readings,
    fetch_readings_window,
    hourly_reading_limit,
    plan_fetch_windows,
    resolve_time_range,
)

NOW = datetime(2026, 9, 15, 18, 0, 0, tzinfo=timezone.utc)


def test_resolve_time_range_defaults_to_last_7_days_when_nothing_given():
    start, end = resolve_time_range(now=NOW)

    assert end == NOW
    assert start == NOW - timedelta(days=7)


def test_resolve_time_range_derives_end_from_start():
    start_time = datetime(2026, 9, 1, 0, 0, 0, tzinfo=timezone.utc)

    start, end = resolve_time_range(start_time=start_time, now=NOW)

    assert start == start_time
    assert end == start_time + timedelta(days=7)


def test_resolve_time_range_derives_start_from_end():
    end_time = datetime(2026, 9, 10, 0, 0, 0, tzinfo=timezone.utc)

    start, end = resolve_time_range(end_time=end_time, now=NOW)

    assert end == end_time
    assert start == end_time - timedelta(days=7)


def test_resolve_time_range_keeps_both_when_given():
    start_time = datetime(2026, 9, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 3, 0, 0, 0, tzinfo=timezone.utc)

    start, end = resolve_time_range(start_time=start_time, end_time=end_time, now=NOW)

    assert start == start_time
    assert end == end_time


@patch("extract.readings.get_json")
def test_fetch_readings_window_calls_readings_endpoint_with_params(mock_get_json):
    mock_get_json.return_value = [{"site_id": "SITE001", "timestamp": "2026-09-15T00:00:00"}]
    start_time = datetime(2026, 9, 14, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc)

    result = fetch_readings_window("http://mock-api:8000", "SITE001", start_time, end_time)

    mock_get_json.assert_called_once_with(
        "http://mock-api:8000",
        "/api/v1/readings",
        params={
            "site_id": "SITE001",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "limit": 1000,
        },
    )
    assert isinstance(result, pd.DataFrame)
    assert result.loc[0, "site_id"] == "SITE001"


@patch("extract.readings.get_json")
def test_fetch_readings_window_returns_empty_dataframe_when_no_reading(mock_get_json):
    mock_get_json.return_value = []
    start_time = datetime(2026, 9, 14, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc)

    result = fetch_readings_window("http://mock-api:8000", "SITE001", start_time, end_time)

    assert isinstance(result, pd.DataFrame)
    assert result.empty


@patch("extract.readings.get_json")
def test_fetch_readings_window_casts_numeric_columns_to_float_even_with_a_null_value(mock_get_json):
    # un seul enregistrement avec un champ numerique a null (ex: hour, un point par site) laisse
    # pandas deduire un dtype object plutot que float64, ce qui fait echouer le concat plus tard
    # (colonnes de meme nom, dtypes differents entre sites) avec un FutureWarning a chaque run
    mock_get_json.return_value = [
        {
            "site_id": "SITE001",
            "timestamp": "2026-09-15T00:00:00",
            "consumption_kw": None,
            "consumption_kwh": 10.0,
            "voltage_v": 400.0,
            "current_a": 100.0,
            "power_factor": 0.9,
            "temperature_celsius": 20.0,
            "humidity_percent": 50.0,
        }
    ]
    start_time = datetime(2026, 9, 14, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc)

    result = fetch_readings_window("http://mock-api:8000", "SITE001", start_time, end_time)

    assert result["consumption_kw"].dtype == "float64"
    assert result["voltage_v"].dtype == "float64"


@patch("extract.readings.fetch_readings_window")
def test_fetch_readings_paginates_by_day_over_the_range(mock_fetch_window):
    start_time = datetime(2026, 9, 12, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc)
    mock_fetch_window.side_effect = [
        pd.DataFrame([{"site_id": "SITE001", "timestamp": "day1"}]),
        pd.DataFrame([{"site_id": "SITE001", "timestamp": "day2"}]),
        pd.DataFrame([{"site_id": "SITE001", "timestamp": "day3"}]),
    ]

    result = fetch_readings("http://mock-api:8000", "SITE001", start_time, end_time)

    assert mock_fetch_window.call_args_list == [
        (
            (
                "http://mock-api:8000",
                "SITE001",
                datetime(2026, 9, 12, tzinfo=timezone.utc),
                datetime(2026, 9, 13, tzinfo=timezone.utc),
            ),
            {"limit": 24},
        ),
        (
            (
                "http://mock-api:8000",
                "SITE001",
                datetime(2026, 9, 13, tzinfo=timezone.utc),
                datetime(2026, 9, 14, tzinfo=timezone.utc),
            ),
            {"limit": 24},
        ),
        (
            (
                "http://mock-api:8000",
                "SITE001",
                datetime(2026, 9, 14, tzinfo=timezone.utc),
                datetime(2026, 9, 15, tzinfo=timezone.utc),
            ),
            {"limit": 24},
        ),
    ]
    assert list(result["timestamp"]) == ["day1", "day2", "day3"]


@patch("extract.readings.fetch_readings_window")
def test_fetch_readings_skips_already_covered_days_except_the_boundary(mock_fetch_window):
    start_time = datetime(2026, 9, 10, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc)
    mock_fetch_window.side_effect = [
        pd.DataFrame([{"site_id": "SITE001", "timestamp": "boundary"}]),
        pd.DataFrame([{"site_id": "SITE001", "timestamp": "missing1"}]),
        pd.DataFrame([{"site_id": "SITE001", "timestamp": "missing2"}]),
    ]

    result = fetch_readings(
        "http://mock-api:8000",
        "SITE001",
        start_time,
        end_time,
        already_covered_days={date(2026, 9, 10), date(2026, 9, 11), date(2026, 9, 12)},
    )

    # 9/10 et 9/11 deja couverts et loin de tout manque : ignores
    # 9/12 deja couvert mais a la frontiere du manque (9/13, 9/14) : re-fetche pour la jonction
    assert mock_fetch_window.call_args_list == [
        (
            (
                "http://mock-api:8000",
                "SITE001",
                datetime(2026, 9, 12, tzinfo=timezone.utc),
                datetime(2026, 9, 13, tzinfo=timezone.utc),
            ),
            {"limit": 24},
        ),
        (
            (
                "http://mock-api:8000",
                "SITE001",
                datetime(2026, 9, 13, tzinfo=timezone.utc),
                datetime(2026, 9, 14, tzinfo=timezone.utc),
            ),
            {"limit": 24},
        ),
        (
            (
                "http://mock-api:8000",
                "SITE001",
                datetime(2026, 9, 14, tzinfo=timezone.utc),
                datetime(2026, 9, 15, tzinfo=timezone.utc),
            ),
            {"limit": 24},
        ),
    ]
    assert list(result["timestamp"]) == ["boundary", "missing1", "missing2"]


@patch("extract.readings.fetch_readings_window")
def test_fetch_readings_returns_empty_dataframe_when_range_has_no_readings(mock_fetch_window):
    mock_fetch_window.return_value = pd.DataFrame()
    start_time = datetime(2026, 9, 14, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc)

    result = fetch_readings("http://mock-api:8000", "SITE001", start_time, end_time)

    assert isinstance(result, pd.DataFrame)
    assert result.empty


@patch("extract.readings.fetch_readings")
def test_fetch_all_readings_iterates_over_site_ids(mock_fetch_readings):
    start_time = datetime(2026, 9, 14, 0, 0, 0, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 15, 0, 0, 0, tzinfo=timezone.utc)
    mock_fetch_readings.side_effect = [
        pd.DataFrame([{"site_id": "SITE001", "timestamp": "a"}]),
        pd.DataFrame([{"site_id": "SITE002", "timestamp": "b"}]),
    ]

    result = fetch_all_readings(
        "http://mock-api:8000", ["SITE001", "SITE002"], start_time, end_time
    )

    assert mock_fetch_readings.call_args_list == [
        (
            ("http://mock-api:8000", "SITE001", start_time, end_time),
            {"on_window": None, "already_covered_days": None},
        ),
        (
            ("http://mock-api:8000", "SITE002", start_time, end_time),
            {"on_window": None, "already_covered_days": None},
        ),
    ]
    assert list(result["site_id"]) == ["SITE001", "SITE002"]


@patch("extract.readings.fetch_readings")
def test_fetch_all_readings_returns_empty_dataframe_when_no_site(mock_fetch_readings):
    result = fetch_all_readings("http://mock-api:8000", [])

    mock_fetch_readings.assert_not_called()
    assert isinstance(result, pd.DataFrame)
    assert result.empty


def test_hourly_reading_limit_gives_one_point_per_hour_for_a_full_day():
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    assert hourly_reading_limit(start, end) == 24


def test_hourly_reading_limit_gives_a_single_point_for_a_60_minutes_window():
    start = datetime(2026, 9, 1, 13, 30, tzinfo=timezone.utc)
    end = start + timedelta(minutes=60)

    assert hourly_reading_limit(start, end) == 1


def test_hourly_reading_limit_never_goes_below_one_for_a_sub_hour_window():
    start = datetime(2026, 9, 1, 13, 30, tzinfo=timezone.utc)
    end = start + timedelta(minutes=20)

    assert hourly_reading_limit(start, end) == 1


def test_plan_fetch_windows_returns_every_day_when_nothing_is_covered():
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    end = datetime(2026, 9, 4, tzinfo=timezone.utc)

    result = plan_fetch_windows(start, end, set())

    assert [window[0].date() for window in result] == [
        date(2026, 9, 1),
        date(2026, 9, 2),
        date(2026, 9, 3),
    ]


def test_plan_fetch_windows_returns_nothing_when_everything_is_covered():
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    end = datetime(2026, 9, 3, tzinfo=timezone.utc)
    already_covered = {date(2026, 9, 1), date(2026, 9, 2)}

    result = plan_fetch_windows(start, end, already_covered)

    assert result == []


def test_plan_fetch_windows_keeps_one_covered_day_at_the_boundary_of_a_missing_block():
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    end = datetime(2026, 9, 6, tzinfo=timezone.utc)
    already_covered = {date(2026, 9, 1), date(2026, 9, 2)}

    result = plan_fetch_windows(start, end, already_covered)

    assert [window[0].date() for window in result] == [
        date(2026, 9, 2),
        date(2026, 9, 3),
        date(2026, 9, 4),
        date(2026, 9, 5),
    ]


def test_plan_fetch_windows_reincludes_both_covered_days_bordering_a_gap_in_the_middle():
    start = datetime(2026, 9, 1, tzinfo=timezone.utc)
    end = datetime(2026, 9, 6, tzinfo=timezone.utc)
    already_covered = {date(2026, 9, 1), date(2026, 9, 2), date(2026, 9, 4), date(2026, 9, 5)}

    result = plan_fetch_windows(start, end, already_covered)

    assert [window[0].date() for window in result] == [
        date(2026, 9, 2),
        date(2026, 9, 3),
        date(2026, 9, 4),
    ]
