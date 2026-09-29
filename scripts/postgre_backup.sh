#!/usr/bin/env bash
# Sauvegarde chiffrée : pg_dump de PostgreSQL + archive du répertoire Parquet, réunis puis chiffrés avec age pour les destinataires de .sops.yaml (#52).
set -euo pipefail

# Le script vit dans scripts/ : tout ce qui suit se lit depuis la racine du dépôt.
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

for tool in docker age tar; do
  command -v "$tool" >/dev/null 2>&1 || { echo "backup: '$tool' est requis mais introuvable dans le PATH" >&2; exit 1; }
done

if [[ ! -f .sops.yaml ]]; then
  echo "backup: .sops.yaml introuvable à la racine du dépôt" >&2
  exit 1
fi

PARQUET_DIR_HOST=${PARQUET_DIR_HOST:-./data/parquet}
BACKUP_DIR=${BACKUP_DIR:-./backups}
TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)

WORKDIR=$(mktemp -d)
chmod 700 "$WORKDIR"
trap 'rm -rf "$WORKDIR"' EXIT

mkdir -p "$BACKUP_DIR"

echo "backup: dump de la base PostgreSQL" >&2
# Utilisateur, base et mot de passe sont lus dans le conteneur, qui les tient de
# la composition : l'hôte ne les a pas dans son environnement, et un
# « -U "$POSTGRES_USER" » développé ici se connectait en root.
# shellcheck disable=SC2016 # développé par le shell du conteneur, pas celui-ci
if ! docker compose exec -T postgres \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$WORKDIR/postgres.dump"; then
  echo "backup: échec du pg_dump, sauvegarde annulée" >&2
  exit 1
fi

if [[ ! -s "$WORKDIR/postgres.dump" ]]; then
  echo "backup: le dump PostgreSQL est vide, sauvegarde annulée" >&2
  exit 1
fi

if [[ ! -d "$PARQUET_DIR_HOST" ]]; then
  echo "backup: répertoire Parquet introuvable ($PARQUET_DIR_HOST)" >&2
  exit 1
fi

echo "backup: archive du répertoire Parquet ($PARQUET_DIR_HOST)" >&2
tar -C "$(dirname "$PARQUET_DIR_HOST")" -czf "$WORKDIR/parquet.tar.gz" "$(basename "$PARQUET_DIR_HOST")"

BUNDLE="$WORKDIR/enervision-backup-$TIMESTAMP.tar"
tar -C "$WORKDIR" -cf "$BUNDLE" postgres.dump parquet.tar.gz

RECIPIENTS=()
while IFS= read -r key; do
  RECIPIENTS+=(-r "$key")
done < <(grep -oE 'age1[0-9a-z]{58}' .sops.yaml | sort -u)

if [[ ${#RECIPIENTS[@]} -eq 0 ]]; then
  echo "backup: aucun destinataire age trouvé dans .sops.yaml" >&2
  exit 1
fi

DESTINATION="$BACKUP_DIR/enervision-backup-$TIMESTAMP.tar.age"
age -e "${RECIPIENTS[@]}" -o "$DESTINATION" "$BUNDLE"

if [[ ! -s "$DESTINATION" ]]; then
  echo "backup: le fichier chiffré est vide ou absent" >&2
  exit 1
fi

echo "backup: sauvegarde chiffrée écrite dans $DESTINATION" >&2
