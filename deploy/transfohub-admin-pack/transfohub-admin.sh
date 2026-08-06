#!/bin/bash
# =============================================================================
# TransfoHub — menu d'administration (portable)
# Placez ce script à côté de config.env et du dossier backups/
# Usage : ./transfohub-admin.sh
# =============================================================================
set -euo pipefail

# --- Localisation du pack ----------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERREUR: config.env introuvable à côté du script : $CONFIG_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG_FILE"

# Valeurs par défaut si absentes du config
APP_DIR="${APP_DIR:-/var/www/transfohub}"
PM2_NAME="${PM2_NAME:-transfohub}"
APP_PORT="${APP_PORT:-7000}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"
GITHUB_ZIP_URL="${GITHUB_ZIP_URL:-https://github.com/Larbs77/TransfoHub/archive/refs/heads/main.zip}"
MAX_BACKUPS="${MAX_BACKUPS:-10}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
STOP_NGINX_ON_STOP="${STOP_NGINX_ON_STOP:-yes}"

if [[ -z "${BACKUP_ROOT:-}" ]]; then
  BACKUP_ROOT="${SCRIPT_DIR}/backups"
fi
if [[ -z "${LOG_FILE:-}" ]]; then
  LOG_FILE="${SCRIPT_DIR}/transfohub-admin.log"
fi

# Commandes (override config ou PATH)
PG_DUMP_BIN="${CMD_PG_DUMP:-$(command -v pg_dump || true)}"
PSQL_BIN="${CMD_PSQL:-$(command -v psql || true)}"
NPM_BIN="${CMD_NPM:-$(command -v npm || true)}"
PM2_BIN="${CMD_PM2:-$(command -v pm2 || true)}"
GIT_BIN="${CMD_GIT:-$(command -v git || true)}"
CURL_BIN="${CMD_CURL:-$(command -v curl || true)}"
RSYNC_BIN="${CMD_RSYNC:-$(command -v rsync || true)}"
TAR_BIN="${CMD_TAR:-$(command -v tar || true)}"
UNZIP_BIN="${CMD_UNZIP:-$(command -v unzip || true)}"

# --- Couleurs ----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
info() { echo -e "${CYAN}➜${NC} $*"; }
ok()   { echo -e "${GREEN}✔${NC} $*"; log "OK: $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; log "WARN: $*"; }
err()  { echo -e "${RED}✖${NC} $*" >&2; log "ERR: $*"; }
die()  { err "$*"; exit 1; }

pause() { echo; read -r -p "Appuyez sur Entrée pour continuer..." _; }

confirm() {
  local msg="${1:-Confirmer ?}"
  read -r -p "$(echo -e "${YELLOW}${msg} [o/N]${NC} ")" ans
  [[ "${ans:-}" =~ ^[oOyY]$ ]]
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Exécutez ce script en root (sudo)."
}

need_cmd() {
  local name="$1" bin="$2"
  [[ -n "$bin" && -x "$bin" ]] || die "Commande introuvable : $name (installez-la ou définissez CMD_* dans config.env)"
}

# --- DB ----------------------------------------------------------------------
load_db_url() {
  if [[ -n "${DATABASE_URL_OVERRIDE:-}" ]]; then
    DB_URL="$(echo "$DATABASE_URL_OVERRIDE" | sed 's/?.*//')"
    return 0
  fi
  local envf="${APP_DIR}/.env"
  [[ -f "$envf" ]] || die "Fichier .env introuvable : $envf"
  DB_URL="$(grep -E '^DATABASE_URL=' "$envf" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/?.*//')"
  [[ -n "${DB_URL:-}" ]] || die "DATABASE_URL vide dans $envf"
}

current_git_info() {
  if [[ -d "${APP_DIR}/.git" ]]; then
    (cd "$APP_DIR" && echo "branch=$(${GIT_BIN} rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?') commit=$(${GIT_BIN} rev-parse --short HEAD 2>/dev/null || echo '?')")
  else
    echo "branch=n/a commit=n/a"
  fi
}

status_banner() {
  clear
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  TransfoHub — Administration${NC}"
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo -e "  Pack    : ${CYAN}${SCRIPT_DIR}${NC}"
  echo -e "  Config  : ${CYAN}${CONFIG_FILE}${NC}"
  echo -e "  App     : ${CYAN}${APP_DIR}${NC}"
  echo -e "  Port    : ${CYAN}${APP_PORT}${NC}  |  PM2 : ${CYAN}${PM2_NAME}${NC}"
  echo -e "  Backups : ${CYAN}${BACKUP_ROOT}${NC}"
  echo -e "  Git     : $(current_git_info)"
  if [[ -n "$PM2_BIN" ]]; then
    local st
    st="$(${PM2_BIN} jlist 2>/dev/null | python3 -c "
import sys, json
try:
  data=json.load(sys.stdin)
  app=next((a for a in data if a.get('name')=='${PM2_NAME}'), None)
  print(app.get('pm2_env',{}).get('status','absent') if app else 'absent')
except Exception:
  print('inconnu')
" 2>/dev/null || echo '?')"
    if [[ "$st" == "online" ]]; then
      echo -e "  Statut  : ${GREEN}online${NC}"
    else
      echo -e "  Statut  : ${YELLOW}${st}${NC}"
    fi
  fi
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo
}

# --- Stop / Start / Restart --------------------------------------------------
do_stop() {
  info "Arrêt de l'application${STOP_NGINX_ON_STOP:+ et de Nginx}..."
  ${PM2_BIN} stop "$PM2_NAME" 2>/dev/null || warn "PM2 ${PM2_NAME} déjà arrêté ou absent"
  if [[ "${STOP_NGINX_ON_STOP}" =~ ^(yes|YES|true|TRUE|1)$ ]]; then
    systemctl stop "$NGINX_SERVICE" 2>/dev/null || true
  fi
  ok "Arrêt terminé."
}

do_start() {
  info "Démarrage..."
  systemctl start "$NGINX_SERVICE" 2>/dev/null || warn "Impossible de démarrer ${NGINX_SERVICE}"
  if ${PM2_BIN} describe "$PM2_NAME" >/dev/null 2>&1; then
    ${PM2_BIN} start "$PM2_NAME"
  else
    [[ -f "${APP_DIR}/ecosystem.config.cjs" ]] || die "ecosystem.config.cjs manquant dans ${APP_DIR}"
    (cd "$APP_DIR" && ${PM2_BIN} start ecosystem.config.cjs)
  fi
  ${PM2_BIN} save >/dev/null 2>&1 || true
  sleep 2
  curl -s -o /dev/null -w "HTTP local /login → %{http_code}\n" --max-time 10 "http://127.0.0.1:${APP_PORT}/login" || true
  ok "Démarrage terminé."
}

do_restart() {
  info "Redémarrage..."
  systemctl reload "$NGINX_SERVICE" 2>/dev/null || systemctl restart "$NGINX_SERVICE" 2>/dev/null || true
  if ${PM2_BIN} describe "$PM2_NAME" >/dev/null 2>&1; then
    ${PM2_BIN} restart "$PM2_NAME"
  else
    (cd "$APP_DIR" && ${PM2_BIN} start ecosystem.config.cjs)
  fi
  ${PM2_BIN} save >/dev/null 2>&1 || true
  sleep 2
  curl -s -o /dev/null -w "HTTP local /login → %{http_code}\n" --max-time 10 "http://127.0.0.1:${APP_PORT}/login" || true
  ok "Redémarrage terminé."
}

# --- Backups -----------------------------------------------------------------
prune_old_backups() {
  local count
  count="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$count" -gt "$MAX_BACKUPS" ]]; then
    info "Rotation : conservation des ${MAX_BACKUPS} dernières sauvegardes..."
    find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
      | sort -n \
      | head -n "$((count - MAX_BACKUPS))" \
      | awk '{print $2}' \
      | while read -r old; do
          rm -rf "$old"
          warn "Supprimée (rotation) : $old"
        done
  fi
}

create_backup() {
  local reason="${1:-manual}"
  local ts dir
  ts="$(date +%Y%m%d_%H%M%S)"
  dir="${BACKUP_ROOT}/${ts}_${reason}"

  need_cmd pg_dump "$PG_DUMP_BIN"
  need_cmd tar "$TAR_BIN"
  [[ -d "$APP_DIR" ]] || die "APP_DIR introuvable : $APP_DIR"
  mkdir -p "$dir"
  load_db_url

  info "Sauvegarde → ${dir}"
  {
    echo "created_at=$(date -Iseconds)"
    echo "reason=${reason}"
    echo "app_dir=${APP_DIR}"
    echo "git=$(current_git_info)"
    echo "host=$(hostname 2>/dev/null || echo unknown)"
    echo "pack=${SCRIPT_DIR}"
  } > "${dir}/meta.txt"

  cp -a "${APP_DIR}/.env" "${dir}/.env" 2>/dev/null || true
  if [[ -f "${APP_DIR}/config/maintenance-user.json" ]]; then
    mkdir -p "${dir}/config"
    cp -a "${APP_DIR}/config/maintenance-user.json" "${dir}/config/"
  fi

  info "Archive sources (sans node_modules / .git)..."
  ${TAR_BIN} -C "$APP_DIR" \
    --exclude='./node_modules' \
    --exclude='./.git' \
    -czf "${dir}/app-source.tar.gz" .

  if [[ -d "${APP_DIR}/.git" && -n "$GIT_BIN" ]]; then
    (cd "$APP_DIR" && ${GIT_BIN} rev-parse HEAD > "${dir}/git-commit.txt" 2>/dev/null || true)
    (cd "$APP_DIR" && ${GIT_BIN} status -sb > "${dir}/git-status.txt" 2>/dev/null || true)
  fi

  info "Dump PostgreSQL..."
  if ${PG_DUMP_BIN} --clean --if-exists --no-owner --no-acl "$DB_URL" | gzip -c > "${dir}/db.sql.gz"; then
    ok "Dump DB OK ($(du -h "${dir}/db.sql.gz" | awk '{print $1}'))"
  else
    rm -rf "$dir"
    die "Échec pg_dump — opération annulée."
  fi

  touch "${dir}/COMPLETE"
  du -sh "$dir" | awk '{print "Taille totale: "$1}'
  prune_old_backups
  LAST_BACKUP_DIR="$dir"
  ok "Sauvegarde complète : $dir"
}

list_backups() {
  mkdir -p "$BACKUP_ROOT"
  mapfile -t BACKUP_LIST < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d | sort -r)
  if [[ ${#BACKUP_LIST[@]} -eq 0 ]]; then
    warn "Aucune sauvegarde dans ${BACKUP_ROOT}"
    return 1
  fi
  echo -e "${BOLD}Sauvegardes disponibles :${NC}"
  local i=1
  for b in "${BACKUP_LIST[@]}"; do
    local mark meta_git
    [[ -f "${b}/COMPLETE" ]] && mark="${GREEN}OK${NC}" || mark="${RED}incomplet${NC}"
    meta_git=""
    [[ -f "${b}/meta.txt" ]] && meta_git="$(grep '^git=' "${b}/meta.txt" 2>/dev/null | cut -d= -f2-)"
    printf "  %2d) %s  [%b]  %s  %s\n" "$i" "$(basename "$b")" "$mark" "$(du -sh "$b" 2>/dev/null | awk '{print $1}')" "$meta_git"
    i=$((i + 1))
  done
  return 0
}

# --- Build -------------------------------------------------------------------
ensure_ecosystem_port() {
  local eco="${APP_DIR}/ecosystem.config.cjs"
  [[ -f "$eco" ]] || return 0
  sed -i "s/start -p [0-9]\\+/start -p ${APP_PORT}/g" "$eco"
  sed -i "s/PORT: [0-9]\\+/PORT: ${APP_PORT}/g" "$eco"
}

build_and_migrate() {
  need_cmd npm "$NPM_BIN"
  info "npm ci..."
  (cd "$APP_DIR" && ${NPM_BIN} ci)
  info "Prisma generate..."
  (cd "$APP_DIR" && ${NPM_BIN} run db:generate)
  info "Migrations (deploy, pas de seed)..."
  (cd "$APP_DIR" && ${NPM_BIN} run db:migrate)
  info "Build Next.js..."
  (cd "$APP_DIR" && ${NPM_BIN} run build)
  ensure_ecosystem_port
  mkdir -p "${APP_DIR}/logs"
  ok "Build + migrations terminés."
}

pm2_reload_app() {
  need_cmd pm2 "$PM2_BIN"
  systemctl start "$NGINX_SERVICE" 2>/dev/null || systemctl reload "$NGINX_SERVICE" 2>/dev/null || true
  if ${PM2_BIN} describe "$PM2_NAME" >/dev/null 2>&1; then
    ${PM2_BIN} restart "$PM2_NAME" --update-env
  else
    (cd "$APP_DIR" && ${PM2_BIN} start ecosystem.config.cjs)
  fi
  ${PM2_BIN} save >/dev/null 2>&1 || true
  sleep 2
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:${APP_PORT}/login" || echo fail)"
  if [[ "$code" == "200" || "$code" == "307" || "$code" == "302" ]]; then
    ok "Application répond (HTTP ${code})."
  else
    warn "Réponse HTTP ${code} — vérifiez : pm2 logs ${PM2_NAME}"
  fi
}

# --- Deploy Git --------------------------------------------------------------
deploy_from_git() {
  need_cmd git "$GIT_BIN"
  need_cmd npm "$NPM_BIN"
  need_cmd pm2 "$PM2_BIN"
  echo -e "${BOLD}Déploiement depuis Git${NC}"
  local remote branch
  read -r -p "Remote [${GIT_REMOTE}] : " remote
  remote="${remote:-$GIT_REMOTE}"
  read -r -p "Branche [${GIT_BRANCH}] : " branch
  branch="${branch:-$GIT_BRANCH}"

  info "Remote=${remote}  Branche=${branch}"
  info "Une sauvegarde source+DB sera créée avant déploiement."
  confirm "Continuer le déploiement Git ?" || { warn "Annulé."; return 0; }

  create_backup "pre-git-deploy"

  local env_bak maint_bak
  env_bak="$(mktemp)"
  maint_bak="$(mktemp)"
  cp -a "${APP_DIR}/.env" "$env_bak"
  cp -a "${APP_DIR}/config/maintenance-user.json" "$maint_bak" 2>/dev/null || true

  info "git fetch / reset hard ${remote}/${branch}..."
  (
    cd "$APP_DIR"
    ${GIT_BIN} fetch "$remote" "$branch"
    ${GIT_BIN} checkout "$branch"
    ${GIT_BIN} reset --hard "${remote}/${branch}"
  )

  cp -a "$env_bak" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
  mkdir -p "${APP_DIR}/config"
  [[ -s "$maint_bak" ]] && cp -a "$maint_bak" "${APP_DIR}/config/maintenance-user.json"
  rm -f "$env_bak" "$maint_bak"

  build_and_migrate
  pm2_reload_app
  ok "Déploiement Git terminé."
  info "Rollback : option 6 — ${LAST_BACKUP_DIR:-voir ${BACKUP_ROOT}}"
}

# --- Deploy ZIP --------------------------------------------------------------
deploy_from_zip() {
  need_cmd npm "$NPM_BIN"
  need_cmd unzip "$UNZIP_BIN"
  need_cmd rsync "$RSYNC_BIN"
  echo -e "${BOLD}Déploiement depuis un fichier ZIP${NC}"
  echo "  a) Chemin d'un ZIP déjà présent sur le serveur"
  echo "  b) Télécharger l'archive configurée (GITHUB_ZIP_URL)"
  read -r -p "Choix [a/b] : " mode
  local zip_path="" work
  work="$(mktemp -d /tmp/transfohub-zip-XXXXXX)"

  case "${mode:-a}" in
    b|B)
      need_cmd curl "$CURL_BIN"
      local url
      read -r -p "URL ZIP [${GITHUB_ZIP_URL}] : " url
      url="${url:-$GITHUB_ZIP_URL}"
      zip_path="${work}/source.zip"
      info "Téléchargement : $url"
      ${CURL_BIN} -fL --progress-bar -o "$zip_path" "$url" || { rm -rf "$work"; die "Téléchargement échoué"; }
      ;;
    *)
      read -r -p "Chemin absolu du fichier .zip : " zip_path
      [[ -f "$zip_path" ]] || { rm -rf "$work"; die "Fichier introuvable : $zip_path"; }
      ;;
  esac

  confirm "Sauvegarder la version actuelle puis déployer ce ZIP ?" || { rm -rf "$work"; warn "Annulé."; return 0; }

  create_backup "pre-zip-deploy"

  local env_bak maint_bak
  env_bak="$(mktemp)"
  maint_bak="$(mktemp)"
  cp -a "${APP_DIR}/.env" "$env_bak"
  cp -a "${APP_DIR}/config/maintenance-user.json" "$maint_bak" 2>/dev/null || true

  info "Extraction..."
  local extract="${work}/extract"
  mkdir -p "$extract"
  ${UNZIP_BIN} -q "$zip_path" -d "$extract"

  local src
  src="$(find "$extract" -mindepth 1 -maxdepth 1 -type d | head -1)"
  [[ -n "$src" ]] || src="$extract"
  [[ -f "${src}/package.json" ]] || die "package.json introuvable dans le ZIP"

  info "Synchronisation vers ${APP_DIR}..."
  ${RSYNC_BIN} -a --delete \
    --exclude 'node_modules/' \
    --exclude '.env' \
    --exclude 'logs/' \
    --exclude 'public/uploads/' \
    --exclude 'config/maintenance-user.json' \
    "${src}/" "${APP_DIR}/"

  cp -a "$env_bak" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
  mkdir -p "${APP_DIR}/config" "${APP_DIR}/logs" "${APP_DIR}/public/uploads/avatars"
  [[ -s "$maint_bak" ]] && cp -a "$maint_bak" "${APP_DIR}/config/maintenance-user.json"
  rm -f "$env_bak" "$maint_bak"
  rm -rf "$work"

  build_and_migrate
  pm2_reload_app
  ok "Déploiement ZIP terminé."
}

# --- Rollback ----------------------------------------------------------------
do_rollback() {
  need_cmd psql "$PSQL_BIN"
  need_cmd npm "$NPM_BIN"
  need_cmd tar "$TAR_BIN"
  echo -e "${BOLD}${RED}Rollback source + base de données${NC}"
  echo "  • restauration des fichiers applicatifs"
  echo "  • restauration PostgreSQL (dump de la sauvegarde)"
  echo
  list_backups || { pause; return 0; }
  echo
  read -r -p "Numéro de sauvegarde (0 = annuler) : " num
  [[ "$num" =~ ^[0-9]+$ ]] || { warn "Entrée invalide."; return 0; }
  [[ "$num" -eq 0 ]] && { warn "Annulé."; return 0; }
  local idx=$((num - 1))
  [[ "$idx" -ge 0 && "$idx" -lt ${#BACKUP_LIST[@]} ]] || { warn "Hors plage."; return 0; }
  local bak="${BACKUP_LIST[$idx]}"
  [[ -f "${bak}/COMPLETE" ]] || die "Sauvegarde incomplète : $bak"
  [[ -f "${bak}/app-source.tar.gz" && -f "${bak}/db.sql.gz" ]] || die "Fichiers manquants dans $bak"

  echo
  warn "Cible : $bak"
  cat "${bak}/meta.txt" 2>/dev/null || true
  echo
  confirm "CONFIRMER le rollback ? (la DB prod sera remplacée par ce dump)" || { warn "Annulé."; return 0; }

  info "Filet de sécurité (sauvegarde de l'état actuel)..."
  create_backup "pre-rollback" || warn "Sauvegarde pré-rollback en échec"

  load_db_url
  info "Arrêt application..."
  ${PM2_BIN} stop "$PM2_NAME" 2>/dev/null || true

  info "Restauration fichiers..."
  find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} +
  ${TAR_BIN} -xzf "${bak}/app-source.tar.gz" -C "$APP_DIR"
  if [[ -f "${bak}/.env" ]]; then
    cp -a "${bak}/.env" "${APP_DIR}/.env"
    chmod 600 "${APP_DIR}/.env"
  fi
  if [[ -f "${bak}/config/maintenance-user.json" ]]; then
    mkdir -p "${APP_DIR}/config"
    cp -a "${bak}/config/maintenance-user.json" "${APP_DIR}/config/"
  fi

  info "Restauration PostgreSQL..."
  load_db_url
  if gunzip -c "${bak}/db.sql.gz" | ${PSQL_BIN} "$DB_URL" -v ON_ERROR_STOP=1; then
    ok "Base restaurée."
  else
    die "Échec restauration DB. Voir $bak et la sauvegarde pre-rollback."
  fi

  info "npm ci + generate..."
  (cd "$APP_DIR" && ${NPM_BIN} ci)
  (cd "$APP_DIR" && ${NPM_BIN} run db:generate)
  if [[ ! -d "${APP_DIR}/.next" ]]; then
    (cd "$APP_DIR" && ${NPM_BIN} run build)
  fi
  ensure_ecosystem_port
  mkdir -p "${APP_DIR}/logs"
  pm2_reload_app
  ok "Rollback terminé depuis : $bak"
}

# --- Menu --------------------------------------------------------------------
show_menu() {
  status_banner
  echo "  1) Tout arrêter"
  echo "  2) Tout démarrer"
  echo "  3) Tout redémarrer"
  echo "  4) Déployer une nouvelle version (sources Git)"
  echo "  5) Déployer à partir d'un fichier ZIP"
  echo "  6) Rollback à une ancienne version (source + DB)"
  echo "  7) Créer une sauvegarde manuelle (source + DB)"
  echo "  8) Lister les sauvegardes"
  echo "  0) Quitter"
  echo
  read -r -p "Votre choix : " choice
  case "${choice:-}" in
    1) do_stop; pause ;;
    2) do_start; pause ;;
    3) do_restart; pause ;;
    4) deploy_from_git; pause ;;
    5) deploy_from_zip; pause ;;
    6) do_rollback; pause ;;
    7) create_backup "manual"; pause ;;
    8) list_backups || true; pause ;;
    0) echo "Au revoir."; exit 0 ;;
    *) warn "Choix invalide."; pause ;;
  esac
}

main() {
  require_root
  mkdir -p "$BACKUP_ROOT"
  touch "$LOG_FILE"
  if [[ "${1:-}" == "--backup-only" ]]; then
    create_backup "cli"
    exit 0
  fi
  if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    echo "Usage: $0 [--backup-only]"
    echo "Config: $CONFIG_FILE"
    exit 0
  fi
  while true; do
    show_menu
  done
}

main "$@"
