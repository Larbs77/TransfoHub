#!/bin/bash
# =============================================================================
# TransfoHub RECETTE — redéploiement guidé (nouvelle plateforme)
# Domaine public : https://transfohub-recette.eurafric.com
#
# Flux (best practice banque) :
#   1. Vous déposez le ZIP sources dans :  <pack>/releases/
#   2. sudo ./install-recette.sh
#   3. Le script demande :
#        - chemin de déploiement ACTUEL (ancienne app PM2)
#        - nom de l'app PM2 actuelle
#   4. Il crée une NOUVELLE plateforme (dossier horodaté), y installe
#      les sources, reprend le .env, migre la DB, build, bascule PM2 + Nginx.
#   5. Installe le menu admin (rollback / futurs déploiements).
#
# Usage :
#   sudo ./install-recette.sh
#   sudo ./install-recette.sh /chemin/vers/TransfoHub-main.zip
#
# Aucun secret dans ce script : le .env existant est copié tel quel.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.env"
ZIP_ARG="${1:-}"

# shellcheck disable=SC1090
[[ -f "$CONFIG_FILE" ]] && source "$CONFIG_FILE"

# Defaults
PUBLIC_HOST="${PUBLIC_HOST:-transfohub-recette.eurafric.com}"
PUBLIC_URL="${PUBLIC_URL:-https://transfohub-recette.eurafric.com}"
APP_PORT="${APP_PORT:-3000}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
NGINX_SITE_NAME="${NGINX_SITE_NAME:-transfohub-recette}"
NGINX_SITES_AVAILABLE="${NGINX_SITES_AVAILABLE:-/etc/nginx/sites-available}"
NGINX_SITES_ENABLED="${NGINX_SITES_ENABLED:-/etc/nginx/sites-enabled}"
REQUIRE_SSL="${REQUIRE_SSL:-true}"
FORCE_HTTPS="${FORCE_HTTPS:-true}"
MAX_BACKUPS="${MAX_BACKUPS:-15}"
RUN_DB_MIGRATE="${RUN_DB_MIGRATE:-true}"
INSTALL_NODE_IF_MISSING="${INSTALL_NODE_IF_MISSING:-true}"
NODE_MAJOR_MIN="${NODE_MAJOR_MIN:-20}"
INSTALL_SYSTEM_PACKAGES="${INSTALL_SYSTEM_PACKAGES:-true}"
# Racine des plateformes (nouvelle version = sous-dossier releases/)
PLATFORMS_ROOT="${PLATFORMS_ROOT:-/var/www/transfohub-recette}"
ALLOW_GITHUB_DOWNLOAD="${ALLOW_GITHUB_DOWNLOAD:-false}"
GITHUB_ZIP_URL="${GITHUB_ZIP_URL:-https://github.com/Larbs77/TransfoHub/archive/refs/heads/main.zip}"

if [[ -z "${BACKUP_ROOT:-}" ]]; then
  BACKUP_ROOT="${SCRIPT_DIR}/backups"
fi
if [[ -z "${LOG_FILE:-}" ]]; then
  LOG_FILE="${SCRIPT_DIR}/transfohub-recette-install.log"
fi
if [[ -z "${RELEASES_DIR:-}" ]]; then
  RELEASES_DIR="${SCRIPT_DIR}/releases"
fi

mkdir -p "$BACKUP_ROOT" "$RELEASES_DIR"

# Runtime (remplis en interactif)
APP_DIR_CURRENT=""
PM2_NAME_OLD=""
PM2_NAME=""
APP_DIR_TARGET=""
RELEASE_ID=""
RELEASE_ZIP=""
LAST_BACKUP_DIR=""
SSL_CERT_FILE="${SSL_CERT_FILE:-}"
SSL_KEY_FILE="${SSL_KEY_FILE:-}"

# --- UI ----------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
info() { echo -e "${CYAN}➜${NC} $*"; log "INFO: $*"; }
ok()   { echo -e "${GREEN}✔${NC} $*"; log "OK: $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; log "WARN: $*"; }
err()  { echo -e "${RED}✖${NC} $*" >&2; log "ERR: $*"; }
die()  { err "$*"; exit 1; }

confirm() {
  local msg="${1:-Continuer ?}"
  read -r -p "$(echo -e "${YELLOW}${msg} [o/N]${NC} ")" ans
  [[ "${ans:-}" =~ ^[oOyY]$ ]]
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die "Exécutez en root : sudo $0 ${ZIP_ARG}"
}

# --- Helpers -----------------------------------------------------------------
list_pm2_apps() {
  command -v pm2 >/dev/null 2>&1 || return 0
  pm2 jlist 2>/dev/null | python3 -c "
import sys, json
try:
  data=json.load(sys.stdin)
  for a in data:
    name=a.get('name','?')
    cwd=(a.get('pm2_env') or {}).get('pm_cwd') or '?'
    st=(a.get('pm2_env') or {}).get('status') or '?'
    print(f'{name}\t{st}\t{cwd}')
except Exception:
  pass
" 2>/dev/null || true
}

guess_port_from_pm2() {
  local name="$1"
  command -v pm2 >/dev/null 2>&1 || return 0
  pm2 jlist 2>/dev/null | python3 -c "
import sys, json
name='''${name}'''
try:
  data=json.load(sys.stdin)
  for a in data:
    if a.get('name')==name:
      env=a.get('pm2_env') or {}
      args=env.get('args') or []
      # next start -p 3000
      if isinstance(args, list):
        for i,v in enumerate(args):
          if v in ('-p','--port') and i+1 < len(args):
            print(args[i+1]); sys.exit(0)
      port=(env.get('env') or {}).get('PORT') or env.get('PORT')
      if port: print(port); sys.exit(0)
except Exception:
  pass
" 2>/dev/null || true
}

analyze_env_file() {
  local envf="$1"
  [[ -f "$envf" ]] || return 1
  echo "  Fichier : $envf"
  echo "  Variables (valeurs masquées) :"
  grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$envf" 2>/dev/null | while IFS= read -r line; do
    echo "    - ${line%%=*}=***"
  done
  if grep -qE '^DATABASE_URL=' "$envf"; then
    ok "DATABASE_URL détectée → DB existante (migrate, pas de seed)"
  else
    warn "DATABASE_URL absente"
  fi
  if grep -qE '^SESSION_SECRET=' "$envf"; then
    ok "SESSION_SECRET présent"
  else
    warn "SESSION_SECRET absent"
  fi
}

detect_ssl_certs() {
  local host="$PUBLIC_HOST"
  local cert="" key=""
  if [[ -n "${SSL_CERT_FILE:-}" && -n "${SSL_KEY_FILE:-}" && -f "${SSL_CERT_FILE}" && -f "${SSL_KEY_FILE}" ]]; then
    cert="$SSL_CERT_FILE"
    key="$SSL_KEY_FILE"
  else
    local candidates=(
      "/etc/letsencrypt/live/${host}/fullchain.pem|/etc/letsencrypt/live/${host}/privkey.pem"
      "/etc/ssl/certs/${host}.crt|/etc/ssl/private/${host}.key"
      "/etc/nginx/ssl/${host}.crt|/etc/nginx/ssl/${host}.key"
      "/etc/nginx/ssl/fullchain.pem|/etc/nginx/ssl/privkey.pem"
    )
    local pair c k
    for pair in "${candidates[@]}"; do
      c="${pair%%|*}"; k="${pair##*|}"
      if [[ -f "$c" && -f "$k" ]]; then cert="$c"; key="$k"; break; fi
    done
    if [[ -z "$cert" && -d /etc/letsencrypt/live ]]; then
      local d
      for d in /etc/letsencrypt/live/*; do
        if [[ -f "${d}/fullchain.pem" && -f "${d}/privkey.pem" ]]; then
          if [[ "$(basename "$d")" == "$host" || "$(basename "$d")" == *recette* ]]; then
            cert="${d}/fullchain.pem"; key="${d}/privkey.pem"; break
          fi
        fi
      done
    fi
  fi
  SSL_CERT_FILE="$cert"
  SSL_KEY_FILE="$key"
  if [[ -n "$cert" ]]; then
    ok "Certificat : $cert"
    if command -v openssl >/dev/null 2>&1; then
      local end
      end="$(openssl x509 -in "$cert" -noout -enddate 2>/dev/null | cut -d= -f2 || true)"
      [[ -n "$end" ]] && info "Expiration : $end (peut être dépassée — OK pour l'instant)"
    fi
  else
    warn "Aucun certificat SSL auto-détecté"
  fi
}

# --- Étape 0 : ZIP dans releases/ --------------------------------------------
step_wait_for_zip() {
  echo
  echo -e "${BOLD}═══ 0) ZIP de la nouvelle version ═══${NC}"
  echo -e "  Dossier de dépôt : ${CYAN}${RELEASES_DIR}${NC}"
  echo "  Déposez ici l'archive GitHub (ex. TransfoHub-main.zip) puis continuez."
  echo

  if [[ -n "$ZIP_ARG" ]]; then
    [[ -f "$ZIP_ARG" ]] || die "ZIP introuvable : $ZIP_ARG"
    RELEASE_ZIP="$(cd "$(dirname "$ZIP_ARG")" && pwd)/$(basename "$ZIP_ARG")"
    # copier dans releases/ pour traçabilité
    cp -a "$RELEASE_ZIP" "${RELEASES_DIR}/$(basename "$RELEASE_ZIP")"
    RELEASE_ZIP="${RELEASES_DIR}/$(basename "$RELEASE_ZIP")"
    ok "ZIP fourni : $RELEASE_ZIP"
    return 0
  fi

  while true; do
    mapfile -t ZIPS < <(find "$RELEASES_DIR" -maxdepth 1 -type f \( -name '*.zip' -o -name '*.ZIP' \) | sort)
    if [[ ${#ZIPS[@]} -eq 0 ]]; then
      warn "Aucun fichier .zip dans ${RELEASES_DIR}"
      echo "  1) J'ai déposé le ZIP — rescanner"
      echo "  2) Indiquer un chemin absolu de ZIP"
      if [[ "${ALLOW_GITHUB_DOWNLOAD}" =~ ^(yes|YES|true|TRUE|1)$ ]]; then
        echo "  3) Télécharger depuis GitHub (souvent bloqué en banque)"
      fi
      echo "  0) Quitter"
      read -r -p "Choix [1] : " ch
      ch="${ch:-1}"
      case "$ch" in
        0) die "Annulé — déposez le ZIP puis relancez." ;;
        2)
          read -r -p "Chemin absolu du ZIP : " zp
          [[ -f "$zp" ]] || { warn "Fichier introuvable"; continue; }
          cp -a "$zp" "${RELEASES_DIR}/$(basename "$zp")"
          RELEASE_ZIP="${RELEASES_DIR}/$(basename "$zp")"
          ok "ZIP copié : $RELEASE_ZIP"
          return 0
          ;;
        3)
          if [[ ! "${ALLOW_GITHUB_DOWNLOAD}" =~ ^(yes|YES|true|TRUE|1)$ ]]; then
            warn "Téléchargement désactivé (ALLOW_GITHUB_DOWNLOAD=false)"
            continue
          fi
          RELEASE_ZIP="${RELEASES_DIR}/TransfoHub-main.zip"
          info "Téléchargement ${GITHUB_ZIP_URL}..."
          curl -fL --retry 3 -o "$RELEASE_ZIP" "$GITHUB_ZIP_URL" \
            || die "Échec download — déposez le ZIP manuellement"
          ok "ZIP téléchargé : $RELEASE_ZIP"
          return 0
          ;;
        *) continue ;;
      esac
    elif [[ ${#ZIPS[@]} -eq 1 ]]; then
      RELEASE_ZIP="${ZIPS[0]}"
      ok "ZIP unique trouvé : $RELEASE_ZIP"
      ls -lh "$RELEASE_ZIP"
      confirm "Utiliser ce ZIP ?" || { warn "Retirez/ajoutez un ZIP dans releases/ puis relancez"; die "Annulé"; }
      return 0
    else
      echo "Plusieurs ZIP trouvés :"
      local i=1
      for z in "${ZIPS[@]}"; do
        printf "  %2d) %s  (%s)\n" "$i" "$(basename "$z")" "$(du -h "$z" | awk '{print $1}')"
        i=$((i + 1))
      done
      read -r -p "Numéro du ZIP à déployer [1] : " idx
      idx="${idx:-1}"
      RELEASE_ZIP="${ZIPS[$((idx - 1))]}"
      [[ -f "$RELEASE_ZIP" ]] || die "Sélection invalide"
      ok "ZIP sélectionné : $RELEASE_ZIP"
      return 0
    fi
  done
}

# --- Étape 1 : questions CLI -------------------------------------------------
step_ask_current_instance() {
  echo
  echo -e "${BOLD}═══ 1) Instance actuelle (source de vérité config) ═══${NC}"
  echo -e "  Domaine public (conservé) : ${CYAN}${PUBLIC_URL}${NC}"
  echo

  if command -v pm2 >/dev/null 2>&1; then
    echo -e "${BOLD}Applications PM2 détectées :${NC}"
    local line
    local n=0
    while IFS=$'\t' read -r name st cwd; do
      [[ -z "${name:-}" ]] && continue
      n=$((n + 1))
      printf "  %2d) PM2=%-24s statut=%-10s cwd=%s\n" "$n" "$name" "$st" "$cwd"
    done < <(list_pm2_apps)
    [[ "$n" -eq 0 ]] && echo "  (aucune)"
    echo
  fi

  # Chemin actuel
  local default_dir="${APP_DIR:-}"
  if [[ -z "$default_dir" ]] && command -v pm2 >/dev/null 2>&1; then
    default_dir="$(list_pm2_apps | head -1 | awk -F'\t' '{print $3}')"
  fi

  while true; do
    if [[ -n "$default_dir" ]]; then
      read -r -p "Chemin de déploiement ACTUEL [${default_dir}] : " APP_DIR_CURRENT
      APP_DIR_CURRENT="${APP_DIR_CURRENT:-$default_dir}"
    else
      read -r -p "Chemin de déploiement ACTUEL (absolu) : " APP_DIR_CURRENT
    fi
    if [[ -d "$APP_DIR_CURRENT" ]]; then
      APP_DIR_CURRENT="$(cd "$APP_DIR_CURRENT" && pwd)"
      break
    fi
    warn "Dossier introuvable : $APP_DIR_CURRENT"
  done

  # Nom PM2
  local default_pm2="${PM2_NAME:-}"
  if [[ -z "$default_pm2" ]]; then
    default_pm2="$(list_pm2_apps | awk -F'\t' -v d="$APP_DIR_CURRENT" '$3==d {print $1; exit}')"
  fi
  if [[ -z "$default_pm2" ]]; then
    default_pm2="$(list_pm2_apps | head -1 | awk -F'\t' '{print $1}')"
  fi
  default_pm2="${default_pm2:-transfohub-recette}"

  read -r -p "Nom de l'application PM2 actuelle [${default_pm2}] : " PM2_NAME_OLD
  PM2_NAME_OLD="${PM2_NAME_OLD:-$default_pm2}"
  # Même nom pour la nouvelle instance (bascule in-place côté PM2)
  PM2_NAME="$PM2_NAME_OLD"

  # Port
  local guessed
  guessed="$(guess_port_from_pm2 "$PM2_NAME_OLD" || true)"
  if [[ -n "$guessed" ]]; then
    read -r -p "Port local Next.js (derrière Nginx) [${guessed}] : " APP_PORT_IN
    APP_PORT="${APP_PORT_IN:-$guessed}"
  else
    read -r -p "Port local Next.js (derrière Nginx) [${APP_PORT}] : " APP_PORT_IN
    APP_PORT="${APP_PORT_IN:-$APP_PORT}"
  fi

  # Nouvelle plateforme
  RELEASE_ID="$(date +%Y%m%d_%H%M%S)"
  APP_DIR_TARGET="${PLATFORMS_ROOT}/releases/${RELEASE_ID}"

  echo
  info "Analyse de l'instance actuelle..."
  if [[ -f "${APP_DIR_CURRENT}/package.json" ]]; then
    ok "package.json présent"
    grep -E '"name"|"version"|"next"' "${APP_DIR_CURRENT}/package.json" | head -8 || true
  else
    warn "package.json absent (ok si ancienne arborescence non standard)"
  fi

  if [[ -f "${APP_DIR_CURRENT}/.env" ]]; then
    analyze_env_file "${APP_DIR_CURRENT}/.env"
  else
    die "Fichier .env introuvable dans ${APP_DIR_CURRENT} — requis pour DATABASE_URL / SESSION_SECRET"
  fi

  detect_ssl_certs

  echo
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Plan de bascule RECETTE${NC}"
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo "  Domaine public     : ${PUBLIC_URL}"
  echo "  Instance actuelle  : ${APP_DIR_CURRENT}"
  echo "  PM2 (stop/bascule) : ${PM2_NAME_OLD}"
  echo "  Port app           : ${APP_PORT}"
  echo "  ZIP sources        : ${RELEASE_ZIP}"
  echo "  NOUVELLE plateforme: ${APP_DIR_TARGET}"
  echo "  Symlink courant    : ${PLATFORMS_ROOT}/current  →  releases/${RELEASE_ID}"
  echo "  SSL cert           : ${SSL_CERT_FILE:-à renseigner}"
  echo "  Backups            : ${BACKUP_ROOT}"
  echo -e "${BOLD}══════════════════════════════════════════════════${NC}"
  echo
  echo "L'ancienne plateforme reste sur disque (non supprimée)."
  echo "Le .env et les uploads seront copiés vers la nouvelle."
  echo
  confirm "Confirmer et lancer le déploiement ?" || die "Annulé par l'opérateur."
}

# --- Packages ----------------------------------------------------------------
step_packages() {
  echo
  echo -e "${BOLD}═══ 2) Paquets système ═══${NC}"

  if [[ ! "${INSTALL_SYSTEM_PACKAGES}" =~ ^(yes|YES|true|TRUE|1)$ ]]; then
    warn "INSTALL_SYSTEM_PACKAGES désactivé"
    return 0
  fi

  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y nginx curl git zip unzip rsync tar ca-certificates openssl \
      build-essential python3 || warn "Certains paquets apt ont échoué"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nginx curl git zip unzip rsync tar ca-certificates openssl \
      gcc-c++ make python3 || warn "Certains paquets dnf ont échoué"
  else
    warn "Gestionnaire de paquets non reconnu"
  fi

  systemctl enable "$NGINX_SERVICE" 2>/dev/null || true

  local major
  major="$(node -v 2>/dev/null | sed 's/v//;s/\..*//' || echo 0)"
  if ! command -v node >/dev/null 2>&1 || [[ "${major:-0}" -lt "$NODE_MAJOR_MIN" ]]; then
    if [[ "${INSTALL_NODE_IF_MISSING}" =~ ^(yes|YES|true|TRUE|1)$ ]] && command -v apt-get >/dev/null 2>&1; then
      info "Installation Node.js 22..."
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y nodejs
    else
      die "Node.js >= ${NODE_MAJOR_MIN} requis"
    fi
  fi
  ok "Node $(node -v) / npm $(npm -v)"

  if ! command -v pm2 >/dev/null 2>&1; then
    npm install -g pm2
  fi
  ok "PM2 $(pm2 -v)"
}

# --- Nginx -------------------------------------------------------------------
step_nginx() {
  echo
  echo -e "${BOLD}═══ 3) Nginx HTTPS (${PUBLIC_HOST}) ═══${NC}"

  detect_ssl_certs
  if [[ -z "${SSL_CERT_FILE:-}" || -z "${SSL_KEY_FILE:-}" ]]; then
    if [[ "${REQUIRE_SSL}" =~ ^(yes|YES|true|TRUE|1)$ ]]; then
      echo "Indiquez les chemins des certificats existants :"
      read -r -p "  Fichier certificat (fullchain.crt/pem) : " SSL_CERT_FILE
      read -r -p "  Fichier clé privée (privkey.key/pem)  : " SSL_KEY_FILE
    fi
  fi
  if [[ -z "${SSL_CERT_FILE:-}" || ! -f "${SSL_CERT_FILE}" || ! -f "${SSL_KEY_FILE:-}" ]]; then
    if [[ "${REQUIRE_SSL}" =~ ^(yes|YES|true|TRUE|1)$ ]]; then
      die "Certificats SSL introuvables (REQUIRE_SSL=true)"
    fi
    warn "HTTPS non configuré"
    return 0
  fi

  local tpl="${SCRIPT_DIR}/nginx/transfohub-recette.conf.template"
  [[ -f "$tpl" ]] || die "Template manquant : $tpl"

  local conf_path
  if [[ -d "$NGINX_SITES_AVAILABLE" ]]; then
    conf_path="${NGINX_SITES_AVAILABLE}/${NGINX_SITE_NAME}.conf"
  else
    mkdir -p /etc/nginx/conf.d
    conf_path="/etc/nginx/conf.d/${NGINX_SITE_NAME}.conf"
  fi

  sed \
    -e "s|__PUBLIC_HOST__|${PUBLIC_HOST}|g" \
    -e "s|__APP_PORT__|${APP_PORT}|g" \
    -e "s|__SSL_CERT_FILE__|${SSL_CERT_FILE}|g" \
    -e "s|__SSL_KEY_FILE__|${SSL_KEY_FILE}|g" \
    "$tpl" > "$conf_path"

  ok "Conf Nginx : $conf_path (server_name=${PUBLIC_HOST})"

  if [[ -d "$NGINX_SITES_ENABLED" ]]; then
    ln -sfn "$conf_path" "${NGINX_SITES_ENABLED}/${NGINX_SITE_NAME}.conf"
  fi

  nginx -t || die "nginx -t a échoué"
  systemctl reload "$NGINX_SERVICE" 2>/dev/null || systemctl restart "$NGINX_SERVICE"
  ok "Nginx rechargé"
}

# --- Backup ------------------------------------------------------------------
backup_current() {
  local reason="${1:-pre-release}"
  local ts dir
  ts="$(date +%Y%m%d_%H%M%S)"
  dir="${BACKUP_ROOT}/${ts}_${reason}"
  mkdir -p "$dir"

  {
    echo "created_at=$(date -Iseconds)"
    echo "reason=${reason}"
    echo "app_dir_current=${APP_DIR_CURRENT}"
    echo "app_dir_target=${APP_DIR_TARGET}"
    echo "pm2=${PM2_NAME_OLD}"
    echo "public_host=${PUBLIC_HOST}"
    echo "release_zip=${RELEASE_ZIP}"
  } > "${dir}/meta.txt"

  cp -a "${APP_DIR_CURRENT}/.env" "${dir}/.env" 2>/dev/null || true
  if [[ -f "${APP_DIR_CURRENT}/config/maintenance-user.json" ]]; then
    mkdir -p "${dir}/config"
    cp -a "${APP_DIR_CURRENT}/config/maintenance-user.json" "${dir}/config/"
  fi

  if [[ -d "$APP_DIR_CURRENT" ]]; then
    info "Backup sources actuelles..."
    tar -C "$APP_DIR_CURRENT" \
      --exclude='./node_modules' --exclude='./.git' --exclude='./.next' \
      -czf "${dir}/app-source.tar.gz" . 2>/dev/null || warn "Archive partielle"
  fi

  local envf="${APP_DIR_CURRENT}/.env"
  if [[ -f "$envf" ]] && command -v pg_dump >/dev/null 2>&1; then
    local dburl
    dburl="$(grep -E '^DATABASE_URL=' "$envf" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | sed 's/?.*//')"
    if [[ -n "$dburl" ]]; then
      info "Dump PostgreSQL..."
      if pg_dump --clean --if-exists --no-owner --no-acl "$dburl" | gzip -c > "${dir}/db.sql.gz"; then
        ok "Dump DB OK"
      else
        warn "pg_dump en échec"
        rm -f "${dir}/db.sql.gz"
      fi
    fi
  fi

  touch "${dir}/COMPLETE"
  LAST_BACKUP_DIR="$dir"
  ok "Sauvegarde : $dir"
}

# --- Nouvelle plateforme -----------------------------------------------------
step_new_platform() {
  echo
  echo -e "${BOLD}═══ 4–5) Nouvelle plateforme + sources + migrate ═══${NC}"

  backup_current "pre-release-${RELEASE_ID}"

  local work extract_root
  work="$(mktemp -d /tmp/th-recette-XXXXXX)"
  info "Extraction ${RELEASE_ZIP}..."
  unzip -q -o "$RELEASE_ZIP" -d "$work"
  extract_root="$(find "$work" -mindepth 1 -maxdepth 1 -type d | head -1)"
  [[ -n "$extract_root" && -f "${extract_root}/package.json" ]] \
    || die "ZIP invalide (package.json introuvable)"

  mkdir -p "${PLATFORMS_ROOT}/releases"
  mkdir -p "$APP_DIR_TARGET"

  info "Installation sources → ${APP_DIR_TARGET}"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude node_modules --exclude .next --exclude .git \
      "${extract_root}/" "${APP_DIR_TARGET}/"
  else
    cp -a "${extract_root}/." "${APP_DIR_TARGET}/"
  fi
  rm -rf "$work"

  # Secrets / runtime depuis l'ancienne instance
  cp -a "${APP_DIR_CURRENT}/.env" "${APP_DIR_TARGET}/.env"
  ok ".env copié depuis l'instance actuelle"
  if [[ -f "${APP_DIR_CURRENT}/config/maintenance-user.json" ]]; then
    mkdir -p "${APP_DIR_TARGET}/config"
    cp -a "${APP_DIR_CURRENT}/config/maintenance-user.json" "${APP_DIR_TARGET}/config/"
  fi
  if [[ -d "${APP_DIR_CURRENT}/public/uploads" ]]; then
    mkdir -p "${APP_DIR_TARGET}/public/uploads"
    cp -a "${APP_DIR_CURRENT}/public/uploads/." "${APP_DIR_TARGET}/public/uploads/" 2>/dev/null || true
    ok "Uploads copiés"
  fi

  # ecosystem PM2
  if [[ -f "${APP_DIR_TARGET}/ecosystem.config.cjs" ]]; then
    sed -i "s/start -p [0-9]\+/start -p ${APP_PORT}/g" "${APP_DIR_TARGET}/ecosystem.config.cjs" || true
    sed -i "s/PORT: [0-9]\+/PORT: ${APP_PORT}/g" "${APP_DIR_TARGET}/ecosystem.config.cjs" || true
    sed -i "s/name: \"transfohub\"/name: \"${PM2_NAME}\"/g" "${APP_DIR_TARGET}/ecosystem.config.cjs" || true
  fi

  mkdir -p "${APP_DIR_TARGET}/logs" "${APP_DIR_TARGET}/public/uploads/avatars"
  chmod 600 "${APP_DIR_TARGET}/.env" 2>/dev/null || true

  # Build sur la NOUVELLE plateforme (l'ancienne tourne encore)
  info "npm ci (nouvelle plateforme)..."
  (cd "$APP_DIR_TARGET" && npm ci)

  info "Prisma generate..."
  (cd "$APP_DIR_TARGET" && npm run db:generate)

  if [[ "${RUN_DB_MIGRATE}" =~ ^(yes|YES|true|TRUE|1)$ ]]; then
    info "Migrations sur la DB existante (pas de seed)..."
    (cd "$APP_DIR_TARGET" && npm run db:migrate)
    ok "Migrations OK"
  fi

  info "Build production..."
  (cd "$APP_DIR_TARGET" && npm run build)
  ok "Build OK — plateforme prête : ${APP_DIR_TARGET}"

  # Symlink current
  ln -sfn "releases/${RELEASE_ID}" "${PLATFORMS_ROOT}/current"
  ok "Symlink ${PLATFORMS_ROOT}/current → releases/${RELEASE_ID}"

  # Marqueur
  {
    echo "release_id=${RELEASE_ID}"
    echo "installed_at=$(date -Iseconds)"
    echo "from_zip=$(basename "$RELEASE_ZIP")"
    echo "previous_app_dir=${APP_DIR_CURRENT}"
    echo "pm2=${PM2_NAME}"
    echo "port=${APP_PORT}"
  } > "${APP_DIR_TARGET}/.release-info"
}

# --- Bascule PM2 + admin -----------------------------------------------------
step_switch_and_admin() {
  echo
  echo -e "${BOLD}═══ 6) Bascule PM2 + menu administration ═══${NC}"

  # Arrêt ancienne instance (même nom ou anciennes variantes)
  if command -v pm2 >/dev/null 2>&1; then
    info "Arrêt PM2 : ${PM2_NAME_OLD}"
    pm2 stop "$PM2_NAME_OLD" 2>/dev/null || true
    pm2 delete "$PM2_NAME_OLD" 2>/dev/null || true
    # autres noms courants
    for n in transfohub transfohub-recette pmo-app; do
      [[ "$n" == "$PM2_NAME_OLD" ]] && continue
      pm2 stop "$n" 2>/dev/null || true
    done
  fi

  (cd "$APP_DIR_TARGET" && pm2 start ecosystem.config.cjs)
  pm2 save || true
  pm2 startup systemd -u root --hp /root 2>/dev/null || true

  sleep 3
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "http://127.0.0.1:${APP_PORT}/login" || echo 000)"
  if [[ "$code" =~ ^[23] ]]; then
    ok "App locale HTTP ${code} → :${APP_PORT}/login"
  else
    warn "App locale HTTP ${code} — pm2 logs ${PM2_NAME}"
  fi

  # Menu admin pointant sur la plateforme courante
  local target="/root/scripts/transfohub-admin-recette"
  mkdir -p "$target/backups" /root/scripts
  if [[ -f "${SCRIPT_DIR}/transfohub-admin.sh" ]]; then
    cp -a "${SCRIPT_DIR}/transfohub-admin.sh" "${target}/transfohub-admin.sh"
    cat > "${target}/config.env" <<EOF
# Généré par install-recette.sh — $(date -Iseconds)
# Domaine public : ${PUBLIC_URL}
APP_DIR="${PLATFORMS_ROOT}/current"
PM2_NAME="${PM2_NAME}"
APP_PORT="${APP_PORT}"
GIT_REMOTE="origin"
GIT_BRANCH="main"
GITHUB_ZIP_URL="${GITHUB_ZIP_URL}"
BACKUP_ROOT="${target}/backups"
MAX_BACKUPS="${MAX_BACKUPS}"
LOG_FILE="${target}/transfohub-admin.log"
NGINX_SERVICE="${NGINX_SERVICE}"
STOP_NGINX_ON_STOP="no"
EOF
    chmod 600 "${target}/config.env"
    chmod +x "${target}/transfohub-admin.sh"
    ln -sfn "${target}/transfohub-admin.sh" /root/scripts/menu-recette.sh
    ok "Menu admin : /root/scripts/menu-recette.sh"
  fi

  # Sauvegarder le mapping pour le prochain run
  cat > "${SCRIPT_DIR}/.last-install.env" <<EOF
APP_DIR_CURRENT="${APP_DIR_CURRENT}"
APP_DIR_TARGET="${APP_DIR_TARGET}"
PLATFORMS_ROOT="${PLATFORMS_ROOT}"
PM2_NAME="${PM2_NAME}"
APP_PORT="${APP_PORT}"
RELEASE_ID="${RELEASE_ID}"
PUBLIC_HOST="${PUBLIC_HOST}"
INSTALLED_AT="$(date -Iseconds)"
EOF
  chmod 600 "${SCRIPT_DIR}/.last-install.env"

  systemctl reload "$NGINX_SERVICE" 2>/dev/null || systemctl restart "$NGINX_SERVICE" 2>/dev/null || true

  echo
  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}${BOLD}  Bascule RECETTE terminée${NC}"
  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════${NC}"
  echo "  URL              : ${PUBLIC_URL}"
  echo "  Ancienne app     : ${APP_DIR_CURRENT}  (conservée)"
  echo "  Nouvelle app     : ${APP_DIR_TARGET}"
  echo "  Courante         : ${PLATFORMS_ROOT}/current"
  echo "  PM2              : ${PM2_NAME}  port ${APP_PORT}"
  echo "  Backup           : ${LAST_BACKUP_DIR}"
  echo "  Menu             : /root/scripts/menu-recette.sh"
  echo
  echo "  Vérifications :"
  echo "    pm2 status && pm2 logs ${PM2_NAME} --lines 40"
  echo "    curl -kI ${PUBLIC_URL}/login"
  echo "    ls -la ${PLATFORMS_ROOT}/"
  echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════${NC}"
}

# --- Main --------------------------------------------------------------------
main() {
  require_root
  echo -e "${BOLD}TransfoHub — déploiement RECETTE (nouvelle plateforme)${NC}"
  echo "Pack     : $SCRIPT_DIR"
  echo "Releases : $RELEASES_DIR  ← déposez le ZIP ici"
  echo "Domaine  : $PUBLIC_URL"
  log "=== START install-recette (new platform flow) ==="

  step_wait_for_zip
  step_ask_current_instance
  step_packages
  step_nginx
  step_new_platform
  step_switch_and_admin

  log "=== END install-recette OK release=${RELEASE_ID} ==="
}

main "$@"
