# charge du dashboard : GET /api/sites/{id}/history (lecture Parquet directe, aucun tiers)
from __future__ import annotations

import os
import random

from locust import HttpUser, between, task

SITE_IDS = ["SITE001", "SITE002", "SITE003"]
DEMO_EMAIL = os.getenv("LOAD_TEST_DASHBOARD_EMAIL", "admin@enervision.local")
DEMO_PASSWORD = os.getenv("LOAD_TEST_DASHBOARD_PASSWORD", "")

HISTORY_FROM = "2024-06-01T00:00:00.000Z"
HISTORY_TO = "2024-06-08T00:00:00.000Z"


class DashboardHistoryUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self) -> None:
        self.client.post(
            "/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
            name="login",
        )

    @task
    def history(self) -> None:
        site_id = random.choice(SITE_IDS)
        self.client.get(
            f"/api/sites/{site_id}/history",
            params={"from": HISTORY_FROM, "to": HISTORY_TO, "limit": 500},
            name="dashboard_history",
        )
