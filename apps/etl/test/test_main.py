# teste l'orchestration extract -> transform -> load et le CLI exposé par main
from unittest.mock import patch

import pandas as pd
import pytest

from main import build_parser, run_sites


@patch("main.load_sites_to_db")
@patch("main.dedupe_sites")
@patch("main.load_sites")
@patch("main.transform_sites")
@patch("main.fetch_sites")
def test_run_sites_writes_parquet_without_db_sync_by_default(
    mock_fetch_sites, mock_transform_sites, mock_load_sites, mock_dedupe_sites, mock_load_sites_to_db
):
    raw = pd.DataFrame([{"site_id": "SITE001"}])
    transformed = pd.DataFrame([{"site_id": "SITE001", "site_name": "Bureau Paris"}])
    mock_fetch_sites.return_value = raw
    mock_transform_sites.return_value = transformed
    mock_load_sites.return_value = "/data/parquet/sites.parquet"

    result = run_sites()

    mock_fetch_sites.assert_called_once_with()
    mock_transform_sites.assert_called_once_with(raw)
    mock_load_sites.assert_called_once_with(transformed)
    mock_dedupe_sites.assert_not_called()
    mock_load_sites_to_db.assert_not_called()
    assert result == {"parquet_file": "/data/parquet/sites.parquet"}


@patch("main.load_sites_to_db")
@patch("main.dedupe_sites")
@patch("main.load_sites")
@patch("main.transform_sites")
@patch("main.fetch_sites")
def test_run_sites_also_syncs_db_when_requested(
    mock_fetch_sites, mock_transform_sites, mock_load_sites, mock_dedupe_sites, mock_load_sites_to_db
):
    raw = pd.DataFrame([{"site_id": "SITE001"}])
    transformed = pd.DataFrame([{"site_id": "SITE001", "site_name": "Bureau Paris"}])
    deduped = pd.DataFrame([{"site_id": "SITE001", "site_name": "Bureau Paris"}])
    mock_fetch_sites.return_value = raw
    mock_transform_sites.return_value = transformed
    mock_load_sites.return_value = "/data/parquet/sites.parquet"
    mock_dedupe_sites.return_value = deduped
    mock_load_sites_to_db.return_value = 3

    result = run_sites(sync_db=True)

    mock_dedupe_sites.assert_called_once_with(transformed)
    mock_load_sites_to_db.assert_called_once_with(deduped)
    assert result == {"parquet_file": "/data/parquet/sites.parquet", "db_inserted": 3}


def test_cli_exposes_sites_command():
    parser = build_parser()

    args = parser.parse_args(["sites"])

    assert args.command == "sites"


def test_cli_sync_db_flag_defaults_to_false():
    parser = build_parser()

    args = parser.parse_args(["sites"])

    assert args.sync_db is False


def test_cli_sync_db_flag_can_be_enabled():
    parser = build_parser()

    args = parser.parse_args(["sites", "--sync-db"])

    assert args.sync_db is True


def test_cli_requires_a_command():
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args([])
