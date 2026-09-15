# teste les requêtes SQL du référentiel des sites (lecture des ids existants, insertion)
from unittest.mock import MagicMock

import pandas as pd

from load.sites_repository import get_existing_site_ids, insert_sites

SITE_COLUMNS = ["site_id", "site_type", "site_name", "location", "capacity_kw", "status"]


def test_get_existing_site_ids_returns_ids_from_cursor():
    conn = MagicMock()
    cursor = conn.cursor.return_value.__enter__.return_value
    cursor.fetchall.return_value = [("SITE001",), ("SITE002",)]

    result = get_existing_site_ids(conn)

    cursor.execute.assert_called_once_with("SELECT site_id FROM sites")
    assert result == {"SITE001", "SITE002"}


def test_insert_sites_inserts_each_row_and_commits():
    conn = MagicMock()
    cursor = conn.cursor.return_value.__enter__.return_value
    sites = pd.DataFrame(
        [
            {
                "site_id": "SITE003",
                "site_type": "factory",
                "site_name": "Usine Lyon Vénissieux",
                "location": "Lyon, France",
                "capacity_kw": 1000,
                "status": "active",
            }
        ],
        columns=SITE_COLUMNS,
    )

    inserted = insert_sites(conn, sites)

    cursor.executemany.assert_called_once()
    conn.commit.assert_called_once()
    assert inserted == 1


def test_insert_sites_does_nothing_when_dataframe_is_empty():
    conn = MagicMock()
    sites = pd.DataFrame(columns=SITE_COLUMNS)

    inserted = insert_sites(conn, sites)

    conn.cursor.assert_not_called()
    assert inserted == 0
