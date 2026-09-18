import json
from datetime import datetime
from pathlib import Path
from typing import Any

SiteSchedules = dict[str, dict[str, Any]]


def load_site_schedules(path: str | Path) -> SiteSchedules:
    """Load and validate the working-hours configuration for every site."""
    config_path = Path(path)
    if not config_path.is_file():
        raise FileNotFoundError(f"Site configuration not found: {config_path}")

    with config_path.open(encoding="utf-8-sig") as config_file:
        schedules = json.load(config_file)

    if not isinstance(schedules, dict):
        raise ValueError("Site configuration must be a JSON object")

    for site_id, schedule in schedules.items():
        _validate_schedule(site_id, schedule)
    return schedules


def _validate_schedule(site_id: str, schedule: Any) -> None:
    if not isinstance(schedule, dict):
        raise ValueError(f"Invalid working-hours configuration for site: {site_id}")
    if schedule.get("always_open") is True:
        return

    working_days = schedule.get("working_days")
    start_hour = schedule.get("start_hour")
    end_hour = schedule.get("end_hour_inclusive")
    valid_days = isinstance(working_days, list) and all(
        isinstance(day, int) and 0 <= day <= 6 for day in working_days
    )
    valid_hours = (
        isinstance(start_hour, int)
        and isinstance(end_hour, int)
        and 0 <= start_hour <= end_hour <= 23
    )
    if not valid_days or not valid_hours:
        raise ValueError(f"Invalid working-hours configuration for site: {site_id}")


def is_working_hour(site_id: str, timestamp: datetime, schedules: SiteSchedules) -> int:
    """Return the configured working-hours flag for one future timestamp."""
    schedule = schedules.get(site_id)
    if schedule is None:
        raise ValueError(f"No working-hours configuration for site: {site_id}")

    if schedule.get("always_open") is True:
        return 1

    return int(
        timestamp.weekday() in schedule["working_days"]
        and schedule["start_hour"] <= timestamp.hour <= schedule["end_hour_inclusive"]
    )
