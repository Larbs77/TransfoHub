#!/bin/bash
# =============================================================================
# TransfoHub — menu d'administration (prod)
# Emplacement : /root/scripts/transfohub-admin.sh
# Usage       : /root/scripts/transfohub-admin.sh
# =============================================================================
set -euo pipefail

# --- Configuration -----------------------------------------------------------
APP_DIR="/var/www/transfohub"
PM2_NAME="transfohub"
APP_PORT="7000"
BACKUP_ROOT="/root/backups/transfohub"
MAX_BACKUPS="10"
GIT_REMOTE_DEFAULT="origin"
GIT_BRANCH_DEFAULT="main"
GITHUB_ZIP_DEFAULT="https://github.com/Larbs77/TransfoHub/archive/refs/heads/main.zip"
LOG_FILE="/root/scripts/transfohub-admin.log"

# --- Couleurs / UI -----------------------------------------------------------
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
  [[ "$(id -u)" -eq 0 ]] || die "Exécutez ce script en root."
}

# --- Helpers app / DB --------------------------------------------------------
load_db_url() {
  local envf="${APP_DIR}/.env"
  [[ -f "$envf" ]] || die "Fichier .env introuvable : $envf"
  # shellcheck disable=SC1090
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
  echo -e "${BOLD}  TransfoHub — Administration serveur${NC}"
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo -e "  App     : ${CYAN}${APP_DIR}${NC}"
  echo -e "  Port    : ${CYAN}${APP_PORT}${NC}  |  PM2 : ${CYAN}${PM2_NAME}${NC}"
  echo -e "  Git     : $(current_git_info)"
  if command -v pm2 >/dev/null 2>&1; then
    local st
    st="$(pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
  data=json.load(sys.stdin)
  app=next((a for a in data if a.get('name')=='${PM2_NAME}'), None)
  if not app: print('absent')
  else: print(app.get('pm2_env',{}).get('status','?'))
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

# --- Actions stop / start / restart ------------------------------------------
do_stop() {
  info "Arrêt de l'application et de Nginx..."
  pm2 stop "$PM2_NAME" 2>/dev/null || warn "PM2 ${PM2_NAME} déjà arrêté ou absent"
  systemctl stop nginx 2>/dev/null || true
  ok "Tout est arrêté (PM2 + Nginx)."
}

do_start() {
  info "Démarrage de Nginx et de l'application..."
  systemctl start nginx
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 start "$PM2_NAME"
  else
    [[ -f "${APP_DIR}/ecosystem.config.cjs" ]] || die "ecosystem.config.cjs manquant"
    (cd "$APP_DIR" && pm2 start ecosystem.config.cjs)
  fi
  pm2 save >/dev/null
  sleep 2
  curl -s -o /dev/null -w "HTTP local /login → %{http_code}\n" --max-time 10 "http://127.0.0.1:${APP_PORT}/login" || true
  ok "Tout est démarré."
}

do_restart() {
  info "Redémarrage..."
  systemctl reload nginx 2>/dev/null || systemctl restart nginx
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_NAME"
  else
    (cd "$APP_DIR" && pm2 start ecosystem.config.cjs)
  fi
  pm2 save >/dev/null
  sleep 2
  curl -s -o /dev/null -w "HTTP local /login → %{http_code}\n" --max-time 10 "http://127.0.0.1:${APP_PORT}/login" || true
  ok "Redémarrage terminé."
}

# --- Sauvegarde (source + DB) ------------------------------------------------
prune_old_backups() {
  local count
  count="$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)"
  if [[ "$count" -gt "$MAX_BACKUPS" ]]; then
    info "Conservation des ${MAX_BACKUPS} dernières sauvegardes..."
    find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
      | sort -n \
      | head -n "$((count - MAX_BACKUPS))" \
      | awk '{print $2}' \
      | while read -r old; do
          rm -rf "$old"
          warn "Sauvegarde supprimée (rotation) : $old"
        done
  fi
}

create_backup() {
  local reason="${1:-manual}"
  local ts label dir
  ts="$(date +%Y%m%d_%H%M%S)"
  label="${ts}_${reason}"
  dir="${BACKUP_ROOT}/${label}"

  [[ -d "$APP_DIR" ]] || die "Répertoire appli absent : $APP_DIR"
  mkdir -p "$dir"
  load_db_url

  info "Sauvegarde → ${dir}"
  {
    echo "created_at=$(date -Iseconds)"
    echo "reason=${reason}"
    echo "app_dir=${APP_DIR}"
    echo "git=$(current_git_info)"
    echo "host=$(hostname)"
  } > "${dir}/meta.txt"

  # .env + maintenance hors tar (copie explicite)
  cp -a "${APP_DIR}/.env" "${dir}/.env" 2>/dev/null || true
  if [[ -f "${APP_DIR}/config/maintenance-user.json" ]]; then
    mkdir -p "${dir}/config"
    cp -a "${APP_DIR}/config/maintenance-user.json" "${dir}/config/"
  fi

  info "Archive des sources (sans node_modules)..."
  tar -C "$APP_DIR" \
    --exclude='./node_modules' \
    --exclude='./.git' \
    -czf "${dir}/app-source.tar.gz" .

  # Option : commit git pour info
  if [[ -d "${APP_DIR}/.git" ]]; then
    (cd "$APP_DIR" && git rev-parse HEAD > "${dir}/git-commit.txt" 2>/dev/null || true)
    (cd "$APP_DIR" && git status -sb > "${dir}/git-status.txt" 2>/dev/null || true)
  fi

  info "Dump PostgreSQL..."
  if pg_dump --clean --if-exists --no-owner --no-acl "$DB_URL" | gzip -c > "${dir}/db.sql.gz"; then
    ok "Dump DB OK ($(du -h "${dir}/db.sql.gz" | awk '{print $1}'))"
  else
    rm -rf "$dir"
    die "Échec pg_dump — déploiement annulé (aucune sauvegarde partielle)."
  fi

  # Marqueur de backup complet
  touch "${dir}/COMPLETE"
  du -sh "$dir" | awk '{print "Taille totale sauvegarde: "$1}'
  prune_old_backups
  echo "$dir" > /tmp/transfohub_last_backup_path
  ok "Sauvegarde complète : $dir"
  LAST_BACKUP_DIR="$dir"
}

list_backups() {
  mkdir -p "$BACKUP_ROOT"
  mapfile -t BACKUP_LIST < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '*_*' | sort -r)
  if [[ ${#BACKUP_LIST[@]} -eq 0 ]]; then
    warn "Aucune sauvegarde dans ${BACKUP_ROOT}"
    return 1
  fi
  echo -e "${BOLD}Sauvegardes disponibles :${NC}"
  local i=1
  for b in "${BACKUP_LIST[@]}"; do
    local mark="" meta_git=""
    [[ -f "${b}/COMPLETE" ]] && mark="${GREEN}OK${NC}" || mark="${RED}incomplet${NC}"
    [[ -f "${b}/meta.txt" ]] && meta_git="$(grep '^git=' "${b}/meta.txt" 2>/dev/null | cut -d= -f2-)"
    printf "  %2d) %s  [%b]  %s  %s\n" "$i" "$(basename "$b")" "$mark" "$(du -sh "$b" 2>/dev/null | awk '{print $1}')" "$meta_git"
    i=$((i + 1))
  done
  return 0
}

# --- Build / run helpers -----------------------------------------------------
ensure_ecosystem_port() {
  local eco="${APP_DIR}/ecosystem.config.cjs"
  [[ -f "$eco" ]] || return 0
  # Force port 7000 (prod nginx)
  sed -i "s/start -p [0-9]\\+/start -p ${APP_PORT}/g" "$eco"
  sed -i "s/PORT: [0-9]\\+/PORT: ${APP_PORT}/g" "$eco"
}

preserve_runtime_secrets() {
  # Restaure .env / maintenance depuis une copie de secours si manquants après extract
  local bak_env="$1"
  if [[ ! -f "${APP_DIR}/.env" && -f "$bak_env" ]]; then
    cp -a "$bak_env" "${APP_DIR}/.env"
    chmod 600 "${APP_DIR}/.env"
  fi
}

build_and_migrate() {
  info "npm ci..."
  (cd "$APP_DIR" && npm ci)
  info "Prisma generate..."
  (cd "$APP_DIR" && npm run db:generate)
  info "Migrations (deploy, pas de seed)..."
  (cd "$APP_DIR" && npm run db:migrate)
  info "Build Next.js..."
  (cd "$APP_DIR" && npm run build)
  ensure_ecosystem_port
  mkdir -p "${APP_DIR}/logs"
  ok "Build + migrations terminés."
}

pm2_reload_app() {
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_NAME" --update-env
  else
    (cd "$APP_DIR" && pm2 start ecosystem.config.cjs)
  fi
  pm2 save >/dev/null
  systemctl start nginx 2>/dev/null || systemctl reload nginx 2>/dev/null || true
  sleep 2
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:${APP_PORT}/login" || echo fail)"
  if [[ "$code" == "200" || "$code" == "307" || "$code" == "302" ]]; then
    ok "Application répond (HTTP ${code})."
  else
    warn "Réponse inattendue HTTP ${code} — vérifiez : pm2 logs ${PM2_NAME}"
  fi
}

# --- Déploiements ------------------------------------------------------------
deploy_from_git() {
  echo -e "${BOLD}Déploiement depuis Git${NC}"
  local remote branch
  read -r -p "Remote [${GIT_REMOTE_DEFAULT}] : " remote
  remote="${remote:-$GIT_REMOTE_DEFAULT}"
  read -r -p "Branche [${GIT_BRANCH_DEFAULT}] : " branch
  branch="${branch:-$GIT_BRANCH_DEFAULT}"

  echo
  info "Remote=${remote}  Branche=${branch}"
  info "Une sauvegarde source+DB sera créée avant déploiement."
  confirm "Continuer le déploiement Git ?" || { warn "Annulé."; return 0; }

  create_backup "pre-git-deploy"

  # Préserver secrets
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

  # Remettre secrets (au cas où .env gitignored et ok)
  cp -a "$env_bak" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
  mkdir -p "${APP_DIR}/config"
  [[ -s "$maint_bak" ]] && cp -a "$maint_bak" "${APP_DIR}/config/maintenance-user.json"
  rm -f "$env_bak" "$maint_bak"

  build_and_migrate
  pm2_reload_app
  ok "Déploiement Git terminé."
  info "En cas de problème : option 6 — Rollback (sauvegarde ${LAST_BACKUP_DIR:-voir ${BACKUP_ROOT}})"
}

deploy_from_zip() {
  echo -e "${BOLD}Déploiement depuis un fichier ZIP${NC}"
  echo "  a) Chemin d'un ZIP déjà présent sur le serveur"
  echo "  b) Télécharger l'archive GitHub (branche main)"
  read -r -p "Choix [a/b] : " mode
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

  info "Extraction du ZIP..."
  local extract="${work}/extract"
  mkdir -p "$extract"
  unzip -q "$zip_path" -d "$extract"

  # GitHub zip crée un sous-dossier Type repo-branch/
  local src
  src="$(find "$extract" -mindepth 1 -maxdepth 1 -type d | head -1)"
  if [[ -z "$src" ]]; then
    # zip plat
    src="$extract"
  fi
  [[ -f "${src}/package.json" ]] || die "package.json introuvable dans le ZIP (structure inattendue)"

  info "Synchronisation vers ${APP_DIR} (préserve .env)..."
  # Supprime le code actuel sauf node_modules (sera réinstallé) — on rsync --delete
  rsync -a --delete \
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
  info "Rollback possible via option 6."
}

# --- Rollback ----------------------------------------------------------------
do_rollback() {
  echo -e "${BOLD}${RED}Rollback vers une sauvegarde précédente${NC}"
  echo "Ceci va :"
  echo "  • restaurer les fichiers applicatifs depuis l'archive"
  echo "  • restaurer la base PostgreSQL (dump)"
  echo "  • reconstruire les dépendances si besoin et redémarrer"
  echo
  list_backups || { pause; return 0; }
  echo
  read -r -p "Numéro de sauvegarde à restaurer (0 = annuler) : " num
  [[ "$num" =~ ^[0-9]+$ ]] || { warn "Entrée invalide."; return 0; }
  [[ "$num" -eq 0 ]] && { warn "Annulé."; return 0; }
  local idx=$((num - 1))
  [[ "$idx" -ge 0 && "$idx" -lt ${#BACKUP_LIST[@]} ]] || { warn "Numéro hors plage."; return 0; }
  local bak="${BACKUP_LIST[$idx]}"
  [[ -f "${bak}/COMPLETE" ]] || die "Sauvegarde incomplète : $bak"
  [[ -f "${bak}/app-source.tar.gz" ]] || die "Archive source manquante"
  [[ -f "${bak}/db.sql.gz" ]] || die "Dump DB manquant"

  echo
  warn "Cible : $bak"
  cat "${bak}/meta.txt" 2>/dev/null || true
  echo
  confirm "CONFIRMER le rollback ? (la DB prod sera écrasée par ce dump)" || { warn "Annulé."; return 0; }

  # Filet de sécurité : backup de l'état actuel avant rollback
  info "Sauvegarde de l'état actuel (filet de sécurité)..."
  create_backup "pre-rollback" || warn "Sauvegarde pré-rollback échouée — poursuite sur confirmation déjà donnée"

  load_db_url

  info "Arrêt de l'application..."
  pm2 stop "$PM2_NAME" 2>/dev/null || true

  info "Restauration des fichiers applicatifs..."
  # Garde node_modules de côté optionnel — plus simple : vider et retar
  find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} +
  tar -xzf "${bak}/app-source.tar.gz" -C "$APP_DIR"
  # Forcer .env de la sauvegarde
  if [[ -f "${bak}/.env" ]]; then
    cp -a "${bak}/.env" "${APP_DIR}/.env"
    chmod 600 "${APP_DIR}/.env"
  fi
  if [[ -f "${bak}/config/maintenance-user.json" ]]; then
    mkdir -p "${APP_DIR}/config"
    cp -a "${bak}/config/maintenance-user.json" "${APP_DIR}/config/"
  fi

  info "Restauration PostgreSQL (peut prendre un moment)..."
  load_db_url
  if gunzip -c "${bak}/db.sql.gz" | psql "$DB_URL" -v ON_ERROR_STOP=1; then
    ok "Base restaurée."
  else
    die "Échec restauration DB. Les fichiers app ont déjà été remplacés — voir ${bak} et la sauvegarde pre-rollback."
  fi

  info "Réinstallation dépendances + generate (build si .next absent)..."
  (cd "$APP_DIR" && npm ci)
  (cd "$APP_DIR" && npm run db:generate)
  if [[ ! -d "${APP_DIR}/.next" ]]; then
    (cd "$APP_DIR" && npm run build)
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
  echo "  5) Déployer à partir d'un fichier ZIP (GitHub / local)"
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
  mkdir -p "$BACKUP_ROOT" "$(dirname "$LOG_FILE")"
  touch "$LOG_FILE"
  # Si non interactif avec argument
  if [[ "${1:-}" == "--backup-only" ]]; then
    create_backup "cli"
    exit 0
  fi
  while true; do
    show_menu
  done
}

main "$@"
