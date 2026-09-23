#!/usr/bin/env bash
# Ce script peut être utilisé pour surcharger l'appel à la commande "periods" avec les dates préconfigurées, pour combler les trous parquet sur derniers 2 ans
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
START_TIME=$(date -u -d "-2 years" +%Y-%m-%dT00:00:00)

cd "$REPO_ROOT"
exec docker compose run --rm etl python main.py periods --start-time "$START_TIME" --end-time "$END_TIME"
