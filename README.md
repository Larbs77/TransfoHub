# TransfoHub — PMO Transformation Bancaire

Application PMO (Next.js) pour le pilotage de la transformation bancaire : chantiers, RAID, jalons, adhérences, ressources, comités et dashboards.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **PostgreSQL** via Prisma 7 (`@prisma/adapter-pg`)
- Auth : iron-session + bcryptjs
- UI : Tailwind 4, shadcn/Radix, Recharts

## Prérequis

- Node.js 20+
- PostgreSQL 14+ (base vide ou existante `transfodb`)

## Configuration

```bash
cp .env.example .env
# Éditer .env : DATABASE_URL + SESSION_SECRET (32+ caractères)
```

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | Connexion PostgreSQL (obligatoire) |
| `SESSION_SECRET` | Secret session iron-session (obligatoire) |
| `GROQ_API_KEY` | Chat IA admin (optionnel) |
| `SEED_ADMIN_PASSWORD` | Mot de passe initial `admin` au seed (optionnel) |

## Base de données

```bash
# Appliquer les migrations (CI / recette / prod)
npm run db:migrate

# Environnement de dev (crée migrations si besoin)
npm run db:migrate:dev

# Données de démo (réécrit le domaine métier ; upsert admin)
npm run db:seed

# Statut migrations
npm run db:status

# Prisma Studio
npm run db:studio
```

Migration unique de baseline : `prisma/migrations/20260710172723_init_postgres`.

> SQLite n’est plus supporté. Les anciens fichiers `*.db` locaux sont ignorés par git.

### Première installation

```bash
npm install
cp .env.example .env
# Créer la base PostgreSQL, puis :
npm run db:migrate
npm run db:seed
npm run dev
```

Compte seed par défaut : **admin** / `SEED_ADMIN_PASSWORD` ou `ChangeMe1!` (changement de mot de passe forcé à la première connexion si créé par le seed).

Réinitialiser le mot de passe admin :

```bash
npx tsx scripts/update-password.ts "VotreMotDePasse1!"
```

## Développement

```bash
npm run dev    # http://localhost:3000
npm run build
npm run lint
```

## Scripts utilitaires

| Script | Description |
|--------|-------------|
| `scripts/update-password.ts` | Reset mot de passe admin (Postgres) |
| `scripts/import-raid.ts` | Import RAID depuis `Data/RAID.xlsx` |
| `prisma/seed-raid.ts` | Seed RAID de démo |
| `scripts/pgloader-sqlite-to-postgres.load` | Recette **historique** pgloader SQLite→Postgres (hors runtime) |

## Rôles

`Admin` · `Programme_Office` · `PMO_Chantier` · `Workforce_Manager`

Voir `lib/permissions.ts` pour la matrice des routes.
