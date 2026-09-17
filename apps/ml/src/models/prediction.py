from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

import pandas as pd

from features import MINIMUM_HISTORY_HOURS, SiteSchedules, build_prediction_features


MAXIMUM_HORIZON_HOURS = 168


class PredictionModel(Protocol):
    """Small interface shared by CatBoost and the fake model used in tests."""

    def predict(self, data: pd.DataFrame): ...


@dataclass(frozen=True)
class PredictionTarget:
    site_id: str
    timestamp: datetime


@dataclass(frozen=True)
class Prediction:
    site_id: str
    timestamp: datetime
    consumption_kwh: float


class PredictionService:
    """Forecast at most 168 hours from 168 consecutive historical hours."""

    def __init__(
        self, model: PredictionModel, history: pd.DataFrame, schedules: SiteSchedules
    ) -> None:
        self.model = model
        self.history = history
        self.schedules = schedules

    def predict(self, targets: list[PredictionTarget]) -> list[Prediction]:
        if not targets:
            raise ValueError("At least one prediction is required")

        # Results are stored by site and timestamp, then put back in the exact
        # order supplied by the API caller.
        predictions: dict[tuple[str, datetime], float] = {}
        site_ids = dict.fromkeys(target.site_id for target in targets)

        for site_id in site_ids:
            site_targets = [target for target in targets if target.site_id == site_id]
            predictions.update(self._predict_site(site_id, site_targets))

        return [
            Prediction(
                site_id=target.site_id,
                timestamp=target.timestamp,
                consumption_kwh=predictions[(target.site_id, target.timestamp)],
            )
            for target in targets
        ]

    def _predict_site(
        self, site_id: str, targets: list[PredictionTarget]
    ) -> dict[tuple[str, datetime], float]:
        site_data = self.history[self.history["site_id"] == site_id].sort_values(
            "timestamp"
        )
        if site_data.empty:
            raise ValueError(f"Unknown site: {site_id}")

        site_types = site_data["site_type"].dropna().unique()
        if len(site_types) != 1:
            raise ValueError(f"Site {site_id} must have exactly one site type")
        site_type = str(site_types[0])

        last_timestamp = pd.Timestamp(site_data["timestamp"].iloc[-1])
        requested_timestamps = [pd.Timestamp(target.timestamp) for target in targets]
        first_requested = min(requested_timestamps)
        last_requested = max(requested_timestamps)

        if first_requested <= last_timestamp:
            raise ValueError(
                f"Predictions for {site_id} must be after its last known timestamp"
            )

        horizon = (last_requested - last_timestamp) / pd.Timedelta(hours=1)
        if not horizon.is_integer() or horizon > MAXIMUM_HORIZON_HOURS:
            raise ValueError(
                f"Prediction horizon for {site_id} must be between 1 and "
                f"{MAXIMUM_HORIZON_HOURS} hours"
            )

        recent_history = site_data.tail(MINIMUM_HISTORY_HOURS)
        self._validate_recent_history(site_id, recent_history, last_timestamp)
        values = recent_history["consumption_kwh_corrected"].astype(float).tolist()

        site_predictions: dict[tuple[str, datetime], float] = {}
        requested_set = set(requested_timestamps)

        # Predict every intermediate hour. Even an hour not requested by the
        # caller is needed to build the lags of later requested hours.
        future_hours = pd.date_range(
            start=last_timestamp + pd.Timedelta(hours=1),
            end=last_requested,
            freq="h",
        )
        for timestamp in future_hours:
            features = build_prediction_features(
                site_id=site_id,
                site_type=site_type,
                timestamp=timestamp.to_pydatetime(),
                history=values,
                schedules=self.schedules,
            )
            prediction = float(self.model.predict(features)[0])
            values.append(prediction)

            if timestamp in requested_set:
                site_predictions[(site_id, timestamp.to_pydatetime())] = prediction

        return site_predictions

    @staticmethod
    def _validate_recent_history(
        site_id: str, recent_history: pd.DataFrame, last_timestamp: pd.Timestamp
    ) -> None:
        if len(recent_history) < MINIMUM_HISTORY_HOURS:
            raise ValueError(
                f"Site {site_id} needs at least {MINIMUM_HISTORY_HOURS} hours of history"
            )

        if recent_history["consumption_kwh_corrected"].isna().any():
            raise ValueError(f"Site {site_id} has missing consumption history")

        # Row-based lags are valid only if the 168 latest rows really represent
        # 168 consecutive hours.
        expected = pd.date_range(
            end=last_timestamp, periods=MINIMUM_HISTORY_HOURS, freq="h"
        )
        actual = pd.DatetimeIndex(recent_history["timestamp"])
        if not actual.equals(expected):
            raise ValueError(f"Site {site_id} history must contain consecutive hours")
