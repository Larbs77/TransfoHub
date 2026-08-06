#!/bin/bash
# =============================================================================
# Installation rapide du pack admin TransfoHub sur le serveur
# Usage (depuis le dossier dézippé) :
#   chmod +x INSTALL.sh transfohub-admin.sh
#   ./INSTALL.sh
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-/root/scripts/transfohub-admin}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Exécutez en root : sudo $0"
  exit 1
fi

echo "=== Installation TransfoHub Admin ==="
echo "Source : $SCRIPT_DIR"
echo "Cible  : $TARGET_DIR"
echo

if [[ ! -f "${SCRIPT_DIR}/config.env" ]]; then
  echo "ERREUR: config.env manquant"
  exit 1
fi

mkdir -p "$TARGET_DIR"
# Copie du pack (préserve backups existants si réinstall)
rsync -a --exclude 'backups/*' \
  "${SCRIPT_DIR}/config.env" \
  "${SCRIPT_DIR}/transfohub-admin.sh" \
  "${SCRIPT_DIR}/README.txt" \
  "$TARGET_DIR/" 2>/dev/null || {
  cp -a "${SCRIPT_DIR}/config.env" "${SCRIPT_DIR}/transfohub-admin.sh" "${SCRIPT_DIR}/README.txt" "$TARGET_DIR/"
}

mkdir -p "${TARGET_DIR}/backups"
chmod 700 "$TARGET_DIR" "${TARGET_DIR}/backups" 2>/dev/null || true
chmod 600 "${TARGET_DIR}/config.env"
chmod 755 "${TARGET_DIR}/transfohub-admin.sh"

# Raccourcis pratiques
mkdir -p /root/scripts
ln -sfn "${TARGET_DIR}/transfohub-admin.sh" /root/scripts/transfohub-admin.sh
ln -sfn "${TARGET_DIR}/transfohub-admin.sh" /root/scripts/menu.sh

echo
echo "✔ Fichiers installés dans : $TARGET_DIR"
echo
echo "PROCHAINE ÉTAPE OBLIGATOIRE :"
echo "  1) Éditer la config :"
echo "       nano ${TARGET_DIR}/config.env"
echo "  2) Vérifier APP_DIR, APP_PORT, PM2_NAME, GIT_*, GITHUB_ZIP_URL"
echo "  3) Lancer le menu :"
echo "       ${TARGET_DIR}/transfohub-admin.sh"
echo "     ou : /root/scripts/menu.sh"
echo
echo "Les backups iront dans : ${TARGET_DIR}/backups/  (si BACKUP_ROOT vide dans config)"
echo "=== Fin installation ==="
