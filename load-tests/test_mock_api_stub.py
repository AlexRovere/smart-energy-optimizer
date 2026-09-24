# teste le plafond horaire du stub API Mock, sans attendre la vraie fenêtre d'une heure
import importlib

from fastapi.testclient import TestClient


def _fresh_client(monkeypatch, rate_limit: int) -> TestClient:
    monkeypatch.setenv("MOCK_STUB_LATENCY_MS", "0")
    monkeypatch.setenv("MOCK_STUB_RATE_LIMIT_PER_HOUR", str(rate_limit))
    module = importlib.reload(importlib.import_module("mock_api_stub"))
    return TestClient(module.app)


def test_current_reading_matches_the_expected_shape(monkeypatch):
    client = _fresh_client(monkeypatch, rate_limit=10)

    response = client.get("/api/v1/sites/SITE001/current")

    assert response.status_code == 200
    body = response.json()
    assert body["site_id"] == "SITE001"
    assert body["data_quality"] == "good"


def test_requests_beyond_the_hourly_quota_are_refused(monkeypatch):
    client = _fresh_client(monkeypatch, rate_limit=2)

    client.get("/api/v1/sites/SITE001/current")
    client.get("/api/v1/sites/SITE001/current")
    third = client.get("/api/v1/sites/SITE001/current")

    assert third.status_code == 429
