# charge du service ML : POST /training, à faible poids face à PredictionsUser (ml_predictions.py)
from __future__ import annotations

import os

from locust import HttpUser, between, task


class TrainingUser(HttpUser):
    weight = int(os.getenv("LOAD_TEST_TRAINING_WEIGHT", "1"))
    wait_time = between(30, 60)

    @task
    def training(self) -> None:
        self.client.post("/training", name="training")
