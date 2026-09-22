#!/usr/bin/env bash
# Cron : comble les trous de l'historique Parquet sur les 2 dernières années ; main.py periods saute déjà les jours présents, site par site.
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
START_TIME=$(date -u -d "-2 years" +%Y-%m-%dT00:00:00)

cd "$REPO_ROOT"
exec docker compose run --rm etl python main.py periods --start-time "$START_TIME" --end-time "$END_TIME"
