#!/usr/bin/env bash
# Daily PostgreSQL backup for TransfoHub.
#
# BACKUP_FORMAT:
#   pg     pg_dump custom (.dump) — restore with pg_restore
#   json   TransfoHub dump (.thdump.json) — restore via /maintenance/db
#   both   the two formats (default)
#
# Env (optional):
#   APP_DIR       default: repo root
#   BACKUP_DIR    default: $APP_DIR/backups
#   KEEP_DAYS     default: 14
#   ENV_FILE      default: $APP_DIR/.env
#   BACKUP_FORMAT default: both
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
BACKUP_FORMAT="${BACKUP_FORMAT:-both}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env introuvable: $ENV_FILE" >&2
  exit 1
fi

DATABASE_URL="$(
  grep -E '^[[:space:]]*DATABASE_URL=' "$ENV_FILE" \
    | tail -n 1 \
    | sed -E 's/^[[:space:]]*DATABASE_URL=//; s/^["'\'']//; s/["'\'']$//'
)"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL manquant dans $ENV_FILE" >&2
  exit 1
fi
export DATABASE_URL
PGURL="${DATABASE_URL%%\?*}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%F_%H%M)"

want_pg=0
want_json=0
case "$BACKUP_FORMAT" in
  pg) want_pg=1 ;;
  json) want_json=1 ;;
  both) want_pg=1; want_json=1 ;;
  *)
    echo "ERROR: BACKUP_FORMAT=$BACKUP_FORMAT (pg|json|both)" >&2
    exit 1
    ;;
esac

if [[ "$want_pg" -eq 1 ]]; then
  if ! command -v pg_dump >/dev/null 2>&1; then
    echo "ERROR: pg_dump introuvable. Installez postgresql-client." >&2
    exit 1
  fi
  FILE="$BACKUP_DIR/transfodb_${STAMP}.dump"
  echo "[$(date -Iseconds)] pg_dump → $FILE"
  pg_dump \
    --dbname="$PGURL" \
    --format=custom \
    --compress=9 \
    --file="$FILE" \
    --no-owner \
    --no-acl
  echo "[$(date -Iseconds)] OK $FILE ($(du -h "$FILE" | awk '{print $1}'))"
fi

if [[ "$want_json" -eq 1 ]]; then
  if ! command -v npx >/dev/null 2>&1; then
    echo "ERROR: npx introuvable (Node.js requis pour le dump JSON)." >&2
    exit 1
  fi
  JSON_FILE="$BACKUP_DIR/transfodb_${STAMP}.thdump.json"
  echo "[$(date -Iseconds)] thdump json → $JSON_FILE"
  (
    cd "$APP_DIR"
    npx --yes tsx scripts/backup-dump-json.ts "$JSON_FILE"
  )
  echo "[$(date -Iseconds)] OK $JSON_FILE ($(du -h "$JSON_FILE" | awk '{print $1}'))"
fi

echo "[$(date -Iseconds)] retention ${KEEP_DAYS}d"
find "$BACKUP_DIR" -type f \( -name 'transfodb_*.dump' -o -name 'transfodb_*.thdump.json' \) \
  -mtime +"$KEEP_DAYS" -print -delete \
  | while read -r gone; do
      echo "[$(date -Iseconds)] purged $gone"
    done

echo "[$(date -Iseconds)] done"
