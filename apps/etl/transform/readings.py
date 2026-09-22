# point d'entrée Transform pour l'historique des mesures : alignement horaire, clone
# {colonne}_corrected, champs calendaires — les lags et moyennes glissantes sont des
# constructions ML calculées par le service ML, pas par l'ETL
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
    # le contexte relu sur disque et le nouveau point extrait peuvent s'arrondir sur la meme heure :
    # la ligne la plus recente (la derniere du lot) l'emporte, comme a l'ecriture
    return readings.drop_duplicates(subset=["site_id", "timestamp"], keep="last").reset_index(
        drop=True
    )


def forward_fill_corrected(readings: pd.DataFrame) -> pd.DataFrame:
    readings = readings.copy()
    readings["timestamp"] = pd.to_datetime(readings["timestamp"], utc=True, format="ISO8601")
    readings = readings.sort_values(["site_id", "timestamp"])
    for column in CORRECTABLE_COLUMNS:
        readings[f"{column}_corrected"] = readings.groupby("site_id")[column].ffill()
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
    readings = add_calendar_features(readings)
    return readings
