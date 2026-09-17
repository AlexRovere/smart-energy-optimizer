# point d'entrée Transform pour l'historique des mesures : alignement horaire, clone {colonne}_corrected, règles de nettoyage à venir
from __future__ import annotations

import pandas as pd

CORRECTABLE_COLUMNS = [
    "consumption_kw",
    "consumption_kwh",
    "voltage_v",
    "current_a",
    "power_factor",
    "temperature_celsius",
    "humidity_percent",
]


def align_timestamps_to_the_hour(readings: pd.DataFrame) -> pd.DataFrame:
    readings = readings.copy()
    readings["timestamp"] = pd.to_datetime(
        readings["timestamp"], utc=True, format="ISO8601"
    ).dt.round("h")
    return readings


def forward_fill_corrected(readings: pd.DataFrame) -> pd.DataFrame:
    readings = readings.copy()
    readings["timestamp"] = pd.to_datetime(readings["timestamp"], utc=True, format="ISO8601")
    readings = readings.sort_values(["site_id", "timestamp"])
    for column in CORRECTABLE_COLUMNS:
        readings[f"{column}_corrected"] = readings.groupby("site_id")[column].ffill()
    return readings


LAG_HOURS = [1, 2, 24, 48, 168]
LAG_MATCH_TOLERANCE = pd.Timedelta(seconds=60)


def add_consumption_lags(readings: pd.DataFrame) -> pd.DataFrame:
    readings = readings.copy()
    for hours in LAG_HOURS:
        readings[f"consumption_lag_{hours}h"] = pd.Series(index=readings.index, dtype="float64")

    for _, group in readings.groupby("site_id"):
        history = group.set_index("timestamp")["consumption_kwh_corrected"].sort_index()
        for hours in LAG_HOURS:
            lookup_times = pd.DatetimeIndex(group["timestamp"] - pd.Timedelta(hours=hours))
            lagged = history.reindex(
                lookup_times, method="nearest", tolerance=LAG_MATCH_TOLERANCE
            )
            readings.loc[group.index, f"consumption_lag_{hours}h"] = lagged.to_numpy()

    return readings


ROLLING_WINDOWS_HOURS = [24, 168]


def add_rolling_means(readings: pd.DataFrame) -> pd.DataFrame:
    readings = readings.copy()
    for hours in ROLLING_WINDOWS_HOURS:
        readings[f"rolling_mean_{hours}h"] = pd.Series(index=readings.index, dtype="float64")

    for _, group in readings.groupby("site_id"):
        ordered = group.sort_values("timestamp")
        series = ordered.set_index("timestamp")["consumption_kwh_corrected"]
        for hours in ROLLING_WINDOWS_HOURS:
            rolled = series.rolling(f"{hours}h").mean()
            readings.loc[ordered.index, f"rolling_mean_{hours}h"] = rolled.to_numpy()

    return readings


def add_calendar_features(readings: pd.DataFrame) -> pd.DataFrame:
    readings = readings.copy()
    timestamps = pd.to_datetime(readings["timestamp"], utc=True, format="ISO8601")
    readings["hour"] = timestamps.dt.hour
    readings["day_of_week"] = timestamps.dt.dayofweek
    readings["month"] = timestamps.dt.month
    readings["is_weekend"] = readings["day_of_week"] >= 5
    readings["is_working_hours"] = (
        ~readings["is_weekend"] & (readings["hour"] >= 8) & (readings["hour"] < 18)
    )
    return readings


def transform_readings(readings: pd.DataFrame) -> pd.DataFrame:
    if readings.empty:
        return readings

    readings = align_timestamps_to_the_hour(readings)
    readings = forward_fill_corrected(readings)
    readings = add_consumption_lags(readings)
    readings = add_rolling_means(readings)
    readings = add_calendar_features(readings)
    return readings
