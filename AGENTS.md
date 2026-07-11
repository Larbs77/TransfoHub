# TransfoHub — Agent notes

## What this is

French-language **PMO dashboard** for Bank of Africa banking transformation (`pmo-transformation-bancaire`). Tracks **chantiers**, **RAID**, **jalons**, **adhérences**, resources/capacity, committees, and executive dashboards.

## Stack

- Next.js 16 App Router + React 19 + TypeScript
- Prisma 7 → **PostgreSQL only** (`DATABASE_URL` + `@prisma/adapter-pg`)
- Client generated to `generated/prisma` (gitignored; run `npm run db:generate`)
- Auth: iron-session (`SESSION_SECRET`) + bcryptjs
- UI: Tailwind 4, shadcn/Radix, Recharts, @xyflow, @dnd-kit
- Optional AI chat (Admin): Groq (`GROQ_API_KEY`)

## Env

Copy `.env.example` → `.env`:

```
DATABASE_URL=postgresql://...@localhost:5432/transfodb?schema=public
SESSION_SECRET=<32+ char secret>
GROQ_API_KEY=<optional>
SEED_ADMIN_PASSWORD=<optional, for first-time seed of admin>
```

**Do not use SQLite `file:` URLs.** `lib/create-prisma.ts` rejects them.

## Commands

```bash
npm run dev
npm run db:migrate          # prisma migrate deploy
npm run db:migrate:dev
npm run db:seed
npm run db:status
npm run db:generate
npx tsc --noEmit
```

## Prisma / DB

| Item | Detail |
|------|--------|
| Shared factory | `lib/create-prisma.ts` (app + seeds/scripts) |
| App singleton | `lib/prisma.ts` |
| Baseline migration | `prisma/migrations/20260710172723_init_postgres` |
| Seed | `prisma/seed.ts` (Postgres; upserts `admin`) |
| One-shot SQLite import recipe | `scripts/pgloader-sqlite-to-postgres.load` (historical only) |

After schema changes: create a new migration with `npm run db:migrate:dev`, regenerate client, keep French labels in `lib/*-labels.ts` in sync.

## Layout

| Path | Role |
|------|------|
| `app/(auth)/` | Login, forced password change |
| `app/(app)/` | Authenticated app; main server actions in `actions.ts` |
| `app/(print)/` | Printable reports |
| `components/` | Feature UI + `ui/` primitives |
| `lib/` | auth, permissions, prisma, French label maps |
| `prisma/` | schema, migrations, seeds |
| `Data/` | Source Excel/PPT for imports (not runtime) |

## Roles

`Admin` | `Programme_Office` | `PMO_Chantier` | `Workforce_Manager`

Route matrix: `lib/permissions.ts`. Chantier-scoped access for PMO via team membership.

## Domain rules

- Chantier progress (`avancement` / `statut`) is recalculated from **jalons** and phase weights in `Settings`.
- RAID types: Risque, Action, Information, Décision (routes under `/raid`).
- App UI language is French.

## Conventions

- Prefer server components + `"use server"` actions over new API routes.
- Keep French domain labels consistent with `lib/*-labels.ts`.
- Do not commit `.env`, `*.db`, or temp scripts.
- Never reintroduce `better-sqlite3` / SQLite adapters.
