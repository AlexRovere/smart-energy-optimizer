# teste l'appel HTTP GET générique vers l'API Mock
from unittest.mock import MagicMock, patch

import pytest
import requests

from extract.api_client import get_json


@patch("extract.api_client.requests.get")
def test_get_json_calls_expected_url_and_returns_payload(mock_get):
    mock_response = MagicMock()
    mock_response.json.return_value = [{"site_id": "SITE001"}]
    mock_get.return_value = mock_response

    result = get_json("http://mock-api:8000", "/api/v1/sites")

    mock_get.assert_called_once_with("http://mock-api:8000/api/v1/sites", params=None, timeout=10)
    assert result == [{"site_id": "SITE001"}]


@patch("extract.api_client.requests.get")
def test_get_json_forwards_query_params(mock_get):
    mock_response = MagicMock()
    mock_response.json.return_value = []
    mock_get.return_value = mock_response

    get_json("http://mock-api:8000", "/api/v1/readings", params={"site_id": "SITE001"})

    mock_get.assert_called_once_with(
        "http://mock-api:8000/api/v1/readings", params={"site_id": "SITE001"}, timeout=10
    )


@patch("extract.api_client.requests.get")
def test_get_json_raises_on_http_error(mock_get):
    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = requests.HTTPError("404")
    mock_get.return_value = mock_response

    with pytest.raises(requests.HTTPError):
        get_json("http://mock-api:8000", "/api/v1/sites")
