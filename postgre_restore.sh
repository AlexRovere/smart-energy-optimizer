#!/usr/bin/env bash
# Restauration : déchiffre une sauvegarde age puis restaure le dump PostgreSQL et l'archive Parquet ; refuse une base non vide sauf --force.
set -euo pipefail

usage() {
  echo "Usage: $0 <archive.tar.age> [--force]" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
ARCHIVE=$1
FORCE=0
[[ "${2:-}" == "--force" ]] && FORCE=1

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

for outil in docker sops age tar; do
  command -v "$outil" >/dev/null 2>&1 || { echo "restore: '$outil' est requis mais introuvable dans le PATH" >&2; exit 1; }
done

[[ -f "$ARCHIVE" ]] || { echo "restore: archive introuvable : $ARCHIVE" >&2; exit 1; }

AGE_IDENTITY=${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}
[[ -f "$AGE_IDENTITY" ]] || { echo "restore: clé age privée introuvable ($AGE_IDENTITY)" >&2; exit 1; }

PARQUET_DIR_HOST=${PARQUET_DIR_HOST:-./data/parquet}

WORKDIR=$(mktemp -d)
chmod 700 "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

echo "restore: déchiffrement de $ARCHIVE" >&2
age -d -i "$AGE_IDENTITY" -o "$WORKDIR/bundle.tar" "$ARCHIVE"
tar -C "$WORKDIR" -xf "$WORKDIR/bundle.tar" postgres.dump parquet.tar.gz

if [[ "$FORCE" -ne 1 ]]; then
  echo "restore: vérification que la base cible est vide" >&2
  QUERY="SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')"
  CMD="docker compose exec -T -e PGPASSWORD=\"\$POSTGRES_PASSWORD\" postgres psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$QUERY\""
  TABLE_COUNT=$(sops exec-env secrets.enc.yaml "$CMD" | tr -d '[:space:]')
  if [[ "$TABLE_COUNT" != "0" ]]; then
    echo "restore: la base cible contient déjà $TABLE_COUNT table(s), restauration refusée (relancer avec --force pour écraser)" >&2
    exit 1
  fi
fi

echo "restore: restauration de la base PostgreSQL" >&2
sops exec-env secrets.enc.yaml \
  'docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' \
  < "$WORKDIR/postgres.dump"

if [[ "$FORCE" -ne 1 && -d "$PARQUET_DIR_HOST" && -n "$(ls -A "$PARQUET_DIR_HOST" 2>/dev/null)" ]]; then
  echo "restore: le répertoire Parquet ($PARQUET_DIR_HOST) n'est pas vide, restauration refusée (relancer avec --force pour écraser)" >&2
  exit 1
fi

echo "restore: extraction de l'archive Parquet vers $PARQUET_DIR_HOST" >&2
mkdir -p "$(dirname "$PARQUET_DIR_HOST")"
tar -xzf "$WORKDIR/parquet.tar.gz" -C "$(dirname "$PARQUET_DIR_HOST")"

echo "restore: restauration terminée" >&2
