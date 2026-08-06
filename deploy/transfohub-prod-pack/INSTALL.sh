#!/bin/bash
# Installation du menu admin PRODUCTION sur le serveur banque
# Usage : sudo ./INSTALL.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-/root/scripts/transfohub-prod}"

[[ "$(id -u)" -eq 0 ]] || { echo "Exécutez en root"; exit 1; }
[[ -f "${SCRIPT_DIR}/config.env" ]] || { echo "config.env manquant"; exit 1; }
[[ -f "${SCRIPT_DIR}/transfohub-admin.sh" ]] || { echo "transfohub-admin.sh manquant"; exit 1; }

if grep -q 'REMPLACER' "${SCRIPT_DIR}/config.env"; then
  echo "ATTENTION: config.env contient encore REMPLACER — éditez APP_DIR avant usage réel."
fi

mkdir -p "$TARGET/backups" "$TARGET/releases" /root/scripts
cp -a "${SCRIPT_DIR}/config.env" "${SCRIPT_DIR}/transfohub-admin.sh" "${SCRIPT_DIR}/README.txt" "$TARGET/" 2>/dev/null || \
  cp -a "${SCRIPT_DIR}/config.env" "${SCRIPT_DIR}/transfohub-admin.sh" "$TARGET/"
chmod 600 "${TARGET}/config.env"
chmod +x "${TARGET}/transfohub-admin.sh"
ln -sfn "${TARGET}/transfohub-admin.sh" /root/scripts/menu-prod.sh
ln -sfn "${TARGET}/transfohub-admin.sh" /root/scripts/transfohub-admin-prod.sh

echo "Installé dans : $TARGET"
echo "Raccourci     : /root/scripts/menu-prod.sh"
echo "Éditez        : ${TARGET}/config.env"
echo "Puis          : /root/scripts/menu-prod.sh"
