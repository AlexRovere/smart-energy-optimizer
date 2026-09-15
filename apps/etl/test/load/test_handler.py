# teste l'écriture du référentiel des sites (Parquet, et ajout des sites manquants en base)
from unittest.mock import patch

import pandas as pd

from load.handler import load_sites, load_sites_to_db

SITE_COLUMNS = ["site_id", "site_type", "site_name", "location", "capacity_kw", "status"]


@patch("load.handler.get_output_dir")
def test_load_sites_writes_parquet_file(mock_get_output_dir, tmp_path):
    mock_get_output_dir.return_value = str(tmp_path)
    sites = pd.DataFrame([{"site_id": "SITE001", "site_name": "Bureau Paris La Défense"}])

    target = load_sites(sites)

    written = pd.read_parquet(target)
    pd.testing.assert_frame_equal(written, sites)


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
                "site_id": "SITE001",
                "site_type": "office",
                "site_name": "Bureau Paris La Défense",
                "location": "Paris, France",
                "capacity_kw": 200,
                "status": "active",
            },
            {
                "site_id": "SITE002",
                "site_type": "factory",
                "site_name": "Usine Lyon Vénissieux",
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
    assert list(new_sites["site_id"]) == ["SITE002"]
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
                "site_id": "SITE001",
                "site_type": "office",
                "site_name": "Bureau Paris La Défense",
                "location": "Paris, France",
                "capacity_kw": 200,
                "status": "active",
            }
        ],
        columns=SITE_COLUMNS,
    )

    try:
        load_sites_to_db(sites)
    except RuntimeError:
        pass

    connection.close.assert_called_once()
