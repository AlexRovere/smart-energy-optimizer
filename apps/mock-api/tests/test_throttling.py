from conftest import NOW
from fastapi.testclient import TestClient

from mock_api.app import create_app, settings_from_env


class FakeClock:
    def __init__(self) -> None:
        self.seconds = 0.0
        self.slept: list[float] = []

    def monotonic(self) -> float:
        return self.seconds

    async def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)


def _client(clock: FakeClock, **settings) -> TestClient:
    app = create_app(now=lambda: NOW, clock=clock.monotonic, sleep=clock.sleep, **settings)
    return TestClient(app)


def test_sans_reglage_ni_quota_ni_latence():
    clock = FakeClock()
    client = _client(clock)

    responses = [client.get("/api/v1/sites/SITE001/current") for _ in range(50)]

    assert {r.status_code for r in responses} == {200}
    assert clock.slept == []


def test_au_dela_du_quota_horaire_les_appels_sont_refuses():
    client = _client(FakeClock(), rate_limit_per_hour=2)

    client.get("/api/v1/sites/SITE001/current")
    client.get("/api/v1/readings")
    third = client.get("/api/v1/stats/summary")

    assert third.status_code == 429
    assert third.json() == {"detail": "Quota horaire dépassé"}


def test_le_quota_se_libere_une_heure_apres_le_premier_appel():
    clock = FakeClock()
    client = _client(clock, rate_limit_per_hour=1)

    client.get("/api/v1/sites/SITE001/current")
    clock.seconds = 3600.5

    assert client.get("/api/v1/sites/SITE001/current").status_code == 200


def test_la_sante_n_entame_pas_le_quota():
    client = _client(FakeClock(), rate_limit_per_hour=1)

    for _ in range(5):
        assert client.get("/health").status_code == 200
    assert client.get("/api/v1/sites").status_code == 200


def test_la_latence_est_appliquee_a_chaque_appel_de_l_api():
    clock = FakeClock()
    client = _client(clock, latency_ms=150)

    client.get("/api/v1/sites/SITE001/current")
    client.get("/health")

    assert clock.slept == [0.15]


def test_reglages_lus_dans_l_environnement():
    settings = settings_from_env({"MOCK_LATENCY_MS": "150", "MOCK_RATE_LIMIT_PER_HOUR": "500"})

    assert settings == {"latency_ms": 150.0, "rate_limit_per_hour": 500}


def test_reglages_absents_valent_zero():
    assert settings_from_env({}) == {"latency_ms": 0.0, "rate_limit_per_hour": 0}
