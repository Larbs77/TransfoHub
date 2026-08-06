#!/bin/bash
# =============================================================================
# TransfoHub — menu d'administration PRODUCTION (banque)
# Modèle : script cloud /root/scripts/transfohub-admin.sh (analysé le 2026-08-06)
#
# Emplacement recommandé :
#   /root/scripts/transfohub-prod/transfohub-admin.sh
#   + config.env à côté
# Raccourci :
#   /root/scripts/menu-prod.sh → ce script
#
# Usage :
#   /root/scripts/menu-prod.sh
#   /root/scripts/menu-prod.sh --backup-only
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

# Defaults (si absents du config)
APP_DIR="${APP_DIR:-/var/www/transfohub}"
PM2_NAME="${PM2_NAME:-transfohub}"
APP_PORT="${APP_PORT:-7000}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/backups/transfohub-prod}"
MAX_BACKUPS="${MAX_BACKUPS:-15}"
GIT_REMOTE_DEFAULT="${GIT_REMOTE_DEFAULT:-origin}"
GIT_BRANCH_DEFAULT="${GIT_BRANCH_DEFAULT:-main}"
GITHUB_ZIP_DEFAULT="${GITHUB_ZIP_DEFAULT:-https://github.com/Larbs77/TransfoHub/archive/refs/heads/main.zip}"
LOG_FILE="${LOG_FILE:-${SCRIPT_DIR}/transfohub-prod-admin.log}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
STOP_NGINX_ON_STOP="${STOP_NGINX_ON_STOP:-no}"
PM2_USER="${PM2_USER:-}"
PUBLIC_HOST="${PUBLIC_HOST:-}"
PUBLIC_URL="${PUBLIC_URL:-}"
RELEASES_DIR="${RELEASES_DIR:-${SCRIPT_DIR}/releases}"

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

# --- Résolution node/npm/pm2 (PATH root vs user banque) -----------------------
expand_tool_path() {
  local dir home
  for dir in /usr/local/bin /usr/bin /bin /opt/nodejs/bin; do
    [[ -d "$dir" ]] && PATH="${dir}:${PATH}"
  done
  if [[ -n "${PM2_USER}" && "${PM2_USER}" != "root" ]]; then
    home="$(getent passwd "$PM2_USER" 2>/dev/null | cut -d: -f6 || echo "/home/${PM2_USER}")"
  elif [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    home="$(getent passwd "$SUDO_USER" 2>/dev/null | cut -d: -f6 || echo "/home/${SUDO_USER}")"
  else
    home=""
  fi
  if [[ -n "$home" ]]; then
    for dir in "${home}/.local/bin" "${home}/.npm-global/bin" "${home}/bin"; do
      [[ -d "$dir" ]] && PATH="${dir}:${PATH}"
    done
    # shellcheck disable=SC2086
    for dir in "${home}/.nvm/versions/node/"*/bin; do
      [[ -d "$dir" ]] && PATH="${dir}:${PATH}"
    done
  fi
  # shellcheck disable=SC2086
  for dir in /root/.nvm/versions/node/*/bin; do
    [[ -d "$dir" ]] && PATH="${dir}:${PATH}"
  done
  export PATH
}

find_bin() {
  local name="$1" c
  [[ -n "${!2:-}" && -x "${!2}" ]] && { echo "${!2}"; return 0; } 2>/dev/null || true
  case "$name" in
    pm2)  [[ -n "${CMD_PM2:-}" && -x "$CMD_PM2" ]] && { echo "$CMD_PM2"; return 0; } ;;
    npm)  [[ -n "${CMD_NPM:-}" && -x "$CMD_NPM" ]] && { echo "$CMD_NPM"; return 0; } ;;
    node) [[ -n "${CMD_NODE:-}" && -x "$CMD_NODE" ]] && { echo "$CMD_NODE"; return 0; } ;;
  esac
  c="$(command -v "$name" 2>/dev/null || true)"
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
    info "pm2 absent du PATH — npm install -g pm2..."
    "$NPM_BIN" install -g pm2
    expand_tool_path
    PM2_BIN="$(find_bin pm2 || true)"
  fi
  [[ -n "$NPM_BIN" ]] || die "npm introuvable"
  [[ -n "$PM2_BIN" ]] || die "pm2 introuvable — installez-le pour root ou définissez CMD_PM2 / PM2_USER"
}

# PM2 sous le bon utilisateur (évite ~/.pm2 root vs admin)
run_pm2() {
  resolve_tools
  local user="${PM2_USER:-}"
  if [[ -z "$user" && -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    user="$SUDO_USER"
  fi
  if [[ -n "$user" && "$user" != "root" ]]; then
    local home
    home="$(getent passwd "$user" 2>/dev/null | cut -d: -f6 || echo "/home/${user}")"
    sudo -u "$user" -H env "PATH=${PATH}" "HOME=${home}" "$PM2_BIN" "$@"
  else
    "$PM2_BIN" "$@"
  fi
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
    echo "branch=n/a commit=n/a (pas de dépôt git)"
  fi
}

status_banner() {
  clear
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  TransfoHub — Administration PRODUCTION (banque)${NC}"
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  [[ -n "$PUBLIC_URL" ]] && echo -e "  URL     : ${CYAN}${PUBLIC_URL}${NC}"
  echo -e "  Env     : ${CYAN}${ENV_NAME:-production}${NC}"
  echo -e "  App     : ${CYAN}${APP_DIR}${NC}"
  echo -e "  Port    : ${CYAN}${APP_PORT}${NC}  |  PM2 : ${CYAN}${PM2_NAME}${NC}"
  echo -e "  Git     : $(current_git_info)"
  echo -e "  Backups : ${CYAN}${BACKUP_ROOT}${NC}"
  if resolve_tools 2>/dev/null; then
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
  fi
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo
}

# --- Stop / Start / Restart --------------------------------------------------
do_stop() {
  info "Arrêt de l'application..."
  run_pm2 stop "$PM2_NAME" 2>/dev/null || warn "PM2 ${PM2_NAME} déjà arrêté ou absent"
  if [[ "${STOP_NGINX_ON_STOP}" =~ ^(yes|YES|true|TRUE|1)$ ]]; then
    systemctl stop "$NGINX_SERVICE" 2>/dev/null || true
    ok "Arrêt PM2 + Nginx."
  else
    ok "Arrêt PM2 (Nginx laissé actif — STOP_NGINX_ON_STOP=no)."
  fi
}

do_start() {
  info "Démarrage..."
  systemctl start "$NGINX_SERVICE" 2>/dev/null || warn "Nginx non démarré"
  if run_pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    run_pm2 start "$PM2_NAME"
  else
    [[ -f "${APP_DIR}/ecosystem.config.cjs" ]] || die "ecosystem.config.cjs manquant"
    ensure_ecosystem_port
    (cd "$APP_DIR" && run_pm2 start ecosystem.config.cjs)
  fi
  run_pm2 save >/dev/null 2>&1 || true
  sleep 2
  curl -s -o /dev/null -w "HTTP local /login → %{http_code}\n" --max-time 10 "http://127.0.0.1:${APP_PORT}/login" || true
  ok "Démarrage terminé."
}

do_restart() {
  info "Redémarrage..."
  systemctl reload "$NGINX_SERVICE" 2>/dev/null || systemctl restart "$NGINX_SERVICE" 2>/dev/null || true
  if run_pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    run_pm2 restart "$PM2_NAME"
  else
    (cd "$APP_DIR" && run_pm2 start ecosystem.config.cjs)
  fi
  run_pm2 save >/dev/null 2>&1 || true
  sleep 2
  curl -s -o /dev/null -w "HTTP local /login → %{http_code}\n" --max-time 10 "http://127.0.0.1:${APP_PORT}/login" || true
  ok "Redémarrage terminé."
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
    echo "env=${ENV_NAME:-production}"
    echo "public_host=${PUBLIC_HOST:-}"
    echo "git=$(current_git_info)"
    echo "host=$(hostname)"
  } > "${dir}/meta.txt"

  cp -a "${APP_DIR}/.env" "${dir}/.env" 2>/dev/null || true
  if [[ -f "${APP_DIR}/config/maintenance-user.json" ]]; then
    mkdir -p "${dir}/config"
    cp -a "${APP_DIR}/config/maintenance-user.json" "${dir}/config/"
  fi

  info "Archive des sources (sans node_modules)..."
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
    warn "pg_dump introuvable — backup sans dump DB"
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
  systemctl start "$NGINX_SERVICE" 2>/dev/null || systemctl reload "$NGINX_SERVICE" 2>/dev/null || true
  sleep 2
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:${APP_PORT}/login" || echo fail)"
  if [[ "$code" =~ ^(200|302|307)$ ]]; then
    ok "Application répond (HTTP ${code})."
  else
    warn "Réponse HTTP ${code} — vérifiez : pm2 logs ${PM2_NAME} (user=${PM2_USER:-root})"
    run_pm2 list || true
  fi
}

# --- Déploiements ------------------------------------------------------------
deploy_from_git() {
  echo -e "${BOLD}Déploiement depuis Git (PRODUCTION)${NC}"
  local remote branch
  read -r -p "Remote [${GIT_REMOTE_DEFAULT}] : " remote
  remote="${remote:-$GIT_REMOTE_DEFAULT}"
  read -r -p "Branche [${GIT_BRANCH_DEFAULT}] : " branch
  branch="${branch:-$GIT_BRANCH_DEFAULT}"

  echo
  info "Remote=${remote}  Branche=${branch}"
  warn "Une sauvegarde source+DB sera créée AVANT le déploiement."
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
  echo "  a) ZIP déjà sur le serveur (recommandé banque)"
  echo "  b) Télécharger depuis GitHub (si réseau autorisé)"
  echo "  c) Choisir dans ${RELEASES_DIR}/"
  read -r -p "Choix [a/b/c] : " mode
  local zip_path=""
  local work
  work="$(mktemp -d /tmp/transfohub-zip-XXXXXX)"

  case "${mode:-a}" in
    b|B)
      local url
      read -r -p "URL ZIP [${GITHUB_ZIP_DEFAULT}] : " url
      url="${url:-$GITHUB_ZIP_DEFAULT}"
      zip_path="${work}/source.zip"
      info "Téléchargement : $url"
      curl -fL --progress-bar -o "$zip_path" "$url" || { rm -rf "$work"; die "Téléchargement échoué"; }
      ;;
    c|C)
      mkdir -p "$RELEASES_DIR"
      mapfile -t ZIPS < <(find "$RELEASES_DIR" -maxdepth 1 -type f -name '*.zip' | sort)
      if [[ ${#ZIPS[@]} -eq 0 ]]; then
        rm -rf "$work"
        die "Aucun ZIP dans ${RELEASES_DIR}"
      fi
      local i=1
      for z in "${ZIPS[@]}"; do
        printf "  %2d) %s\n" "$i" "$(basename "$z")"
        i=$((i + 1))
      done
      read -r -p "Numéro : " num
      zip_path="${ZIPS[$((num - 1))]}"
      [[ -f "$zip_path" ]] || { rm -rf "$work"; die "Sélection invalide"; }
      ;;
    *)
      read -r -p "Chemin absolu du fichier .zip : " zip_path
      [[ -f "$zip_path" ]] || { rm -rf "$work"; die "Fichier introuvable : $zip_path"; }
      ;;
  esac

  confirm "Sauvegarder la version actuelle puis déployer ce ZIP en PRODUCTION ?" || { rm -rf "$work"; warn "Annulé."; return 0; }

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
    die "rsync requis pour le déploiement ZIP"
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
  echo "Ceci va restaurer fichiers + PostgreSQL depuis une sauvegarde."
  echo
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

  info "Filet de sécurité (backup état actuel)..."
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
  if gunzip -c "${bak}/db.sql.gz" | psql "$DB_URL" -v ON_ERROR_STOP=1; then
    ok "Base restaurée."
  else
    die "Échec restauration DB — voir ${bak} et pre-rollback"
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
  if [[ "${APP_DIR}" == *REMPLACER* ]]; then
    die "Éditez config.env : renseignez APP_DIR (chemin réel de la prod banque)"
  fi
  mkdir -p "$BACKUP_ROOT" "$(dirname "$LOG_FILE")" "$RELEASES_DIR"
  touch "$LOG_FILE"
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
