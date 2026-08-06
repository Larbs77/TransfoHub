#!/bin/bash
# =============================================================================
# Installation console admin PROD — SANS root
# Usage (en admin_keba) :
#   cd ~/script_prod && chmod +x *.sh && ./INSTALL.sh
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$HOME/script_prod}"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "N'exécutez PAS INSTALL en root. Utilisez admin_keba."
  exit 1
fi

[[ -f "${SCRIPT_DIR}/config.env" ]] || { echo "config.env manquant"; exit 1; }
[[ -f "${SCRIPT_DIR}/transfohub-admin.sh" ]] || { echo "transfohub-admin.sh manquant"; exit 1; }

mkdir -p "$TARGET/backups" "$TARGET/releases" "$HOME/backups"

if [[ "$SCRIPT_DIR" != "$TARGET" ]]; then
  cp -a "${SCRIPT_DIR}/config.env" "${SCRIPT_DIR}/transfohub-admin.sh" "${SCRIPT_DIR}/README.txt" "$TARGET/" 2>/dev/null \
    || cp -a "${SCRIPT_DIR}/config.env" "${SCRIPT_DIR}/transfohub-admin.sh" "$TARGET/"
fi

# RELEASES_DIR vers le pack
if grep -q '^RELEASES_DIR=""' "$TARGET/config.env" 2>/dev/null; then
  sed -i "s|^RELEASES_DIR=\"\"|RELEASES_DIR=\"${TARGET}/releases\"|" "$TARGET/config.env"
fi

chmod 600 "${TARGET}/config.env"
chmod +x "${TARGET}/transfohub-admin.sh"

# Raccourci dans le home
ln -sfn "${TARGET}/transfohub-admin.sh" "$HOME/menu-prod.sh"

echo "=============================================="
echo " Console admin PROD (user $(whoami)) prête"
echo " Dossier  : $TARGET"
echo " Config   : $TARGET/config.env"
echo " Releases : $TARGET/releases/  ← ZIP sources ici"
echo " Backups  : $HOME/backups"
echo ""
echo " Lancer (SANS sudo) :"
echo "   $TARGET/transfohub-admin.sh"
echo "   # ou : ~/menu-prod.sh"
echo "=============================================="
