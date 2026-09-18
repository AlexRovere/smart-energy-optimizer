# teste l'appel HTTP GET générique vers l'API Mock, retry compris
from unittest.mock import MagicMock, call, patch

import pytest
import requests
from extract.api_client import get_json


def _http_error(status_code):
    response = MagicMock(status_code=status_code)
    error = requests.HTTPError(f"{status_code}")
    error.response = response
    return error


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


@patch("extract.api_client.time.sleep")
@patch("extract.api_client.requests.get")
def test_get_json_does_not_retry_a_client_error(mock_get, mock_sleep):
    mock_response = MagicMock()
    mock_response.raise_for_status.side_effect = _http_error(404)
    mock_get.return_value = mock_response

    with pytest.raises(requests.HTTPError):
        get_json("http://mock-api:8000", "/api/v1/sites")

    assert mock_get.call_count == 1
    mock_sleep.assert_not_called()


@patch("extract.api_client.time.sleep")
@patch("extract.api_client.requests.get")
def test_get_json_retries_a_connection_timeout_then_succeeds(mock_get, mock_sleep):
    ok_response = MagicMock()
    ok_response.json.return_value = [{"site_id": "SITE001"}]
    mock_get.side_effect = [requests.exceptions.ConnectTimeout("timed out"), ok_response]

    result = get_json("http://mock-api:8000", "/api/v1/readings")

    assert result == [{"site_id": "SITE001"}]
    assert mock_get.call_count == 2
    mock_sleep.assert_called_once_with(1)


@patch("extract.api_client.time.sleep")
@patch("extract.api_client.requests.get")
def test_get_json_retries_a_503_then_succeeds(mock_get, mock_sleep):
    failing_response = MagicMock()
    failing_response.raise_for_status.side_effect = _http_error(503)
    ok_response = MagicMock()
    ok_response.json.return_value = []
    mock_get.side_effect = [failing_response, ok_response]

    get_json("http://mock-api:8000", "/api/v1/readings")

    assert mock_get.call_count == 2
    mock_sleep.assert_called_once_with(1)


@patch("extract.api_client.time.sleep")
@patch("extract.api_client.requests.get")
def test_get_json_backs_off_with_increasing_delay_between_retries(mock_get, mock_sleep):
    mock_get.side_effect = requests.exceptions.ConnectTimeout("timed out")

    with pytest.raises(requests.exceptions.ConnectTimeout):
        get_json("http://mock-api:8000", "/api/v1/readings")

    mock_sleep.assert_has_calls([call(1), call(2), call(4)])


@patch("extract.api_client.time.sleep")
@patch("extract.api_client.requests.get")
def test_get_json_gives_up_after_the_max_number_of_attempts(mock_get, mock_sleep):
    mock_get.side_effect = requests.exceptions.ConnectTimeout("timed out")

    with pytest.raises(requests.exceptions.ConnectTimeout):
        get_json("http://mock-api:8000", "/api/v1/readings")

    assert mock_get.call_count == 4
