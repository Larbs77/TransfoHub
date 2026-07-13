# Déploiement TransfoHub — VPS Linux (Node + PM2 + Nginx)

Guide pour déployer la version courante (`main`) sur un serveur cloud Linux  
**sans Docker** : Node.js 22, PostgreSQL, PM2, Nginx.

---

## Architecture

```
Internet → Nginx (:80/:443) → Next.js (127.0.0.1:3000, PM2)
                                    ↓
                              PostgreSQL (:5432, local)
```

---

## 1. Prérequis serveur

- Ubuntu 22.04 / 24.04 LTS (ou Debian 12) recommandé  
- Accès SSH root ou sudo  
- Domaine pointant vers l’IP du serveur (recommandé pour HTTPS)  
- Ports **80** et **443** ouverts (firewall cloud + ufw)

---

## 2. Préparer le serveur

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx ufw

# Node.js 22 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v   # v22.x
npm -v

# PM2
sudo npm install -g pm2

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Firewall :

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 3. Base PostgreSQL

```bash
sudo -u postgres psql
```

Dans `psql` :

```sql
CREATE USER transfo WITH PASSWORD 'CHOISIR_UN_MOT_DE_PASSE_FORT';
CREATE DATABASE transfodb OWNER transfo;
GRANT ALL PRIVILEGES ON DATABASE transfodb TO transfo;
\c transfodb
GRANT ALL ON SCHEMA public TO transfo;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO transfo;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO transfo;
\q
```

Test :

```bash
psql "postgresql://transfo:CHOISIR_UN_MOT_DE_PASSE_FORT@localhost:5432/transfodb" -c 'SELECT 1;'
```

---

## 4. Déployer le code

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www

git clone https://github.com/Larbs77/TransfoHub.git transfohub
cd transfohub
git checkout main
git pull origin main
```

---

## 5. Variables d’environnement

```bash
cp .env.example .env
nano .env
```

Exemple **production** :

```env
DATABASE_URL=postgresql://transfo:CHOISIR_UN_MOT_DE_PASSE_FORT@localhost:5432/transfodb?schema=public
SESSION_SECRET=GENERER_AU_MOINS_32_CARACTERES_ALEATOIRES_SECRETS
NODE_ENV=production

# Optionnel
# GROQ_API_KEY=
# SEED_ADMIN_PASSWORD=UnMotDePasseAdmin1!
```

Générer un secret :

```bash
openssl rand -base64 48
```

### Utilisateur maintenance (console DB)

```bash
cp config/maintenance-user.example.json config/maintenance-user.json
nano config/maintenance-user.json
```

**Changez le mot de passe** (`system` / défaut dev interdit en prod).

---

## 6. Installer, migrer, build

```bash
cd /var/www/transfohub

npm ci
npm run db:generate
npm run db:migrate

# Première installation seulement (données démo + admin) :
# ⚠️ destructif sur le domaine métier
# npm run db:seed

mkdir -p logs public/uploads/avatars
npm run build
```

Compte après seed : **admin** / valeur de `SEED_ADMIN_PASSWORD` (ou `ChangeMe1!`).

Sans seed : créer un admin manuellement ou importer un dump via `/maintenance/db`.

---

## 7. Lancer avec PM2

```bash
cd /var/www/transfohub
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# exécuter la commande sudo que PM2 affiche

pm2 status
pm2 logs transfohub --lines 50
```

Vérifier en local sur le serveur :

```bash
curl -I http://127.0.0.1:3000
```

---

## 8. Nginx

```bash
sudo cp deploy/nginx-transfohub.conf /etc/nginx/sites-available/transfohub
sudo nano /etc/nginx/sites-available/transfohub
# Remplacer your-domain.com par votre domaine (ou IP temporaire)
```

```bash
sudo ln -sf /etc/nginx/sites-available/transfohub /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 9. Mise à jour (nouvelle version)

```bash
cd /var/www/transfohub
git pull origin main
npm ci
npm run db:generate
npm run db:migrate
npm run build
pm2 restart transfohub
pm2 logs transfohub --lines 30
```

---

## 10. Checklist recette / production

| Item | Action |
|------|--------|
| `SESSION_SECRET` | Secret long unique (≥ 32 car.) |
| `DATABASE_URL` | PostgreSQL prod, pas SQLite |
| `maintenance-user.json` | Mot de passe fort, pas le défaut dev |
| Admin | Changer le mot de passe après 1ʳᵉ connexion |
| Migrations | `npm run db:migrate` après chaque release |
| HTTPS | Certbot actif |
| Backups | `pg_dump` planifié (cron) |
| Avatars | `public/uploads/avatars` writable par le user PM2 |
| SMTP | Configurer dans Technique → Messagerie après login admin |

Backup DB exemple :

```bash
pg_dump -U transfo -h localhost transfodb | gzip > ~/backup-transfodb-$(date +%F).sql.gz
```

---

## 11. Dépannage

| Symptôme | Piste |
|----------|--------|
| 502 Bad Gateway | `pm2 status` ; app pas sur :3000 ; `pm2 logs` |
| Prisma / migration error | `DATABASE_URL` ; `npm run db:status` ; droits PG |
| Session / login cassé | `SESSION_SECRET` trop court ou changé après login |
| Build OOM | Ajouter swap 2G ou machine ≥ 2 Go RAM |
| Avatar upload KO | Droits `public/uploads` ; `client_max_body_size` Nginx |

```bash
pm2 logs transfohub
sudo journalctl -u nginx -n 50
sudo tail -f /var/log/nginx/error.log
```

---

## 12. Fichiers fournis dans le repo

| Fichier | Rôle |
|---------|------|
| `ecosystem.config.cjs` | Process PM2 (`next start -p 3000`) |
| `deploy/nginx-transfohub.conf` | Site Nginx (proxy vers 3000) |
| `DEPLOY.md` | Ce guide |

---

## Ordre minimal (résumé)

1. Node 22 + PostgreSQL + Nginx + PM2  
2. Créer DB + user  
3. `git clone` / `pull` `main`  
4. `.env` + `config/maintenance-user.json`  
5. `npm ci` → `db:generate` → `db:migrate` → (`db:seed` si besoin) → `build`  
6. `pm2 start ecosystem.config.cjs` + `pm2 save`  
7. Nginx + Certbot  

Si vous avez l’**IP** ou le **domaine** du serveur et le type d’OS exact, on peut adapter les commandes ligne par ligne (chemins, DNS, import d’un dump existant).
