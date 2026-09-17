# teste la lecture de l'URL de base de l'API Mock depuis l'environnement
import pytest

from extract.config import get_base_url


def test_get_base_url_returns_env_value(monkeypatch):
    monkeypatch.setenv("MOCK_API_URL", "http://mock-api:8000")

    assert get_base_url() == "http://mock-api:8000"


def test_get_base_url_raises_when_missing(monkeypatch):
    monkeypatch.delenv("MOCK_API_URL", raising=False)

    with pytest.raises(RuntimeError):
        get_base_url()
