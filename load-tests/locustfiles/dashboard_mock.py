# charge du dashboard : GET /api/sites/{id}/current (accès à l'API Mock, jamais bloquant)
from __future__ import annotations

import os
import random

from _tls import tls_verify
from locust import HttpUser, between, task

SITE_IDS = ["SITE001", "SITE002", "SITE003"]
DEMO_EMAIL = os.getenv("LOAD_TEST_DASHBOARD_EMAIL", "admin@enervision.local")
DEMO_PASSWORD = os.getenv("LOAD_TEST_DASHBOARD_PASSWORD", "")


class DashboardMockUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self) -> None:
        self.client.verify = tls_verify()
        self.client.post(
            "/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
            name="login",
        )

    @task
    def current(self) -> None:
        site_id = random.choice(SITE_IDS)
        self.client.get(f"/api/sites/{site_id}/current", name="dashboard_mock")
