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

# L'archive se nomme depuis le répertoire d'appel : son chemin est fixé avant
# de se placer à la racine du dépôt, sans quoi un chemin relatif serait perdu.
[[ -f "$ARCHIVE" ]] || { echo "restore: archive introuvable : $ARCHIVE" >&2; exit 1; }
ARCHIVE=$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")

# Le script vit dans scripts/ : tout ce qui suit se lit depuis la racine du dépôt.
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

for outil in docker age tar; do
  command -v "$outil" >/dev/null 2>&1 || { echo "restore: '$outil' est requis mais introuvable dans le PATH" >&2; exit 1; }
done

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
  # Variables développées dans le conteneur, qui les tient de la composition.
  TABLE_COUNT=$(docker compose exec -T postgres \
    sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$QUERY\"" \
    | tr -d '[:space:]')
  if [[ "$TABLE_COUNT" != "0" ]]; then
    echo "restore: la base cible contient déjà $TABLE_COUNT table(s), restauration refusée (relancer avec --force pour écraser)" >&2
    exit 1
  fi
fi

# Les deux refus passent avant toute écriture : refuser le Parquet après avoir
# restauré la base laissait une restauration à moitié faite.
if [[ "$FORCE" -ne 1 && -d "$PARQUET_DIR_HOST" && -n "$(ls -A "$PARQUET_DIR_HOST" 2>/dev/null)" ]]; then
  echo "restore: le répertoire Parquet ($PARQUET_DIR_HOST) n'est pas vide, restauration refusée (relancer avec --force pour écraser)" >&2
  exit 1
fi

# Le dump porte les GRANT au rôle etl, mais pas le rôle : les rôles sont
# globaux au cluster, pg_dump ne les emporte pas. Sur une base neuve, les GRANT
# échouaient et arrêtaient la restauration. Même création que la migration
# 0001_role_etl.sql, sans connexion ni secret : l'amorçage l'active ensuite.
echo "restore: rôle etl (sans connexion, activé par l'amorçage)" >&2
# shellcheck disable=SC2016 # développé par le shell du conteneur, pas celui-ci
docker compose exec -T postgres \
  sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q' <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'etl') THEN
    CREATE ROLE etl NOLOGIN;
  END IF;
END
$$;
SQL

echo "restore: restauration de la base PostgreSQL" >&2
# shellcheck disable=SC2016 # développé par le shell du conteneur, pas celui-ci
docker compose exec -T postgres \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' \
  < "$WORKDIR/postgres.dump"

echo "restore: extraction de l'archive Parquet vers $PARQUET_DIR_HOST" >&2
# L'archive contient le dossier source sous son propre nom : on en extrait le
# contenu dans PARQUET_DIR_HOST, sans quoi une cible nommée autrement recevait
# un dossier voisin que personne ne lit.
mkdir -p "$PARQUET_DIR_HOST"
tar -xzf "$WORKDIR/parquet.tar.gz" -C "$PARQUET_DIR_HOST" --strip-components=1

echo "restore: restauration terminée" >&2
