# TransfoHub — Onboarding développeur

Guide pour charger le projet en local et démarrer correctement.  
Compléments obligatoires : **`AGENTS.md`** (règles agent/produit), **`.grok/MEMORY.md`** (mémoire projet).

| Doc | Public |
|-----|--------|
| Ce fichier | Setup machine + premiers pas |
| [`CONTEXTE_RECENT.md`](./CONTEXTE_RECENT.md) | Ce qui a été livré récemment |
| [`REGLES_DEVELOPPEMENT.md`](./REGLES_DEVELOPPEMENT.md) | Conventions de code & PR |
| [`AGENT_BOOTSTRAP.md`](./AGENT_BOOTSTRAP.md) | **À coller / charger pour l’agent IA** |
| [`DOCUMENTATION_FONCTIONNELLE.md`](./DOCUMENTATION_FONCTIONNELLE.md) | Doc métier (peut être en retard vs code) |
| `DEPLOY.md` (racine) | Déploiement serveur (PM2 / Nginx) |
| `KPIS.txt` (racine) | Formules KPI |

---

## 1. Prérequis

| Outil | Version indicative |
|-------|-------------------|
| Node.js | **20+** (22 LTS recommandé) |
| npm | fourni avec Node |
| PostgreSQL | 14+ (local ou distant) |
| Git | 2.x |
| OS | Windows / Linux / macOS |

Optionnel : éditeur avec support TypeScript, extension Prisma.

---

## 2. Récupérer le code

```bash
git clone https://github.com/Larbs77/TransfoHub.git
cd TransfoHub
git checkout main
git pull origin main
```

Branche de travail : partir de **`main`**, créer une branche feature :

```bash
git checkout -b feature/mon-sujet
```

---

## 3. Variables d’environnement

```bash
cp .env.example .env
```

Éditer `.env` :

```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/transfodb?schema=public
SESSION_SECRET=une-chaine-secrete-d-au-moins-32-caracteres
# GROQ_API_KEY=          # optionnel (chat Admin)
# SEED_ADMIN_PASSWORD=   # optionnel (seed admin)
```

**Interdit :** URL SQLite `file:` — rejetée par `lib/create-prisma.ts`.

Fichier maintenance (optionnel, hors DB) :

```bash
cp config/maintenance-user.example.json config/maintenance-user.json
# puis changer le mot de passe en prod
```

---

## 4. Base de données

Créer une base PostgreSQL vide (exemple) :

```sql
CREATE USER transfo WITH PASSWORD 'dev_password';
CREATE DATABASE transfodb OWNER transfo;
\c transfodb
GRANT ALL ON SCHEMA public TO transfo;
```

Puis :

```bash
npm ci
npm run db:generate      # client Prisma → generated/prisma
npm run db:migrate       # prisma migrate deploy
npm run db:seed          # ATTENTION : reseed domaine (destructif sur données métier)
```

- **`db:seed`** : à utiliser surtout sur une base **vide / de dev**. Ne pas lancer en prod/recette partagée sans accord.
- **Compte admin (seed dev)** :
  - Identifiant : `admin`
  - Mot de passe : valeur de `SEED_ADMIN_PASSWORD` dans `.env`, sinon défaut seed **`ChangeMe1!`**
  - À changer dès la première connexion en environnement partagé.

Vérifier :

```bash
npm run db:status
```

---

## 5. Lancer l’application

```bash
npm run dev
```

Ouvrir : [http://localhost:3000](http://localhost:3000)

Build production locale :

```bash
npm run build
npm start
```

---

## 6. Commandes utiles

| Commande | Usage |
|----------|--------|
| `npm run dev` | Serveur de dev |
| `npm run build` | Build Next.js |
| `npm run db:generate` | Régénérer le client Prisma |
| `npm run db:migrate` | Appliquer migrations (`deploy`) |
| `npm run db:migrate:dev` | Créer / appliquer en dev |
| `npm run db:seed` | Seed (destructif métier) |
| `npm run db:status` | État des migrations |
| `npx tsc --noEmit` | Contrôle TypeScript |
| `npm run lint` | ESLint |

---

## 7. Structure rapide

| Chemin | Rôle |
|--------|------|
| `app/(auth)/` | Login, changement de mot de passe |
| `app/(app)/` | App authentifiée + `actions.ts` |
| `app/(app)/admin/` | Users, rôles, messagerie, import/purge |
| `components/` | UI métier + `ui/` (shadcn) |
| `lib/` | auth, roles, prisma, labels, gantt, workflow-shared… |
| `prisma/` | schema + migrations + seed |
| `generated/prisma/` | Client généré (**gitignored**) |
| `.grok/MEMORY.md` | Mémoire projet (humains + agents) |
| `AGENTS.md` | Règles agents / stack / conventions |

---

## 8. Première journée (checklist)

1. [ ] Clone + `npm ci` + `.env` + migrate (+ seed si base vide)  
2. [ ] `npm run dev` + login  
3. [ ] Lire **`AGENTS.md`** + **`.grok/MEMORY.md`** + **`docs/CONTEXTE_RECENT.md`**  
4. [ ] Lire **`docs/REGLES_DEVELOPPEMENT.md`**  
5. [ ] Pour l’agent IA : charger **`docs/AGENT_BOOTSTRAP.md`** en début de session  
6. [ ] Créer une branche depuis `main` pour tout changement  

---

## 9. Contacts / accès

- **Remote Git :** `https://github.com/Larbs77/TransfoHub.git`  
- **Branche par défaut :** `main` (pas de `master`)  
- Accès GitHub / DB de recette / secrets : les demander au référent projet (ne pas committer de secrets).  

---

## 10. En cas de problème

| Symptôme | Piste |
|----------|--------|
| Erreur Prisma / champs inconnus | `npm run db:generate` + bump `PRISMA_MODEL_STAMP` dans `lib/prisma.ts` + restart `dev` |
| `file:` SQLite refusé | Corriger `DATABASE_URL` PostgreSQL |
| Build échoue sur `pg` / client | Ne pas importer `lib/workflow.ts` / Prisma dans un composant client |
| Seed écrase les données | Ne pas relancer `db:seed` sur une base partagée |

Bon démarrage sur TransfoHub.
