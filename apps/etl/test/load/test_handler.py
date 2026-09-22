# teste l'écriture du référentiel des sites et de l'historique des mesures (Parquet), et la base
import contextlib
from datetime import date
from unittest.mock import patch

import pandas as pd

from load.handler import (
    get_context_days,
    get_existing_days,
    load_readings,
    load_sites,
    load_sites_to_db,
)

SITE_COLUMNS = ["id", "type", "name", "location", "capacity_kw", "status"]


@patch("load.handler.get_output_dir")
def test_load_sites_writes_parquet_file(mock_get_output_dir, tmp_path):
    mock_get_output_dir.return_value = str(tmp_path)
    sites = pd.DataFrame([{"id": "SITE001", "name": "Bureau Paris La Défense"}])

    target = load_sites(sites)

    written = pd.read_parquet(target)
    pd.testing.assert_frame_equal(written, sites)


@patch("load.handler.write_readings")
@patch("load.handler.get_output_dir")
def test_load_readings_writes_parquet_files(mock_get_output_dir, mock_write_readings, tmp_path):
    mock_get_output_dir.return_value = str(tmp_path)
    mock_write_readings.return_value = [str(tmp_path / "site_id=SITE001/.../readings.parquet")]
    readings = pd.DataFrame([{"site_id": "SITE001", "timestamp": "2026-09-16T00:00:00Z"}])

    result = load_readings(readings)

    mock_write_readings.assert_called_once_with(readings, str(tmp_path), on_file_written=None)
    assert result == mock_write_readings.return_value


@patch("load.handler.existing_days")
@patch("load.handler.get_output_dir")
def test_get_existing_days_delegates_to_existing_days(mock_get_output_dir, mock_existing_days):
    mock_get_output_dir.return_value = "/data/output"
    mock_existing_days.return_value = {date(2026, 9, 15)}

    result = get_existing_days("SITE001")

    mock_existing_days.assert_called_once_with("/data/output", "SITE001")
    assert result == {date(2026, 9, 15)}


@patch("load.handler.read_context_days")
@patch("load.handler.get_output_dir")
def test_get_context_days_delegates_to_read_context_days(
    mock_get_output_dir, mock_read_context_days
):
    mock_get_output_dir.return_value = "/data/output"
    mock_read_context_days.return_value = pd.DataFrame([{"site_id": "SITE001"}])
    days = {date(2026, 9, 15)}

    result = get_context_days("SITE001", days)

    mock_read_context_days.assert_called_once_with("/data/output", "SITE001", days)
    pd.testing.assert_frame_equal(result, mock_read_context_days.return_value)


@patch("load.handler.insert_sites")
@patch("load.handler.get_existing_site_ids")
@patch("load.handler.get_connection")
def test_load_sites_to_db_inserts_only_sites_not_already_present(
    mock_get_connection, mock_get_existing_site_ids, mock_insert_sites
):
    connection = mock_get_connection.return_value
    mock_get_existing_site_ids.return_value = {"SITE001"}
    mock_insert_sites.return_value = 1
    sites = pd.DataFrame(
        [
            {
                "id": "SITE001",
                "type": "office",
                "name": "Bureau Paris La Défense",
                "location": "Paris, France",
                "capacity_kw": 200,
                "status": "active",
            },
            {
                "id": "SITE002",
                "type": "factory",
                "name": "Usine Lyon Vénissieux",
                "location": "Lyon, France",
                "capacity_kw": 1000,
                "status": "active",
            },
        ],
        columns=SITE_COLUMNS,
    )

    inserted = load_sites_to_db(sites)

    mock_get_existing_site_ids.assert_called_once_with(connection)
    new_sites = mock_insert_sites.call_args.args[1]
    assert list(new_sites["id"]) == ["SITE002"]
    connection.close.assert_called_once()
    assert inserted == 1


@patch("load.handler.insert_sites")
@patch("load.handler.get_existing_site_ids")
@patch("load.handler.get_connection")
def test_load_sites_to_db_closes_connection_even_if_insert_fails(
    mock_get_connection, mock_get_existing_site_ids, mock_insert_sites
):
    connection = mock_get_connection.return_value
    mock_get_existing_site_ids.return_value = set()
    mock_insert_sites.side_effect = RuntimeError("boom")
    sites = pd.DataFrame(
        [
            {
                "id": "SITE001",
                "type": "office",
                "name": "Bureau Paris La Défense",
                "location": "Paris, France",
                "capacity_kw": 200,
                "status": "active",
            }
        ],
        columns=SITE_COLUMNS,
    )

    with contextlib.suppress(RuntimeError):
        load_sites_to_db(sites)

    connection.close.assert_called_once()
