#!/bin/bash
# =============================================================================
# TransfoHub — menu d'administration PRODUCTION (banque)
# Exécution : utilisateur applicatif (admin_keba) — PAS besoin de root
# Pas d'actions Nginx (géré hors de ce script)
#
# Usage :
#   ./transfohub-admin.sh
#   ./transfohub-admin.sh --backup-only
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.env"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERREUR: config.env introuvable : $CONFIG_FILE" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$CONFIG_FILE"

# Defaults
APP_DIR="${APP_DIR:-$HOME/workspace/Transfohub-main}"
PM2_NAME="${PM2_NAME:-transfohub}"
APP_PORT="${APP_PORT:-8000}"
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/backups}"
MAX_BACKUPS="${MAX_BACKUPS:-15}"
GIT_REMOTE_DEFAULT="${GIT_REMOTE_DEFAULT:-origin}"
GIT_BRANCH_DEFAULT="${GIT_BRANCH_DEFAULT:-main}"
GITHUB_ZIP_DEFAULT="${GITHUB_ZIP_DEFAULT:-https://github.com/Larbs77/TransfoHub/archive/refs/heads/main.zip}"
LOG_FILE="${LOG_FILE:-${BACKUP_ROOT}/transfohub-prod-admin.log}"
PUBLIC_HOST="${PUBLIC_HOST:-transfohub.eurafric.com}"
PUBLIC_URL="${PUBLIC_URL:-https://transfohub.eurafric.com}"
ENV_NAME="${ENV_NAME:-production}"
RELEASES_DIR="${RELEASES_DIR:-${SCRIPT_DIR}/releases}"

# --- Couleurs ----------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true; echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
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

# Pas de root requis — refuser root pour éviter le mauvais ~/.pm2
refuse_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    die "N'exécutez PAS ce script en root. Connectez-vous en admin_keba (ou l'user PM2) puis : ./transfohub-admin.sh"
  fi
}

# --- PATH node/npm/pm2 (nvm, etc.) -------------------------------------------
expand_tool_path() {
  local dir
  for dir in /usr/local/bin /usr/bin /bin "$HOME/.local/bin" "$HOME/.npm-global/bin" "$HOME/bin"; do
    [[ -d "$dir" ]] && PATH="${dir}:${PATH}"
  done
  # shellcheck disable=SC2086
  for dir in "$HOME/.nvm/versions/node/"*/bin; do
    [[ -d "$dir" ]] && PATH="${dir}:${PATH}"
  done
  # shellcheck disable=SC2086
  for dir in "$HOME/.local/share/fnm/node-versions/"*/installation/bin; do
    [[ -d "$dir" ]] && PATH="${dir}:${PATH}"
  done
  export PATH
  export PM2_HOME="${PM2_HOME:-$HOME/.pm2}"
}

find_bin() {
  local name="$1"
  case "$name" in
    pm2)  [[ -n "${CMD_PM2:-}" && -x "$CMD_PM2" ]] && { echo "$CMD_PM2"; return 0; } ;;
    npm)  [[ -n "${CMD_NPM:-}" && -x "$CMD_NPM" ]] && { echo "$CMD_NPM"; return 0; } ;;
    node) [[ -n "${CMD_NODE:-}" && -x "$CMD_NODE" ]] && { echo "$CMD_NODE"; return 0; } ;;
  esac
  local c
  c="$(command -v "$name" 2>/dev/null || true)"
  [[ -n "$c" && -x "$c" ]] && { echo "$c"; return 0; }
  # recherche limitée sous $HOME
  c="$(find "$HOME" -maxdepth 6 -type f -name "$name" 2>/dev/null | grep -E '/bin/'"$name"'$' | head -1 || true)"
  [[ -n "$c" && -x "$c" ]] && { echo "$c"; return 0; }
  return 1
}

PM2_BIN=""
NPM_BIN=""
NODE_BIN=""

resolve_tools() {
  expand_tool_path
  NODE_BIN="$(find_bin node || true)"
  NPM_BIN="$(find_bin npm || true)"
  PM2_BIN="$(find_bin pm2 || true)"

  if [[ -z "$PM2_BIN" && -n "$NPM_BIN" ]]; then
    info "pm2 introuvable — installation dans le préfixe npm de l'utilisateur..."
    "$NPM_BIN" install -g pm2
    expand_tool_path
    PM2_BIN="$(find_bin pm2 || true)"
    if [[ -z "$PM2_BIN" ]]; then
      local prefix
      prefix="$("$NPM_BIN" config get prefix 2>/dev/null || true)"
      [[ -x "${prefix}/bin/pm2" ]] && PM2_BIN="${prefix}/bin/pm2"
    fi
  fi

  [[ -n "$NODE_BIN" ]] || die "node introuvable (nvm chargé ?)"
  [[ -n "$NPM_BIN" ]] || die "npm introuvable"
  [[ -n "$PM2_BIN" ]] || die "pm2 introuvable. Installez : npm install -g pm2"

  ok "node=$NODE_BIN | npm=$NPM_BIN | pm2=$PM2_BIN | PM2_HOME=$PM2_HOME"
}

run_pm2() {
  resolve_tools
  "$PM2_BIN" "$@"
}

run_npm() {
  resolve_tools
  (cd "$APP_DIR" && "$NPM_BIN" "$@")
}

# --- Helpers app / DB --------------------------------------------------------
load_db_url() {
  local envf="${APP_DIR}/.env"
  [[ -f "$envf" ]] || die "Fichier .env introuvable : $envf"
  DB_URL="$(grep -E '^DATABASE_URL=' "$envf" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/?.*//')"
  [[ -n "${DB_URL:-}" ]] || die "DATABASE_URL vide dans .env"
}

current_git_info() {
  if [[ -d "${APP_DIR}/.git" ]]; then
    (cd "$APP_DIR" && echo "branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?') commit=$(git rev-parse --short HEAD 2>/dev/null || echo '?')")
  else
    echo "branch=n/a commit=n/a"
  fi
}

status_banner() {
  clear
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  TransfoHub — Admin PRODUCTION (user: $(whoami))${NC}"
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo -e "  URL     : ${CYAN}${PUBLIC_URL}${NC}"
  echo -e "  Env     : ${CYAN}${ENV_NAME}${NC}"
  echo -e "  App     : ${CYAN}${APP_DIR}${NC}"
  echo -e "  Port    : ${CYAN}${APP_PORT}${NC}  |  PM2 : ${CYAN}${PM2_NAME}${NC}"
  echo -e "  Git     : $(current_git_info)"
  echo -e "  Backups : ${CYAN}${BACKUP_ROOT}${NC}"
  echo -e "  Releases: ${CYAN}${RELEASES_DIR}${NC}"
  local st
  st="$(run_pm2 jlist 2>/dev/null | python3 -c "
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
  echo -e "  ${YELLOW}Nginx non géré par ce script (ops séparée)${NC}"
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo
}

# --- Stop / Start / Restart (PM2 uniquement) ---------------------------------
do_stop() {
  info "Arrêt PM2 ${PM2_NAME}..."
  run_pm2 stop "$PM2_NAME" 2>/dev/null || warn "PM2 ${PM2_NAME} déjà arrêté ou absent"
  ok "Application arrêtée (Nginx non touché)."
}

do_start() {
  info "Démarrage PM2 ${PM2_NAME}..."
  ensure_ecosystem_port
  if run_pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    run_pm2 start "$PM2_NAME"
  else
    [[ -f "${APP_DIR}/ecosystem.config.cjs" ]] || die "ecosystem.config.cjs manquant dans ${APP_DIR}"
    (cd "$APP_DIR" && run_pm2 start ecosystem.config.cjs) \
      || (cd "$APP_DIR" && run_pm2 start node_modules/next/dist/bin/next --name "$PM2_NAME" -- start -p "$APP_PORT")
  fi
  run_pm2 save >/dev/null 2>&1 || true
  sleep 2
  curl -s -o /dev/null -w "HTTP local /login → %{http_code}\n" --max-time 10 "http://127.0.0.1:${APP_PORT}/login" || true
  ok "Application démarrée (Nginx non touché)."
}

do_restart() {
  info "Redémarrage PM2 ${PM2_NAME}..."
  ensure_ecosystem_port
  if run_pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    run_pm2 restart "$PM2_NAME" --update-env
  else
    do_start
    return 0
  fi
  run_pm2 save >/dev/null 2>&1 || true
  sleep 2
  curl -s -o /dev/null -w "HTTP local /login → %{http_code}\n" --max-time 10 "http://127.0.0.1:${APP_PORT}/login" || true
  ok "Application redémarrée (Nginx non touché)."
}

# --- Backups -----------------------------------------------------------------
prune_old_backups() {
  local count
  count="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$count" -gt "$MAX_BACKUPS" ]]; then
    info "Rotation : conservation des ${MAX_BACKUPS} dernières..."
    find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' 2>/dev/null \
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

  [[ -d "$APP_DIR" ]] || die "Répertoire appli absent : $APP_DIR"
  mkdir -p "$dir"
  load_db_url

  info "Sauvegarde → ${dir}"
  {
    echo "created_at=$(date -Iseconds)"
    echo "reason=${reason}"
    echo "app_dir=${APP_DIR}"
    echo "env=${ENV_NAME}"
    echo "public_host=${PUBLIC_HOST}"
    echo "user=$(whoami)"
    echo "git=$(current_git_info)"
    echo "host=$(hostname)"
  } > "${dir}/meta.txt"

  cp -a "${APP_DIR}/.env" "${dir}/.env" 2>/dev/null || true
  if [[ -f "${APP_DIR}/config/maintenance-user.json" ]]; then
    mkdir -p "${dir}/config"
    cp -a "${APP_DIR}/config/maintenance-user.json" "${dir}/config/"
  fi

  info "Archive des sources..."
  tar -C "$APP_DIR" \
    --exclude='./node_modules' \
    --exclude='./.git' \
    --exclude='./.next' \
    -czf "${dir}/app-source.tar.gz" .

  if [[ -d "${APP_DIR}/.git" ]]; then
    (cd "$APP_DIR" && git rev-parse HEAD > "${dir}/git-commit.txt" 2>/dev/null || true)
    (cd "$APP_DIR" && git status -sb > "${dir}/git-status.txt" 2>/dev/null || true)
  fi

  info "Dump PostgreSQL..."
  if command -v pg_dump >/dev/null 2>&1; then
    if pg_dump --clean --if-exists --no-owner --no-acl "$DB_URL" | gzip -c > "${dir}/db.sql.gz"; then
      ok "Dump DB OK ($(du -h "${dir}/db.sql.gz" | awk '{print $1}'))"
    else
      rm -rf "$dir"
      die "Échec pg_dump — opération annulée."
    fi
  else
    warn "pg_dump introuvable dans le PATH — backup sans dump DB"
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
  sed -i -E "s/name:[[:space:]]*['\"][^'\"]+['\"]/name: \"${PM2_NAME}\"/" "$eco" || true
  sed -i "s/start -p [0-9]\+/start -p ${APP_PORT}/g" "$eco" || true
  sed -i "s/PORT: [0-9]\+/PORT: ${APP_PORT}/g" "$eco" || true
}

build_and_migrate() {
  resolve_tools
  info "npm ci..."
  run_npm ci
  info "Prisma generate..."
  run_npm run db:generate
  info "Migrations (deploy, PAS de seed)..."
  run_npm run db:migrate
  info "Build Next.js..."
  run_npm run build
  ensure_ecosystem_port
  mkdir -p "${APP_DIR}/logs"
  ok "Build + migrations terminés."
}

pm2_reload_app() {
  ensure_ecosystem_port
  if run_pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    run_pm2 restart "$PM2_NAME" --update-env
  else
    (cd "$APP_DIR" && run_pm2 start ecosystem.config.cjs) \
      || (cd "$APP_DIR" && run_pm2 start node_modules/next/dist/bin/next --name "$PM2_NAME" -- start -p "$APP_PORT")
  fi
  run_pm2 save >/dev/null 2>&1 || true
  sleep 2
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:${APP_PORT}/login" || echo fail)"
  if [[ "$code" =~ ^(200|302|307)$ ]]; then
    ok "Application répond (HTTP ${code})."
  else
    warn "Réponse HTTP ${code} — pm2 logs ${PM2_NAME}"
    run_pm2 list || true
  fi
}

# --- Déploiements ------------------------------------------------------------
deploy_from_git() {
  echo -e "${BOLD}Déploiement depuis Git (PRODUCTION)${NC}"
  [[ -d "${APP_DIR}/.git" ]] || die "Pas de dépôt git dans ${APP_DIR} — utilisez l'option ZIP"
  local remote branch
  read -r -p "Remote [${GIT_REMOTE_DEFAULT}] : " remote
  remote="${remote:-$GIT_REMOTE_DEFAULT}"
  read -r -p "Branche [${GIT_BRANCH_DEFAULT}] : " branch
  branch="${branch:-$GIT_BRANCH_DEFAULT}"

  echo
  info "Remote=${remote}  Branche=${branch}"
  warn "Sauvegarde source+DB avant déploiement."
  confirm "CONFIRMER le déploiement Git en PRODUCTION ?" || { warn "Annulé."; return 0; }

  create_backup "pre-git-deploy"

  local env_bak maint_bak
  env_bak="$(mktemp)"
  maint_bak="$(mktemp)"
  cp -a "${APP_DIR}/.env" "$env_bak"
  cp -a "${APP_DIR}/config/maintenance-user.json" "$maint_bak" 2>/dev/null || true

  info "git fetch / reset hard sur ${remote}/${branch}..."
  (
    cd "$APP_DIR"
    git fetch "$remote" "$branch"
    git checkout "$branch"
    git reset --hard "${remote}/${branch}"
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

deploy_from_zip() {
  echo -e "${BOLD}Déploiement depuis ZIP (PRODUCTION)${NC}"
  echo "  a) Chemin d'un ZIP sur le serveur"
  echo "  b) Choisir dans ${RELEASES_DIR}/"
  echo "  c) Télécharger GitHub (si réseau autorisé)"
  read -r -p "Choix [a/b/c] : " mode
  local zip_path=""
  local work
  work="$(mktemp -d "${TMPDIR:-/tmp}/transfohub-zip-XXXXXX")"

  case "${mode:-b}" in
    c|C)
      local url
      read -r -p "URL ZIP [${GITHUB_ZIP_DEFAULT}] : " url
      url="${url:-$GITHUB_ZIP_DEFAULT}"
      zip_path="${work}/source.zip"
      info "Téléchargement : $url"
      curl -fL --progress-bar -o "$zip_path" "$url" || { rm -rf "$work"; die "Téléchargement échoué"; }
      ;;
    a|A)
      read -r -p "Chemin absolu du fichier .zip : " zip_path
      [[ -f "$zip_path" ]] || { rm -rf "$work"; die "Fichier introuvable : $zip_path"; }
      ;;
    *)
      mkdir -p "$RELEASES_DIR"
      mapfile -t ZIPS < <(find "$RELEASES_DIR" -maxdepth 1 -type f -name '*.zip' | sort)
      if [[ ${#ZIPS[@]} -eq 0 ]]; then
        rm -rf "$work"
        die "Aucun ZIP dans ${RELEASES_DIR} — déposez TransfoHub-main.zip puis relancez"
      fi
      local i=1
      for z in "${ZIPS[@]}"; do
        printf "  %2d) %s  (%s)\n" "$i" "$(basename "$z")" "$(du -h "$z" | awk '{print $1}')"
        i=$((i + 1))
      done
      read -r -p "Numéro [1] : " num
      num="${num:-1}"
      zip_path="${ZIPS[$((num - 1))]}"
      [[ -f "$zip_path" ]] || { rm -rf "$work"; die "Sélection invalide"; }
      ;;
  esac

  confirm "Sauvegarder puis déployer ce ZIP en PRODUCTION ?" || { rm -rf "$work"; warn "Annulé."; return 0; }

  create_backup "pre-zip-deploy"

  local env_bak maint_bak
  env_bak="$(mktemp)"
  maint_bak="$(mktemp)"
  cp -a "${APP_DIR}/.env" "$env_bak"
  cp -a "${APP_DIR}/config/maintenance-user.json" "$maint_bak" 2>/dev/null || true

  info "Extraction du ZIP..."
  local extract="${work}/extract"
  mkdir -p "$extract"
  unzip -q "$zip_path" -d "$extract"

  local src
  src="$(find "$extract" -mindepth 1 -maxdepth 1 -type d | head -1)"
  [[ -z "$src" ]] && src="$extract"
  [[ -f "${src}/package.json" ]] || die "package.json introuvable dans le ZIP"

  info "Synchronisation vers ${APP_DIR} (préserve .env / uploads)..."
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude 'node_modules/' \
      --exclude '.env' \
      --exclude 'logs/' \
      --exclude 'public/uploads/' \
      --exclude 'config/maintenance-user.json' \
      "${src}/" "${APP_DIR}/"
  else
    die "rsync requis (yum/apt install rsync)"
  fi

  cp -a "$env_bak" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
  mkdir -p "${APP_DIR}/config" "${APP_DIR}/logs" "${APP_DIR}/public/uploads/avatars"
  [[ -s "$maint_bak" ]] && cp -a "$maint_bak" "${APP_DIR}/config/maintenance-user.json"
  rm -f "$env_bak" "$maint_bak"
  rm -rf "$work"

  build_and_migrate
  pm2_reload_app
  ok "Déploiement ZIP terminé."
  info "Rollback possible via option 6."
}

# --- Rollback ----------------------------------------------------------------
do_rollback() {
  echo -e "${BOLD}${RED}Rollback PRODUCTION — source + base de données${NC}"
  list_backups || { pause; return 0; }
  echo
  read -r -p "Numéro de sauvegarde (0 = annuler) : " num
  [[ "$num" =~ ^[0-9]+$ ]] || { warn "Entrée invalide."; return 0; }
  [[ "$num" -eq 0 ]] && { warn "Annulé."; return 0; }
  local idx=$((num - 1))
  [[ "$idx" -ge 0 && "$idx" -lt ${#BACKUP_LIST[@]} ]] || { warn "Hors plage."; return 0; }
  local bak="${BACKUP_LIST[$idx]}"
  [[ -f "${bak}/COMPLETE" ]] || die "Sauvegarde incomplète"
  [[ -f "${bak}/app-source.tar.gz" ]] || die "Archive source manquante"
  [[ -f "${bak}/db.sql.gz" ]] || die "Dump DB manquant"

  echo
  warn "Cible : $bak"
  cat "${bak}/meta.txt" 2>/dev/null || true
  echo
  confirm "CONFIRMER le rollback PRODUCTION ? (la DB sera écrasée)" || { warn "Annulé."; return 0; }

  info "Filet de sécurité..."
  create_backup "pre-rollback" || warn "Sauvegarde pré-rollback en échec"

  load_db_url
  info "Arrêt application..."
  run_pm2 stop "$PM2_NAME" 2>/dev/null || true

  info "Restauration fichiers..."
  find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} +
  tar -xzf "${bak}/app-source.tar.gz" -C "$APP_DIR"
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
  if ! command -v psql >/dev/null 2>&1; then
    die "psql introuvable — impossible de restaurer la DB"
  fi
  if gunzip -c "${bak}/db.sql.gz" | psql "$DB_URL" -v ON_ERROR_STOP=1; then
    ok "Base restaurée."
  else
    die "Échec restauration DB — voir ${bak}"
  fi

  resolve_tools
  run_npm ci
  run_npm run db:generate
  if [[ ! -d "${APP_DIR}/.next" ]]; then
    run_npm run build
  fi
  ensure_ecosystem_port
  mkdir -p "${APP_DIR}/logs"
  pm2_reload_app
  ok "Rollback terminé depuis : $bak"
}

# --- Menu --------------------------------------------------------------------
show_menu() {
  status_banner
  echo "  1) Arrêter l'application (PM2)"
  echo "  2) Démarrer l'application (PM2)"
  echo "  3) Redémarrer l'application (PM2)"
  echo "  4) Déployer une nouvelle version (Git)"
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
  refuse_root
  mkdir -p "$BACKUP_ROOT" "$RELEASES_DIR"
  touch "$LOG_FILE" 2>/dev/null || LOG_FILE="${SCRIPT_DIR}/transfohub-prod-admin.log"
  resolve_tools

  if [[ "${1:-}" == "--backup-only" ]]; then
    create_backup "cli"
    exit 0
  fi
  while true; do
    show_menu
  done
}

main "$@"
