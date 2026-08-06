================================================================================
 TransfoHub — Pack admin PRODUCTION (banque)
 Modèle : script cloud /root/scripts/transfohub-admin.sh
================================================================================

ANALYSE DU SCRIPT CLOUD (72.61.194.36 — 2026-08-06)
----------------------------------------------------
  Fichier   : /root/scripts/transfohub-admin.sh  (500 lignes)
  Raccourci : /root/scripts/menu.sh

  Config cloud :
    APP_DIR=/var/www/transfohub
    PM2_NAME=transfohub
    APP_PORT=7000
    BACKUP_ROOT=/root/backups/transfohub
    Domaine nginx : transfohub.cloud
    .env : DATABASE_URL, SESSION_SECRET, GROQ_API_KEY

  Menu cloud :
    1 Arrêt PM2+Nginx
    2 Démarrage
    3 Redémarrage
    4 Deploy Git (backup auto)
    5 Deploy ZIP (backup auto)
    6 Rollback source+DB
    7 Backup manuel
    8 Lister backups

  Comportement clé :
    - Backup source (.tar.gz sans node_modules) + pg_dump avant deploy
    - Préserve .env et maintenance-user.json
    - npm ci + db:generate + db:migrate (pas de seed) + build
    - pm2 restart / start ecosystem

PACK PROD BANQUE (ce dossier)
-----------------------------
  config.env              → à COMPLÉTER (APP_DIR, PM2, port, domaine)
  transfohub-admin.sh     → menu identique au cloud + config.env + PATH pm2
  INSTALL.sh              → installe sous /root/scripts/transfohub-prod
  releases/               → déposer les ZIP de release
  backups/                → sauvegardes (ou BACKUP_ROOT dans config.env)
  README.txt

  Améliorations vs cloud (pour serveur banque) :
    - config externalisée (config.env)
    - STOP_NGINX_ON_STOP=no par défaut
    - résolution pm2/npm sous sudo / user applicatif (PM2_USER)
    - choix ZIP depuis dossier releases/
    - confirmations marquées PRODUCTION

INSTALLATION SUR SERVEUR PROD BANQUE
------------------------------------
  1. Copier ce pack :
       /root/scripts/transfohub-prod-pack/
     ou
       /home/admin_keba/transfohub-prod-pack/

  2. Éditer config.env :
       APP_DIR=...          chemin réel de l'app
       PM2_NAME=...
       APP_PORT=...
       PUBLIC_HOST=...
       PM2_USER=admin_keba  si PM2 tourne sous ce user
       BACKUP_ROOT=...

  3. sudo ./INSTALL.sh
     → /root/scripts/menu-prod.sh

  4. Déposer un ZIP release dans releases/ puis :
       /root/scripts/menu-prod.sh
       option 5 (ZIP)

DONNÉES ENCORE NÉCESSAIRES (à me donner pour préremplir config.env)
-------------------------------------------------------------------
  - APP_DIR exact en prod banque
  - PM2_NAME exact
  - APP_PORT
  - PUBLIC_HOST / URL
  - PM2_USER (root ou admin_keba)
  - BACKUP_ROOT souhaité
  - Chemins SSL (si on ajoute un vhost nginx plus tard)

SÉCURITÉ
--------
  - Ne jamais committer de mots de passe
  - Le mot de passe root cloud partagé en chat devrait être ROTATÉ

================================================================================
