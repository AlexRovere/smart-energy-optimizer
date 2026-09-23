# teste l'écriture Parquet de l'historique des mesures : partition, schéma déclaré, écriture
# atomique
import os
from datetime import date

import pandas as pd
import pyarrow.parquet as pq
import pytest

from load.readings import (
    RAW_READING_COLUMNS,
    SCHEMA,
    existing_days,
    read_context_days,
    write_readings,
)

READING_SITE001_DAY1 = {
    "site_id": "SITE001",
    "timestamp": "2026-09-15T10:00:00Z",
    "site_type": "office",
    "consumption_kw": 87.34,
    "consumption_kw_corrected": 87.34,
    "consumption_kwh": 87.34,
    "consumption_kwh_corrected": 87.34,
    "voltage_v": 401.2,
    "voltage_v_corrected": 401.2,
    "current_a": 132.5,
    "current_a_corrected": 132.5,
    "power_factor": 0.923,
    "power_factor_corrected": 0.923,
    "temperature_celsius": 22.1,
    "temperature_celsius_corrected": 22.1,
    "humidity_percent": 58.4,
    "humidity_percent_corrected": 58.4,
    "data_quality": "good",
    "null_reasons": [],
    "hour": 10,
    "day_of_week": 1,
    "month": 9,
    "is_weekend": False,
    "is_working_hours": True,
}


def _reading(**overrides):
    return {**READING_SITE001_DAY1, **overrides}


def test_write_readings_returns_empty_list_when_no_reading():
    result = write_readings(pd.DataFrame(), "/unused")

    assert result == []


def test_write_readings_handles_mixed_timestamp_precision_in_the_same_batch(tmp_path):
    readings = pd.DataFrame(
        [
            _reading(timestamp="2026-09-16T00:00:00Z"),
            _reading(timestamp="2026-09-16T00:00:00.600000Z"),
        ]
    )

    written = write_readings(readings, str(tmp_path))

    result = pd.read_parquet(written[0])
    assert len(result) == 2


def test_write_readings_writes_one_file_per_site_and_day(tmp_path):
    readings = pd.DataFrame(
        [
            _reading(),
            _reading(site_id="SITE001", timestamp="2026-09-16T10:00:00Z"),
            _reading(site_id="SITE002", timestamp="2026-09-15T10:00:00Z"),
        ]
    )

    written = write_readings(readings, str(tmp_path))

    assert sorted(written) == sorted(
        [
            str(tmp_path / "site_id=SITE001/year=2026/month=09/day=15/readings.parquet"),
            str(tmp_path / "site_id=SITE001/year=2026/month=09/day=16/readings.parquet"),
            str(tmp_path / "site_id=SITE002/year=2026/month=09/day=15/readings.parquet"),
        ]
    )
    for path in written:
        assert os.path.exists(path)


def test_write_readings_keeps_every_row_of_its_partition(tmp_path):
    readings = pd.DataFrame(
        [
            _reading(timestamp="2026-09-15T10:00:00Z"),
            _reading(timestamp="2026-09-15T11:00:00Z"),
        ]
    )

    written = write_readings(readings, str(tmp_path))

    result = pd.read_parquet(written[0])
    assert len(result) == 2


def test_write_readings_preserves_null_values_and_reasons(tmp_path):
    readings = pd.DataFrame(
        [
            _reading(
                consumption_kw=None,
                consumption_kw_corrected=None,
                data_quality="critical",
                null_reasons=["network_loss"],
            )
        ]
    )

    written = write_readings(readings, str(tmp_path))

    result = pd.read_parquet(written[0])
    assert result.loc[0, "consumption_kw"] is None or pd.isna(result.loc[0, "consumption_kw"])
    assert list(result.loc[0, "null_reasons"]) == ["network_loss"]
    assert result.loc[0, "data_quality"] == "critical"


def test_write_readings_includes_calendar_columns(tmp_path):
    readings = pd.DataFrame([_reading()])

    written = write_readings(readings, str(tmp_path))

    result = pd.read_parquet(written[0])
    for column in ["hour", "day_of_week", "month", "is_weekend", "is_working_hours"]:
        assert column in result.columns


def test_write_readings_produces_files_matching_the_reference_schema(tmp_path):
    readings = pd.DataFrame([_reading()])

    written = write_readings(readings, str(tmp_path))

    written_schema = pq.ParquetFile(written[0]).schema_arrow
    assert written_schema.equals(SCHEMA, check_metadata=False)


def test_write_readings_raises_when_a_column_does_not_fit_the_schema(tmp_path):
    readings = pd.DataFrame([_reading(consumption_kw="pas un nombre")])

    # pyarrow lève ArrowInvalid, qui hérite de ValueError : assez précis pour
    # dire ce qu'on attend, sans coupler le test au nom interne de pyarrow.
    with pytest.raises(ValueError):
        write_readings(readings, str(tmp_path))


def test_write_readings_merges_with_a_previously_written_partition(tmp_path):
    write_readings(
        pd.DataFrame([_reading(site_id="SITE001", timestamp="2026-09-15T10:00:00Z")]),
        str(tmp_path),
    )

    written = write_readings(
        pd.DataFrame([_reading(site_id="SITE001", timestamp="2026-09-15T11:00:00Z")]),
        str(tmp_path),
    )

    result = pd.read_parquet(written[0])
    assert sorted(result["timestamp"].dt.hour) == [10, 11]


def test_write_readings_deduplicates_on_timestamp_keeping_the_newest_value(tmp_path):
    write_readings(
        pd.DataFrame(
            [_reading(site_id="SITE001", timestamp="2026-09-15T10:00:00Z", consumption_kw=10.0)]
        ),
        str(tmp_path),
    )

    written = write_readings(
        pd.DataFrame(
            [_reading(site_id="SITE001", timestamp="2026-09-15T10:00:00Z", consumption_kw=20.0)]
        ),
        str(tmp_path),
    )

    result = pd.read_parquet(written[0])
    assert len(result) == 1
    assert result.loc[0, "consumption_kw"] == 20.0


def test_existing_days_returns_the_days_already_written_for_a_site(tmp_path):
    readings = pd.DataFrame(
        [
            _reading(site_id="SITE001", timestamp="2026-09-15T10:00:00Z"),
            _reading(site_id="SITE001", timestamp="2026-09-17T10:00:00Z"),
            _reading(site_id="SITE002", timestamp="2026-09-16T10:00:00Z"),
        ]
    )
    write_readings(readings, str(tmp_path))

    result = existing_days(str(tmp_path), "SITE001")

    assert result == {date(2026, 9, 15), date(2026, 9, 17)}


def test_existing_days_returns_empty_set_when_site_has_no_data(tmp_path):
    result = existing_days(str(tmp_path), "SITE001")

    assert result == set()


def test_read_context_days_returns_only_raw_columns_for_the_requested_days(tmp_path):
    readings = pd.DataFrame(
        [
            _reading(site_id="SITE001", timestamp="2026-09-15T10:00:00Z"),
            _reading(site_id="SITE001", timestamp="2026-09-16T10:00:00Z"),
            _reading(site_id="SITE001", timestamp="2026-09-17T10:00:00Z"),
        ]
    )
    write_readings(readings, str(tmp_path))

    result = read_context_days(str(tmp_path), "SITE001", {date(2026, 9, 15), date(2026, 9, 17)})

    assert sorted(result["timestamp"].dt.date.unique()) == [date(2026, 9, 15), date(2026, 9, 17)]
    assert list(result.columns) == RAW_READING_COLUMNS


def test_read_context_days_ignores_days_that_do_not_exist(tmp_path):
    readings = pd.DataFrame([_reading(site_id="SITE001", timestamp="2026-09-15T10:00:00Z")])
    write_readings(readings, str(tmp_path))

    result = read_context_days(str(tmp_path), "SITE001", {date(2026, 9, 15), date(2026, 9, 1)})

    assert list(result["timestamp"].dt.date.unique()) == [date(2026, 9, 15)]


def test_read_context_days_returns_empty_dataframe_when_nothing_matches(tmp_path):
    result = read_context_days(str(tmp_path), "SITE001", {date(2026, 9, 1)})

    assert isinstance(result, pd.DataFrame)
    assert result.empty
