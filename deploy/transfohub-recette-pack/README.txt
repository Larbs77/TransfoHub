================================================================================
 TransfoHub — Pack déploiement RECETTE (banque / Eurafric)
 Domaine : https://transfohub-recette.eurafric.com  (déjà mappé — conservé)
================================================================================

FLUX RECOMMANDÉ
---------------
  1. Déposer le ZIP sources GitHub dans  releases/
  2. Lancer :  sudo ./install-recette.sh
  3. Répondre aux questions :
       - chemin de déploiement ACTUEL (ancienne app)
       - nom de l'app PM2 actuelle
  4. Le script crée une NOUVELLE plateforme, bascule PM2 + Nginx,
     installe le menu admin (rollback / prochains déploiements).

OÙ DÉPOSER CE PACK (ZIP du pack)
--------------------------------
  Sur le serveur recette :
    /root/scripts/transfohub-recette-pack/

  scp deploy/transfohub-recette-pack.zip root@SERVEUR:/root/
  mkdir -p /root/scripts
  unzip -o /root/transfohub-recette-pack.zip -d /root/scripts/transfohub-recette-pack
  cd /root/scripts/transfohub-recette-pack
  chmod +x install-recette.sh transfohub-admin.sh

OÙ DÉPOSER LE ZIP DE L'APPLICATION
----------------------------------
  /root/scripts/transfohub-recette-pack/releases/TransfoHub-main.zip

  (ou tout autre nom .zip dans releases/ — le script proposera le choix)

NOUVELLE PLATEFORME (structure créée)
-------------------------------------
  /var/www/transfohub-recette/
    current  →  releases/20260806_153012
    releases/
      20260806_153012/     ← sources buildées + .env copié
      (anciennes versions conservées pour rollback manuel)

  L'ancienne instance (chemin saisi) n'est PAS supprimée.

CE QUI EST PRÉSERVÉ
-------------------
  - Domaine https://transfohub-recette.eurafric.com
  - .env (DATABASE_URL, SESSION_SECRET, …)
  - config/maintenance-user.json
  - public/uploads
  - Certificats TLS existants (même expirés)

CE QUI EST FAIT
---------------
  - Backup sources + dump DB
  - Nginx HTTPS
  - npm ci + prisma migrate deploy (SANS seed) + build
  - Bascule PM2
  - Menu : /root/scripts/menu-recette.sh

MENU APRÈS INSTALL
------------------
  /root/scripts/menu-recette.sh
    stop / start / restart / deploy git / deploy zip / rollback / backups

VÉRIFICATIONS
-------------
  pm2 status
  pm2 logs <nom-pm2> --lines 50
  curl -kI https://transfohub-recette.eurafric.com/login
  ls -la /var/www/transfohub-recette/

================================================================================
