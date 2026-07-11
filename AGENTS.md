# TransfoHub — Agent notes

## What this is

French-language **PMO dashboard** for Bank of Africa banking transformation (`pmo-transformation-bancaire` / **TransfoHub**). Tracks **chantiers**, **RAID**, **jalons**, **adhérences**, resources/capacity, committees, and executive dashboards.

**Current version:** `0.3.0` (tag `v0.3.0` on branch `Style-Review`).  
**Previous baseline:** `v0.2.0` — PostgreSQL-only (SQLite runtime removed).

## Stack

- Next.js 16 App Router + React 19 + TypeScript
- Prisma 7 → **PostgreSQL only** (`DATABASE_URL` + `@prisma/adapter-pg`)
- Client generated to `generated/prisma` (gitignored; run `npm run db:generate`)
- Auth: iron-session (`SESSION_SECRET`) + bcryptjs
- UI: Tailwind 4, shadcn/Radix, Recharts, @xyflow, @dnd-kit
- Theme: light/dark via `ThemeProvider` + `localStorage` key `pmo-theme` (no inline `<script>` / no `next/script` for theme — React 19 warning)
- Avatar crop: `react-easy-crop` + canvas export (`lib/crop-image.ts`)
- Optional AI chat (Admin only): Groq (`GROQ_API_KEY`)

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
npm run db:seed             # destructive domain reseed; upserts admin
npm run db:status
npm run db:generate
npx tsc --noEmit
```

## Prisma / DB

| Item | Detail |
|------|--------|
| Shared factory | `lib/create-prisma.ts` (app + seeds/scripts) |
| App singleton | `lib/prisma.ts` — Proxy + `PRISMA_MODEL_STAMP`; **bump stamp after schema changes** so HMR drops stale clients |
| Baseline | `prisma/migrations/20260710172723_init_postgres` |
| Later migrations | `…_add_app_roles`, `…_add_user_profile_fields`, `…_add_user_avatar` |
| Seed | `prisma/seed.ts` (Postgres; default roles + domain data; upserts `admin`) |
| SQLite import (historical) | `scripts/pgloader-sqlite-to-postgres.load` |

After schema edits: new migration → `db:generate` → **bump `PRISMA_MODEL_STAMP` in `lib/prisma.ts`** → restart dev if select fields still unknown.

## Layout

| Path | Role |
|------|------|
| `app/(auth)/` | Login, forced password change |
| `app/(app)/` | Authenticated app; bulk server actions in `actions.ts` |
| `app/(app)/admin/users/` | User maintenance (Admin page permission) |
| `app/(app)/admin/roles/` | Dynamic role management |
| `app/(app)/profil/` | Self-service profile (any authenticated user) |
| `app/(print)/` | Printable reports |
| `components/` | Feature UI + `ui/` primitives |
| `lib/` | auth, roles, pages catalog, prisma, labels, avatar helpers |
| `prisma/` | schema, migrations, seeds |
| `Data/` | Source Excel/PPT for imports (not runtime) |
| `KPIS.txt` | Full KPI catalogue and formulas |
| `public/uploads/avatars/` | User avatars (runtime; gitignored except `.gitkeep`) |

## Auth, roles & permissions (v0.3)

### Dynamic roles (`AppRole`)

Not a fixed TypeScript union anymore. `User.role` is a **string code** matching `AppRole.code`.

| Field | Meaning |
|-------|---------|
| `code` | Stable key stored on `User.role` |
| `label`, `color`, `description` | UI |
| `is_active` | Disabled roles cannot log in / not offered for assignment |
| `is_system` | Seeded defaults; Admin cannot be disabled |
| `chantier_scope` | `all` \| `assigned` \| `none` — data scoping for chantiers |
| `pages` | JSON array of allowed route paths (see `lib/app-pages.ts`) |

**Admin UI:** `/admin/roles` — create, edit pages/scope, disable/reactivate.  
**Helpers:** `lib/roles.ts`, page catalog `lib/app-pages.ts`.  
**Nav:** filtered by `user.allowedPages` from layout.  
**Guards:** `requireAuth`, `requirePageAccess(...paths)`, `requireRole(...codes)` (legacy mapping + page capability).  
**Login:** rejects inactive/missing roles.

Seeded system roles (labels): Administrateur, Bureau Programme, PMO Chantier, Gestionnaire Ressources.

### User model extras (v0.3)

| Field | Notes |
|-------|--------|
| `first_name`, `last_name` | Admin-editable |
| `phone`, `email` | Admin-editable; user may edit **phone** only on `/profil` |
| `avatar_url` | Empty = letter avatar; path e.g. `/uploads/avatars/{userId}.jpg` |

### Personal profile (`/profil`)

- Opened by clicking **sidebar avatar or name** (logout stays separate).
- Read-only identity; editable phone; change password.
- Avatar: upload → **LinkedIn-style crop/zoom** (`AvatarCropDialog` + `react-easy-crop`) → save crop only; delete restores letter.
- Shared component: `components/user-avatar.tsx` (sizes: sm/md/lg/xl/2xl).

### Admin users

- Role dropdowns = **active** roles only (inactive shown if user still has it).
- Profile fields on create/edit.
- Avatar shown in **table** and **edit dialog** (photo or letter).

## Theme (dark mode)

- `components/theme-provider.tsx` — `useLayoutEffect` + `localStorage` (`pmo-theme`).
- Toggle under user block in sidebar (`theme-toggle.tsx`).
- CSS variables already define `.dark` in `app/globals.css`.

## Domain rules

- Chantier progress (`avancement` / `statut`) from **jalons** + Settings phase weights (`recalculateChantierProgress`).
- Risk score: `impact × probabilite` (1–25); critical thresholds 12 / 15 / 20 — see **`KPIS.txt`**.
- RAID types: Risque, Action, Information, Décision.
- UI language: **French**.

## Recent release notes (v0.2.0 → v0.3.0)

Branch `Style-Review`, tag `v0.3.0`, commit message documents:

1. Dark mode + sidebar toggle  
2. Dynamic roles + permissions UI  
3. User first/last name, phone, email  
4. Self-service profile page  
5. Custom avatars with crop/zoom/delete  
6. Avatars in admin user maintenance  
7. `KPIS.txt`  
8. Prisma stale-client stamp; theme without forbidden `<script>` patterns  

## Conventions

- Prefer server components + `"use server"` actions over new API routes.
- Keep French domain labels in `lib/*-labels.ts`.
- Do not commit `.env`, `*.db`, uploaded avatars under `public/uploads/**` (except `.gitkeep`).
- Never reintroduce `better-sqlite3` / SQLite adapters.
- After Prisma schema change: migrate + generate + **bump `PRISMA_MODEL_STAMP`**.
- Project memory for multi-session continuity: see `.grok/MEMORY.md` and enable Grok memory (`[memory] enabled = true` or `/memory on`).
