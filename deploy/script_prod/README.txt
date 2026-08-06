================================================================================
 TransfoHub — script_prod (console admin PRODUCTION banque)
 Domaine : https://transfohub.eurafric.com
================================================================================

CONTENU
-------
  config.env              Config prod (APP_DIR, PM2, port 8000, backups)
  transfohub-admin.sh     Menu admin (comme le cloud)
  INSTALL.sh              Installation sur le serveur
  releases/               Déposer ici le ZIP de la nouvelle version
  backups/                (optionnel ; backups réels = /home/admin_keba/backups)
  README.txt

CONFIG PRÉREMPLIE
-----------------
  APP_DIR=/home/admin_keba/workspace/Transfohub-main
  PM2_NAME=transfohub
  PM2_USER=admin_keba
  APP_PORT=8000
  PUBLIC_HOST=transfohub.eurafric.com
  BACKUP_ROOT=/home/admin_keba/backups

================================================================================
ÉTAPES SUR LE SERVEUR PROD
================================================================================

A) Récupérer les fichiers (choisir une méthode)
----------------------------------------------

  # Méthode 1 — ZIP du pack depuis GitHub (si accès réseau)
  cd /home/admin_keba
  curl -fL -o script_prod.zip \
    https://github.com/Larbs77/TransfoHub/raw/main/deploy/script_prod.zip
  unzip -o script_prod.zip -d script_prod
  # ou si le zip contient déjà le dossier script_prod :
  # unzip -o script_prod.zip

  # Méthode 2 — git pull / clone du repo puis copier
  cd /home/admin_keba
  git clone https://github.com/Larbs77/TransfoHub.git   # si pas déjà là
  # ou : cd TransfoHub && git pull origin main
  cp -a TransfoHub/deploy/script_prod ~/script_prod

  # Méthode 3 — scp depuis votre PC
  # scp -r deploy/script_prod admin_keba@SERVEUR:/home/admin_keba/


B) Installer la console
-----------------------
  cd /home/admin_keba/script_prod
  chmod +x transfohub-admin.sh INSTALL.sh
  # Vérifier config.env une dernière fois
  nano config.env
  sudo ./INSTALL.sh


C) Déposer le ZIP de la NOUVELLE version de l'application
---------------------------------------------------------
  # Télécharger depuis GitHub (poste autorisé) puis copier sur le serveur :
  /home/admin_keba/script_prod/releases/TransfoHub-main.zip

  # Exemple scp :
  # scp TransfoHub-main.zip admin_keba@SERVEUR:/home/admin_keba/script_prod/releases/


D) Lancer le menu et déployer
-----------------------------
  sudo /root/scripts/menu-prod.sh
  # ou
  sudo /home/admin_keba/script_prod/transfohub-admin.sh

  Menu :
    1) Tout arrêter          (PM2 only — Nginx reste up)
    2) Tout démarrer
    3) Tout redémarrer
    4) Déployer depuis Git
    5) Déployer depuis ZIP   ← choisir c) dossier releases/  ou a) chemin
    6) Rollback source + DB
    7) Sauvegarde manuelle
    8) Lister les sauvegardes
    0) Quitter

  Pour une nouvelle version (recommandé) :
    → option 7 (backup manuel) optionnel si vous voulez un filet avant
    → option 5 (ZIP) → confirmer
    Le script fait : backup auto → extract → preserve .env → npm ci
                    → migrate (pas de seed) → build → pm2 restart


E) Vérifications après déploiement
----------------------------------
  sudo -u admin_keba -H bash -lc 'export PM2_HOME=$HOME/.pm2; pm2 list; pm2 logs transfohub --lines 40 --nostream'
  curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/login
  curl -kI https://transfohub.eurafric.com/login


IMPORTANT PM2
-------------
  Toujours utiliser le daemon de admin_keba :
    sudo -u admin_keba -H bash -lc 'export PM2_HOME=$HOME/.pm2; pm2 list'

  Ne pas lancer pm2 en root pour cette application.

================================================================================
