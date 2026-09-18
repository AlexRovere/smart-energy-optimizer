# teste le point d'entrée Extract : référentiel des sites et historique des mesures en DataFrame
# pandas
from datetime import datetime, timezone
from unittest.mock import patch

import pandas as pd
from extract.handler import fetch_readings, fetch_sites

SAMPLE_SITES = [
    {
        "site_id": "SITE001",
        "site_type": "office",
        "site_name": "Bureau Paris La Défense",
        "location": "Paris, France",
        "capacity_kw": 200,
        "status": "active",
    }
]


@patch("extract.handler.get_json")
@patch("extract.handler.get_base_url", return_value="http://mock-api:8000")
def test_fetch_sites_returns_dataframe(mock_get_base_url, mock_get_json):
    mock_get_json.return_value = SAMPLE_SITES

    result = fetch_sites()

    mock_get_json.assert_called_once_with("http://mock-api:8000", "/api/v1/sites")
    assert isinstance(result, pd.DataFrame)
    assert list(result.columns) == list(SAMPLE_SITES[0].keys())
    assert result.loc[0, "site_id"] == "SITE001"


@patch("extract.handler.get_json")
@patch("extract.handler.get_base_url", return_value="http://mock-api:8000")
def test_fetch_sites_returns_empty_dataframe_when_no_site(mock_get_base_url, mock_get_json):
    mock_get_json.return_value = []

    result = fetch_sites()

    assert isinstance(result, pd.DataFrame)
    assert result.empty


@patch("extract.handler.fetch_all_readings")
@patch("extract.handler.fetch_sites")
@patch("extract.handler.get_base_url", return_value="http://mock-api:8000")
def test_fetch_readings_uses_site_ids_from_referential(
    mock_get_base_url, mock_fetch_sites, mock_fetch_all_readings
):
    mock_fetch_sites.return_value = pd.DataFrame([{"site_id": "SITE001"}, {"site_id": "SITE002"}])
    mock_fetch_all_readings.return_value = pd.DataFrame([{"site_id": "SITE001", "timestamp": "t"}])
    start_time = datetime(2026, 9, 1, tzinfo=timezone.utc)
    end_time = datetime(2026, 9, 2, tzinfo=timezone.utc)

    result = fetch_readings(start_time=start_time, end_time=end_time)

    mock_fetch_all_readings.assert_called_once_with(
        "http://mock-api:8000",
        ["SITE001", "SITE002"],
        start_time,
        end_time,
        on_window=None,
        already_covered_days=None,
    )
    assert isinstance(result, pd.DataFrame)


@patch("extract.handler.fetch_all_readings")
@patch("extract.handler.fetch_sites")
@patch("extract.handler.get_base_url", return_value="http://mock-api:8000")
def test_fetch_readings_returns_empty_dataframe_when_no_site(
    mock_get_base_url, mock_fetch_sites, mock_fetch_all_readings
):
    mock_fetch_sites.return_value = pd.DataFrame()
    mock_fetch_all_readings.return_value = pd.DataFrame()

    result = fetch_readings()

    mock_fetch_all_readings.assert_called_once_with(
        "http://mock-api:8000", [], None, None, on_window=None, already_covered_days=None
    )
    assert isinstance(result, pd.DataFrame)
