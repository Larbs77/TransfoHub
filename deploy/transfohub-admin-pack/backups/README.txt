Ce dossier reçoit les sauvegardes automatiques et manuelles
(source applicative + dump PostgreSQL) créées par transfohub-admin.sh

Structure d'une sauvegarde :
  YYYYMMDD_HHMMSS_raison/
    app-source.tar.gz
    db.sql.gz
    .env
    meta.txt
    COMPLETE

Ne supprimez pas manuellement le dossier parent "backups".
La rotation (MAX_BACKUPS dans config.env) purge les plus anciennes.
