import json
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mock_api.app import create_app

CAPTURE_DIR = Path(__file__).parent / "fixtures" / "capture-2026-09-29"

# Instant figé pour les tests : les routes qui dépendent de « maintenant »
# deviennent reproductibles.
NOW = datetime(2026, 9, 29, 8, 7, 0, 368439, tzinfo=UTC)


def load_capture(name: str):
    return json.loads((CAPTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(now=lambda: NOW))
