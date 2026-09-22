# point d'entrée Load pour l'historique des mesures : schéma déclaré, partition site puis jour,
# fusion et écriture atomique
from __future__ import annotations

import os
import re
from collections.abc import Callable
from datetime import date
from pathlib import Path

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

SCHEMA = pa.schema(
    [
        ("site_id", pa.string()),
        ("timestamp", pa.timestamp("us", tz="UTC")),
        ("site_type", pa.string()),
        ("consumption_kw", pa.float64()),
        ("consumption_kw_corrected", pa.float64()),
        ("consumption_kwh", pa.float64()),
        ("consumption_kwh_corrected", pa.float64()),
        ("voltage_v", pa.float64()),
        ("voltage_v_corrected", pa.float64()),
        ("current_a", pa.float64()),
        ("current_a_corrected", pa.float64()),
        ("power_factor", pa.float64()),
        ("power_factor_corrected", pa.float64()),
        ("temperature_celsius", pa.float64()),
        ("temperature_celsius_corrected", pa.float64()),
        ("humidity_percent", pa.float64()),
        ("humidity_percent_corrected", pa.float64()),
        ("data_quality", pa.string()),
        ("null_reasons", pa.list_(pa.string())),
        ("hour", pa.int32()),
        ("day_of_week", pa.int32()),
        ("month", pa.int32()),
        ("is_weekend", pa.bool_()),
        ("is_working_hours", pa.bool_()),
    ]
)


def _partition_path(output_dir: str, site_id: str, day: pd.Timestamp) -> Path:
    return (
        Path(output_dir)
        / f"site_id={site_id}"
        / f"year={day.year:04d}"
        / f"month={day.month:02d}"
        / f"day={day.day:02d}"
        / "readings.parquet"
    )


def _write_atomic(table: pa.Table, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp_target = target.with_suffix(".parquet.tmp")
    pq.write_table(table, tmp_target)
    os.replace(tmp_target, target)


def _merge_with_existing(target: Path, new_rows: pd.DataFrame) -> pd.DataFrame:
    if not target.exists():
        return new_rows

    existing = pd.read_parquet(target)
    merged = pd.concat([existing, new_rows], ignore_index=True)
    merged = merged.drop_duplicates(subset="timestamp", keep="last")
    return merged.sort_values("timestamp").reset_index(drop=True)


_DAY_PARTITION = re.compile(r"^year=(\d{4})/month=(\d{2})/day=(\d{2})$")


RAW_READING_COLUMNS = [
    "site_id",
    "timestamp",
    "site_type",
    "consumption_kw",
    "consumption_kwh",
    "voltage_v",
    "current_a",
    "power_factor",
    "temperature_celsius",
    "humidity_percent",
    "data_quality",
    "null_reasons",
]


def read_context_days(output_dir: str, site_id: str, days: set[date]) -> pd.DataFrame:
    frames = []
    for day in sorted(days):
        target = _partition_path(output_dir, site_id, day)
        if target.exists():
            frames.append(pd.read_parquet(target, columns=RAW_READING_COLUMNS))

    if not frames:
        return pd.DataFrame()
    return pd.concat(frames, ignore_index=True)


def existing_days(output_dir: str, site_id: str) -> set[date]:
    site_dir = Path(output_dir) / f"site_id={site_id}"
    if not site_dir.is_dir():
        return set()

    days: set[date] = set()
    for parquet_file in site_dir.glob("year=*/month=*/day=*/readings.parquet"):
        relative = parquet_file.parent.relative_to(site_dir).as_posix()
        match = _DAY_PARTITION.match(relative)
        if match:
            year, month, day = (int(part) for part in match.groups())
            days.add(date(year, month, day))
    return days


def write_readings(
    readings: pd.DataFrame,
    output_dir: str,
    on_file_written: Callable[[], None] | None = None,
) -> list[str]:
    if readings.empty:
        return []

    readings = readings.copy()
    readings["timestamp"] = pd.to_datetime(readings["timestamp"], utc=True, format="ISO8601")
    days = readings["timestamp"].dt.floor("D")

    written: list[str] = []
    for (site_id, day), group in readings.groupby([readings["site_id"], days]):
        target = _partition_path(output_dir, site_id, day)
        merged = _merge_with_existing(target, group[SCHEMA.names])
        table = pa.Table.from_pandas(merged, schema=SCHEMA, preserve_index=False)
        _write_atomic(table, target)
        written.append(str(target))
        if on_file_written is not None:
            on_file_written()

    return written
