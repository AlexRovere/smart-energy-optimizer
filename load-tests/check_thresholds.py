# lit le CSV Locust d'un rapport nommé, échoue si une requête dépasse son seuil (thresholds.py)
from __future__ import annotations

import csv
import sys
from pathlib import Path

from paths import REPORTS_DIR
from thresholds import THRESHOLDS_MS

AGGREGATED_ROW_NAME = "Aggregated"
STATS_CSV_BY_REPORT = {
    "ml": REPORTS_DIR / "loadtest-ml_stats.csv",
    "dashboard-history": REPORTS_DIR / "loadtest-dashboard-history_stats.csv",
}


def read_p95(csv_path: Path) -> dict[str, float]:
    with open(csv_path, newline="", encoding="utf-8") as stats_file:
        rows = csv.DictReader(stats_file)
        return {
            row["Name"]: float(row["95%"])
            for row in rows
            if row["Name"] != AGGREGATED_ROW_NAME
        }


def find_violations(
    measured: dict[str, float], thresholds: dict[str, float]
) -> list[tuple[str, float, float]]:
    return [
        (name, measured[name], thresholds[name])
        for name in thresholds
        if name in measured and measured[name] > thresholds[name]
    ]


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in STATS_CSV_BY_REPORT:
        reports = " | ".join(STATS_CSV_BY_REPORT)
        print(f"usage: python check_thresholds.py <{reports}>", file=sys.stderr)
        sys.exit(2)

    measured = read_p95(STATS_CSV_BY_REPORT[sys.argv[1]])
    violations = find_violations(measured, THRESHOLDS_MS)

    for name, value_ms, threshold_ms in violations:
        print(f"{name} : p95 {value_ms:.0f} ms > seuil {threshold_ms:.0f} ms", file=sys.stderr)

    if violations:
        sys.exit(1)

    print("Tous les seuils de performance sont respectés.")


if __name__ == "__main__":
    main()
