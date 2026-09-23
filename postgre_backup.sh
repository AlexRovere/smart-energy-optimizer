#!/usr/bin/env bash
# Sauvegarde chiffrée : pg_dump de PostgreSQL + archive du répertoire Parquet, réunis puis chiffrés avec age pour les destinataires de .sops.yaml (#52).
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR"

for outil in docker sops age tar; do
  command -v "$outil" >/dev/null 2>&1 || { echo "backup: '$outil' est requis mais introuvable dans le PATH" >&2; exit 1; }
done

if [ ! -f .sops.yaml ] || [ ! -f secrets.enc.yaml ]; then
  echo "backup: .sops.yaml ou secrets.enc.yaml introuvable à la racine du dépôt" >&2
  exit 1
fi

PARQUET_DIR_HOST=${PARQUET_DIR_HOST:-./data/parquet}
BACKUP_DIR=${BACKUP_DIR:-./backups}
HORODATAGE=$(date -u +%Y%m%dT%H%M%SZ)

WORKDIR=$(mktemp -d)
chmod 700 "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

mkdir -p "$BACKUP_DIR"

echo "backup: dump de la base PostgreSQL" >&2
if ! sops exec-env secrets.enc.yaml \
  'docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$WORKDIR/postgres.dump"; then
  echo "backup: échec du pg_dump, sauvegarde annulée" >&2
  exit 1
fi

if [ ! -s "$WORKDIR/postgres.dump" ]; then
  echo "backup: le dump PostgreSQL est vide, sauvegarde annulée" >&2
  exit 1
fi

if [ ! -d "$PARQUET_DIR_HOST" ]; then
  echo "backup: répertoire Parquet introuvable ($PARQUET_DIR_HOST)" >&2
  exit 1
fi

echo "backup: archive du répertoire Parquet ($PARQUET_DIR_HOST)" >&2
tar -C "$(dirname "$PARQUET_DIR_HOST")" -czf "$WORKDIR/parquet.tar.gz" "$(basename "$PARQUET_DIR_HOST")"

BUNDLE="$WORKDIR/enervision-backup-$HORODATAGE.tar"
tar -C "$WORKDIR" -cf "$BUNDLE" postgres.dump parquet.tar.gz

RECIPIENTS=()
while IFS= read -r cle; do
  RECIPIENTS+=(-r "$cle")
done < <(grep -oE 'age1[0-9a-z]{58}' .sops.yaml | sort -u)

if [ ${#RECIPIENTS[@]} -eq 0 ]; then
  echo "backup: aucun destinataire age trouvé dans .sops.yaml" >&2
  exit 1
fi

DESTINATION="$BACKUP_DIR/enervision-backup-$HORODATAGE.tar.age"
age -e "${RECIPIENTS[@]}" -o "$DESTINATION" "$BUNDLE"

if [ ! -s "$DESTINATION" ]; then
  echo "backup: le fichier chiffré est vide ou absent" >&2
  exit 1
fi

echo "backup: sauvegarde chiffrée écrite dans $DESTINATION" >&2
