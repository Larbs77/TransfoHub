================================================================================
 TransfoHub — Pack administration production
================================================================================

Contenu du dossier (après dézip) :
  config.env              → TOUTES les données de config (chemins, ports, git…)
  transfohub-admin.sh     → Menu interactif
  INSTALL.sh              → Installation optionnelle sous /root/scripts/...
  backups/                → Sauvegardes source + DB (créées par le script)
  README.txt              → Ce fichier

--------------------------------------------------------------------------------
1. Préparer le ZIP sur votre PC
--------------------------------------------------------------------------------
  Zippez TOUT le dossier "transfohub-admin-pack" :

    Windows : clic droit → Envoyer vers → Dossier compressé
    ou PowerShell :
      Compress-Archive -Path deploy\transfohub-admin-pack\* `
        -DestinationPath transfohub-admin-pack.zip -Force

--------------------------------------------------------------------------------
2. Sur le serveur de production
--------------------------------------------------------------------------------
  # Copier le zip (scp, SFTP, etc.) puis :
  mkdir -p /root/scripts
  cd /tmp
  unzip -o transfohub-admin-pack.zip -d /root/scripts/transfohub-admin
  # ou si le zip contient déjà le dossier parent :
  # unzip -o transfohub-admin-pack.zip -d /root/scripts/

  cd /root/scripts/transfohub-admin   # adapter si besoin
  chmod +x transfohub-admin.sh INSTALL.sh
  nano config.env                    # ← OBLIGATOIRE : vérifier les chemins

  # Option A — utiliser le pack où il est :
  ./transfohub-admin.sh

  # Option B — installer + raccourcis menu :
  ./INSTALL.sh
  /root/scripts/menu.sh

--------------------------------------------------------------------------------
3. Fichier config.env — variables à renseigner
--------------------------------------------------------------------------------
  APP_DIR           Chemin absolu de l'appli (ex. /var/www/transfohub)
  PM2_NAME          Nom du process PM2 (ex. transfohub)
  APP_PORT          Port Next.js derrière nginx (ex. 7000)
  GIT_REMOTE        Remote git (ex. origin)
  GIT_BRANCH        Branche à déployer (ex. main)
  GITHUB_ZIP_URL    URL archive ZIP GitHub
  BACKUP_ROOT       Vide = dossier backups/ du pack ; sinon chemin absolu
  MAX_BACKUPS       Nombre de sauvegardes à garder (défaut 10)
  LOG_FILE          Vide = transfohub-admin.log à côté du script
  NGINX_SERVICE     Nom service systemd (nginx)
  STOP_NGINX_ON_STOP  yes/no
  DATABASE_URL_OVERRIDE  (optionnel) sinon lecture de APP_DIR/.env

  Les secrets DB / SESSION / GROQ restent dans APP_DIR/.env
  (le script ne les duplique pas dans config.env).

--------------------------------------------------------------------------------
4. Menu
--------------------------------------------------------------------------------
  1) Tout arrêter
  2) Tout démarrer
  3) Tout redémarrer
  4) Déployer depuis Git          → backup auto puis git pull/build
  5) Déployer depuis ZIP          → backup auto puis extract/build
  6) Rollback source + DB
  7) Sauvegarde manuelle
  8) Lister les sauvegardes
  0) Quitter

  Sauvegarde manuelle en CLI :
    ./transfohub-admin.sh --backup-only

--------------------------------------------------------------------------------
5. Contenu d'une sauvegarde (backups/<date>_<raison>/)
--------------------------------------------------------------------------------
  app-source.tar.gz   Code applicatif (sans node_modules)
  db.sql.gz           Dump PostgreSQL
  .env                Secrets de l'époque
  config/             maintenance-user.json si présent
  meta.txt            Date, commit, host
  COMPLETE            Marqueur de succès

--------------------------------------------------------------------------------
6. Prérequis serveur
--------------------------------------------------------------------------------
  root, bash, git, npm, node, pm2, nginx, postgresql-client (pg_dump/psql),
  curl, rsync, tar, unzip, gzip, python3 (affichage statut PM2)

--------------------------------------------------------------------------------
7. Valeurs d'exemple (prod actuelle type VPS)
--------------------------------------------------------------------------------
  APP_DIR=/var/www/transfohub
  PM2_NAME=transfohub
  APP_PORT=7000
  GIT_BRANCH=main
  GITHUB_ZIP_URL=https://github.com/Larbs77/TransfoHub/archive/refs/heads/main.zip

================================================================================
