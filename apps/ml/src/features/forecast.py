from collections.abc import Sequence
from datetime import datetime

import pandas as pd

from features.schedules import SiteSchedules, is_working_hour


CALENDAR_COLUMNS = [
    "hour",
    "day_of_week",
    "month",
    "is_weekend",
    "is_working_hours",
]

# The order is important: CatBoost expects the same columns and the same order
# during training and prediction.
FEATURE_COLUMNS = [
    "site_id",
    "site_type",
    *CALENDAR_COLUMNS,
    "consumption_lag_1h",
    "consumption_lag_2h",
    "consumption_lag_24h",
    "consumption_lag_48h",
    "consumption_lag_168h",
    "rolling_mean_24h",
    "rolling_mean_168h",
]

LAGS = (1, 2, 24, 48, 168)
MINIMUM_HISTORY_HOURS = max(LAGS)


def build_prediction_features(
    site_id: str,
    site_type: str,
    timestamp: datetime,
    history: Sequence[float],
    schedules: SiteSchedules,
) -> pd.DataFrame:
    """Build one CatBoost row using only values known before ``timestamp``."""
    if len(history) < MINIMUM_HISTORY_HOURS:
        raise ValueError(
            f"At least {MINIMUM_HISTORY_HOURS} hours of history are required"
        )

    # Calendar values are deterministic from the requested future timestamp.
    # Only working hours come from the explicit per-site configuration.
    row = {
        "site_id": site_id,
        "site_type": site_type,
        "hour": timestamp.hour,
        "day_of_week": timestamp.weekday(),
        "month": timestamp.month,
        "is_weekend": int(timestamp.weekday() >= 5),
        "is_working_hours": is_working_hour(site_id, timestamp, schedules),
        "consumption_lag_1h": history[-1],
        "consumption_lag_2h": history[-2],
        "consumption_lag_24h": history[-24],
        "consumption_lag_48h": history[-48],
        "consumption_lag_168h": history[-168],
        "rolling_mean_24h": sum(history[-24:]) / 24,
        "rolling_mean_168h": sum(history[-168:]) / 168,
    }
    return pd.DataFrame([row], columns=FEATURE_COLUMNS)


def add_training_features(data: pd.DataFrame) -> pd.DataFrame:
    """Add consumption lags while keeping calendar values from the dataset."""
    missing_columns = set(CALENDAR_COLUMNS).difference(data.columns)
    if missing_columns:
        missing = ", ".join(sorted(missing_columns))
        raise ValueError(f"Missing calendar columns: {missing}")

    featured = data.sort_values(["site_id", "timestamp"]).copy()
    grouped = featured.groupby("site_id", sort=False)["consumption_kwh_corrected"]

    for lag in LAGS:
        featured[f"consumption_lag_{lag}h"] = grouped.shift(lag)

    # shift(1) is essential: without it, the target value would leak into its
    # own rolling mean and make evaluation unrealistically good.
    featured["rolling_mean_24h"] = grouped.transform(
        lambda values: values.shift(1).rolling(24).mean()
    )
    featured["rolling_mean_168h"] = grouped.transform(
        lambda values: values.shift(1).rolling(168).mean()
    )
    return featured
