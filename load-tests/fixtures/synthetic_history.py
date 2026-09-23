# écrit un historique Parquet synthétique, hive-partitionné par site_id, pour le ML et le dashboard
from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

DEFAULT_SITE_IDS = ["SITE001", "SITE002", "SITE003"]


def build_history(site_ids: list[str], years: int) -> pd.DataFrame:
    hours = years * 365 * 24
    timestamps = pd.date_range("2024-01-01", periods=hours, freq="h")

    frames = []
    for site_id in site_ids:
        consumption = pd.Series(range(hours), dtype="float64") % 24 + 10.0
        frame = pd.DataFrame(
            {
                "site_id": site_id,
                "site_type": "office",
                "timestamp": timestamps,
                "consumption_kwh": consumption,
                "consumption_kw": consumption,
                "consumption_kw_corrected": consumption,
                "voltage_v": 400.0,
                "current_a": 130.0,
                "power_factor": 0.92,
                "temperature_celsius": 20.0,
                "humidity_percent": 55.0,
                "null_reasons": [[]] * hours,
                "data_quality": "good",
                "hour": timestamps.hour,
                "day_of_week": timestamps.dayofweek,
                "month": timestamps.month,
                "is_weekend": timestamps.dayofweek >= 5,
                "is_working_hours": (timestamps.dayofweek < 5)
                & (timestamps.hour >= 8)
                & (timestamps.hour < 18),
            }
        )
        frames.append(frame)

    return pd.concat(frames, ignore_index=True)


def write_history(output_dir: Path, site_ids: list[str], years: int) -> None:
    history = build_history(site_ids, years)
    history.to_parquet(output_dir, partition_cols=["site_id"], engine="pyarrow")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--sites", type=int, default=len(DEFAULT_SITE_IDS))
    parser.add_argument("--years", type=int, default=2)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    write_history(args.output_dir, DEFAULT_SITE_IDS[: args.sites], args.years)


if __name__ == "__main__":
    main()
