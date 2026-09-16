# teste le point d'entrée Extract : lecture du référentiel des sites en DataFrame pandas
from unittest.mock import patch

import pandas as pd

from extract.handler import fetch_sites

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
