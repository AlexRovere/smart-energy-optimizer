# lit le CSV --csv de Locust et échoue si une requête nommée dépasse son seuil (thresholds.py)
from __future__ import annotations

import csv
import sys
from pathlib import Path

from path_guard import resolve_within
from thresholds import THRESHOLDS_MS

AGGREGATED_ROW_NAME = "Aggregated"


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
    if len(sys.argv) != 2:
        print("usage: python check_thresholds.py <préfixe>_stats.csv", file=sys.stderr)
        sys.exit(2)

    try:
        csv_path = resolve_within(sys.argv[1])
    except ValueError as error:
        print(error, file=sys.stderr)
        sys.exit(2)

    measured = read_p95(csv_path)
    violations = find_violations(measured, THRESHOLDS_MS)

    for name, value_ms, threshold_ms in violations:
        print(f"{name} : p95 {value_ms:.0f} ms > seuil {threshold_ms:.0f} ms", file=sys.stderr)

    if violations:
        sys.exit(1)

    print("Tous les seuils de performance sont respectés.")


if __name__ == "__main__":
    main()
