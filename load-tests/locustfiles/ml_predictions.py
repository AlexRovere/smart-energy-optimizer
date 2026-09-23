# charge du service ML : POST /predictions, une requête nommée par horizon (1h/24h/168h)
from __future__ import annotations

import os
import random
from datetime import datetime, timedelta

from locust import HttpUser, between, task

SITE_IDS = ["SITE001", "SITE002", "SITE003"]
FIRST_PREDICTABLE_DATETIME = datetime(2025, 12, 31, 0, 0)


def _payload(horizon_hours: int) -> list[dict[str, object]]:
    site_id = random.choice(SITE_IDS)
    return [
        {
            "site_id": site_id,
            "date": (FIRST_PREDICTABLE_DATETIME + timedelta(hours=offset)).date().isoformat(),
            "hour": (FIRST_PREDICTABLE_DATETIME + timedelta(hours=offset)).hour,
        }
        for offset in range(horizon_hours)
    ]


class PredictionsUser(HttpUser):
    weight = int(os.getenv("LOAD_TEST_PREDICTIONS_WEIGHT", "10"))
    wait_time = between(1, 3)

    @task(3)
    def predictions_1h(self) -> None:
        self.client.post(
            "/predictions", json=_payload(1), name="predictions_1h"
        )

    @task(2)
    def predictions_24h(self) -> None:
        self.client.post(
            "/predictions", json=_payload(24), name="predictions_24h"
        )

    @task(1)
    def predictions_168h(self) -> None:
        self.client.post(
            "/predictions", json=_payload(168), name="predictions_168h"
        )
