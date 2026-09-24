#!/usr/bin/env bash
# Passage horaire de l'ETL, lancé par la crontab que pose le playbook (#206).
set -euo pipefail

: "${ETL_METRICS_DIR:?renseigner ETL_METRICS_DIR, voir la ligne de cron du playbook}"

# cron ne fournit ni le PATH de sops ni la clé age.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export SOPS_AGE_KEY_FILE=${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

echo "etl_cron: passage du $(date -u +%Y-%m-%dT%H:%M:%SZ)" >&2

# Deux passages simultanés écriraient les mêmes partitions.
exec 9>/tmp/enervision-etl.lock
if ! flock --nonblock 9; then
  echo "etl_cron: un passage est encore en cours, celui-ci est abandonné" >&2
  exit 1
fi

# Trois essais contre une erreur passagère. Chacun borné à 15 min : un passage
# bloqué garderait le verrou et ferait sauter tous les suivants. Le tout tient
# dans l'heure. -T garde stdout (le JSON) séparé de stderr. 24 h relues : un
# passage manqué est comblé par le suivant.
for attempt in 1 2 3; do
  if sops exec-env secrets.enc.yaml 'timeout 15m docker compose run --rm -T etl python main.py hour --hours 24'; then
    break
  fi
  if [[ "$attempt" -eq 3 ]]; then
    echo "etl_cron: échec après 3 essais" >&2
    exit 1
  fi
  echo "etl_cron: essai $attempt en échec, nouvel essai dans 2 min" >&2
  sleep 120
done

# Horodatage du passage réussi pour node-exporter, renommé pour n'être jamais lu à moitié.
metrics_file="$ETL_METRICS_DIR/etl.prom"
cat > "$metrics_file.tmp" <<EOF
# HELP enervision_etl_last_success_timestamp_seconds Fin du dernier passage réussi de l'ETL.
# TYPE enervision_etl_last_success_timestamp_seconds gauge
enervision_etl_last_success_timestamp_seconds $(date +%s)
EOF
chmod 0644 "$metrics_file.tmp"
mv "$metrics_file.tmp" "$metrics_file"
