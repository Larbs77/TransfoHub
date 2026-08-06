================================================================================
 TransfoHub — script_prod (console admin PRODUCTION)
 Exécution : admin_keba UNIQUEMENT — pas de root, pas de Nginx
 Domaine   : https://transfohub.eurafric.com
================================================================================

FICHIERS
--------
  config.env           → chemins prod (préremplis)
  transfohub-admin.sh  → menu (stop/start/restart PM2, deploy, rollback, backup)
  INSTALL.sh           → setup local (sans root)
  releases/            → déposer le ZIP de la nouvelle version
  README.txt

CONFIG
------
  APP_DIR=/home/admin_keba/workspace/Transfohub-main
  PM2_NAME=transfohub
  APP_PORT=8000
  BACKUP_ROOT=/home/admin_keba/backups

INSTALLATION SUR LE SERVEUR
---------------------------
  1) Récupérer le pack
       cd /home/admin_keba
       # git pull du repo puis :
       cp -a TransfoHub/deploy/script_prod ~/script_prod
       # ou unzip script_prod.zip -d ~/script_prod

  2) Installer (en admin_keba, SANS sudo)
       cd ~/script_prod
       chmod +x transfohub-admin.sh INSTALL.sh
       ./INSTALL.sh

  3) Déposer le ZIP de l'application
       ~/script_prod/releases/TransfoHub-main.zip

  4) Lancer le menu (SANS sudo)
       ~/menu-prod.sh
       # ou
       ~/script_prod/transfohub-admin.sh

MENU
----
  1) Arrêter l'application (PM2)
  2) Démarrer l'application (PM2)
  3) Redémarrer l'application (PM2)
  4) Déployer depuis Git
  5) Déployer depuis ZIP   ← option b) dossier releases/
  6) Rollback source + DB
  7) Sauvegarde manuelle
  8) Lister les sauvegardes
  0) Quitter

DÉPLOYER UNE NOUVELLE VERSION
-----------------------------
  1. Copier le ZIP dans ~/script_prod/releases/
  2. ~/menu-prod.sh
  3. Choix 5 → b (releases) → confirmer
  4. Vérifier :
       pm2 list
       pm2 logs transfohub --lines 40
       curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/login
       curl -kI https://transfohub.eurafric.com/login

NOTES
-----
  - Nginx n'est PAS géré (pas de start/stop/reload).
  - Ne pas lancer en root (le script refuse root pour éviter le mauvais ~/.pm2).
  - Si "pm2: commande introuvable", le script cherche nvm sous $HOME et peut
    installer pm2 via npm install -g pour l'utilisateur courant.
  - Optionnel dans config.env si besoin :
      CMD_PM2=.../bin/pm2
      CMD_NPM=.../bin/npm
      CMD_NODE=.../bin/node

================================================================================
