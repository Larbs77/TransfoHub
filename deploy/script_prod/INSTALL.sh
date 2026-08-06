#!/bin/bash
# =============================================================================
# Installe la console d'admin PRODUCTION sous le home admin_keba
# Usage :
#   sudo ./INSTALL.sh
#   sudo ./INSTALL.sh /home/admin_keba/script_prod
# =============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-/home/admin_keba/script_prod}"

[[ "$(id -u)" -eq 0 ]] || { echo "Exécutez avec sudo/root"; exit 1; }
[[ -f "${SCRIPT_DIR}/config.env" ]] || { echo "config.env manquant"; exit 1; }
[[ -f "${SCRIPT_DIR}/transfohub-admin.sh" ]] || { echo "transfohub-admin.sh manquant"; exit 1; }

mkdir -p "$TARGET/backups" "$TARGET/releases" /home/admin_keba/backups /root/scripts
cp -a "${SCRIPT_DIR}/config.env" "${SCRIPT_DIR}/transfohub-admin.sh" "${SCRIPT_DIR}/README.txt" "$TARGET/" 2>/dev/null \
  || cp -a "${SCRIPT_DIR}/config.env" "${SCRIPT_DIR}/transfohub-admin.sh" "$TARGET/"

# S'assurer que RELEASES_DIR pointe vers le pack
if ! grep -q '^RELEASES_DIR=' "$TARGET/config.env" 2>/dev/null; then
  echo "RELEASES_DIR=\"${TARGET}/releases\"" >> "$TARGET/config.env"
fi
# Forcer releases à côté du pack si vide dans le fichier copié
sed -i 's|^RELEASES_DIR=""|RELEASES_DIR="'"${TARGET}"'/releases"|' "$TARGET/config.env" || true

chmod 600 "${TARGET}/config.env"
chmod +x "${TARGET}/transfohub-admin.sh" "${TARGET}/INSTALL.sh" 2>/dev/null || true
chown -R admin_keba:admin_keba "$TARGET" /home/admin_keba/backups 2>/dev/null || true

# Raccourcis root
ln -sfn "${TARGET}/transfohub-admin.sh" /root/scripts/menu-prod.sh
ln -sfn "${TARGET}/transfohub-admin.sh" /root/scripts/transfohub-admin-prod.sh

# Raccourci user
ln -sfn "${TARGET}/transfohub-admin.sh" /home/admin_keba/menu-prod.sh 2>/dev/null || true
chown -h admin_keba:admin_keba /home/admin_keba/menu-prod.sh 2>/dev/null || true

echo "=============================================="
echo " Console admin PROD installée"
echo " Dossier  : $TARGET"
echo " Config   : $TARGET/config.env"
echo " Releases : $TARGET/releases/   ← déposer les ZIP ici"
echo " Backups  : /home/admin_keba/backups"
echo ""
echo " Lancer (root) :"
echo "   sudo $TARGET/transfohub-admin.sh"
echo "   # ou : sudo /root/scripts/menu-prod.sh"
echo "=============================================="
