# TransfoHub — Agent notes

## What this is

French-language **PMO dashboard** for Bank of Africa banking transformation (`pmo-transformation-bancaire` / **TransfoHub**). Tracks **chantiers**, **RAID**, **jalons**, **adhérences**, resources/capacity, committees, and executive dashboards.

**Current version:** `0.4.0` (tag `v0.4.0` on `main`).  
**Previous:** `v0.3.1` (BOA branding / theme / KPI), `v0.3.0` (Style-Review), `v0.2.0` (PostgreSQL-only).

## Stack

- Next.js 16 App Router + React 19 + TypeScript
- Prisma 7 → **PostgreSQL only** (`DATABASE_URL` + `@prisma/adapter-pg`)
- Client generated to `generated/prisma` (gitignored; run `npm run db:generate`)
- Auth: iron-session (`SESSION_SECRET`) + bcryptjs
- UI: Tailwind 4, shadcn/Radix, Recharts, @xyflow, @dnd-kit
- Theme: light/dark via `ThemeProvider` + `localStorage` key `pmo-theme` (no inline `<script>` / no `next/script` for theme — React 19 warning)
- Brand: Bank of Africa **#0A3C74** (navy) + **#00BDBB** (teal); logo `public/boa-logo.png`
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
| Later migrations | `…_add_app_roles` (seeds 4 roles), `…_add_user_profile_fields`, `…_add_user_avatar`, `…_add_user_theme_preference`, `…_add_mail_server_config` |
| Seed | `prisma/seed.ts` (Postgres; default roles + domain data; upserts `admin`) |
| SQLite import (historical) | `scripts/pgloader-sqlite-to-postgres.load` |
| Stamp (v0.4.0) | `PRISMA_MODEL_STAMP` includes mail-server model checks — **bump on every schema change** |

After schema edits: new migration → `db:generate` → **bump `PRISMA_MODEL_STAMP` in `lib/prisma.ts`** → restart dev if select fields still unknown.

## Layout

| Path | Role |
|------|------|
| `app/(auth)/` | Login, forced password change — **BOA brand shell** (`AuthBrandShell`) |
| `app/(app)/` | Authenticated app; bulk server actions in `actions.ts` |
| `app/(app)/admin/users/` | User maintenance (Admin page permission) |
| `app/(app)/admin/roles/` | Dynamic role management |
| `app/(app)/admin/messagerie/` | SMTP server config (**Admin only**) — Technique menu |
| `app/(app)/admin/donnees/` | CSV import / purge for métier tables (**Admin only**) — Technique menu |
| `app/(maintenance)/` | File-based **system** user only — `/maintenance/db` critical DB console (no app nav) |
| `app/(app)/profil/` | Self-service profile (any authenticated user) |
| `app/(print)/` | Printable reports |
| `components/` | Feature UI + `ui/` primitives |
| `lib/` | auth, roles, pages catalog, prisma, mail, csv/db maintenance helpers |
| `config/` | `maintenance-user.example.json` (real `maintenance-user.json` **gitignored**) |
| `prisma/` | schema, migrations, seeds |
| `Data/` | Source Excel/PPT for imports (not runtime) |
| `KPIS.txt` | Full KPI catalogue and formulas |
| `public/boa-logo.png` | Bank of Africa logo (login / change-password) |
| `public/uploads/avatars/` | User avatars (runtime; gitignored except `.gitkeep`) |

## Brand & light mode (v0.3.1)

| Token | Value | Use |
|-------|--------|-----|
| Navy | `#0A3C74` | Primary, titles, buttons, nav active |
| Teal | `#00BDBB` | Accents, focus rings, brand labels |
| White | lots of white | Cards, sidebar, auth card |

- **Light mode** CSS in `:root` (`app/globals.css`): navy/teal tokens, soft cool-white page wash, light card shadows.
- **Auth shell:** `components/auth-brand-shell.tsx` — animated grid/orbs/network; white-forward, sober.
- **Login:** BOA logo top; Sparkles icon left of **TransfoHub** title; navy primary button.
- **Sidebar:** brand block « Bank of Africa / TransfoHub » + teal icon on navy.
- **Dark mode:** separate `.dark` tokens (not BOA-rebranded the same way).
- **Timeline bars:** `TIMELINE_PRIORITE_COLORS` in `lib/chantier-labels.ts` (navy→teal). Date ticks Jan/Jul + **Auj.** markers stay as designed (sky/amber + rose).

## Auth, roles & permissions (v0.3)

### Dynamic roles (`AppRole`)

Not a fixed TypeScript union. `User.role` is a **string code** matching `AppRole.code`.

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

### User model extras (v0.3 → v0.3.1)

| Field | Notes |
|-------|--------|
| `first_name`, `last_name` | Admin-editable |
| `phone`, `email` | Admin-editable; user may edit **phone** only on `/profil` |
| `avatar_url` | Empty = letter avatar; path e.g. `/uploads/avatars/{userId}.jpg` |
| `theme_preference` | `light` \| `dark` (default `light`) — account default UI theme |

### Personal profile (`/profil`)

- Opened by clicking **sidebar avatar or name** (logout stays separate).
- Read-only identity; editable phone; change password.
- **Mode d'affichage:** choose default light/dark → saved to `theme_preference`; applied immediately + on next app access via `UserThemeSync`.
- Avatar: upload → **LinkedIn-style crop/zoom** (`AvatarCropDialog` + `react-easy-crop`) → save crop only; delete restores letter.
- Shared component: `components/user-avatar.tsx` (sizes: sm/md/lg/xl/2xl).

### Admin users

- Role dropdowns = **active** roles only (inactive shown if user still has it).
- Profile fields on create/edit.
- Avatar shown in **table** and **edit dialog** (photo or letter).

## Theme (light / dark)

- `components/theme-provider.tsx` — `useLayoutEffect` + `localStorage` (`pmo-theme`).
- Sidebar toggle (`theme-toggle.tsx`) = temporary switch during session.
- Account default: `User.theme_preference` applied by `components/user-theme-sync.tsx` when authenticated shell loads.
- Light mode brand tokens: navy/teal (see Brand section). Dark mode uses `.dark` in `app/globals.css`.

## Home dashboard KPIs

- **Lancés / total:** count chantiers with `statut ≠ "Non démarré"` / total chantiers; subtitle « Chantiers démarrés ». Source: `getDashboardStats()` + `components/kpi-cards.tsx`.
- KPI cards: lift/hover polish; bold titles; BOA-tinted default hover.
- **Timeline Chantiers:** BOA bar colors (`TIMELINE_PRIORITE_COLORS`); Jan = sky, Jul = amber; today line + small **Auj.** under dates.
- Full formulas: **`KPIS.txt`**.

## DB maintenance user (file-based · not in DB) · v0.4.0

- **Credentials file:** `config/maintenance-user.json` (**gitignored**). Copy from `config/maintenance-user.example.json`.
- **Default (dev):** username `system` / password `123.Pol*` — **must change in production**.
- **Login:** if username matches the file → verify against file password; else normal Prisma/bcrypt auth.
- **Session:** `isMaintenance: true`, role `__MAINTENANCE__`, userId `__maintenance__` (`lib/auth.ts` + `lib/maintenance-auth.ts`).
- **Console:** `/maintenance/db` only — red critical banner; no app sidebar. `(app)` layout redirects maintenance sessions here; `requireAuth` does the same.
- **Exports:** `.thdump.json` dump, SQL INSERT data-only, ZIP of per-table CSVs (**pipe `|`**).
- **Import modes:**
  - **truncate** — TRUNCATE all app tables, then load (SQL must not contain DDL).
  - **drop** — DROP SCHEMA → `prisma migrate deploy` → **TRUNCATE again** (clears AppRole seed from migrations) → load dump/SQL.
- **Pitfalls:**
  - Migration `add_app_roles` seeds Admin/… — without post-migrate truncate, dump insert hits `AppRole_code_key`.
  - JSON columns (`AppRole.pages`): stringify + `::jsonb` (node-pg treats JS arrays as PG arrays otherwise).
  - After restore: **restart Next.js**; optional `npm run db:generate` after DROP.
- **UI:** live progress log (step actions: drop / migrate / truncate / table-by-table load).
- **Lib:** `lib/maintenance-auth.ts`, `lib/db-maintenance.ts`. Server actions body limit **64mb** (`next.config.ts`).

## Mail / SMTP (v0.4.0 · Technique)

- **UI:** Technique → **Serveur De Messagerie** (`/admin/messagerie`) — Admin only.
- **Model:** `MailServerConfig` — host, port, security (`none` | `starttls` | `ssl`), auth, from/reply-to, TLS, timeouts, pool, `is_default`.
- **Password:** encrypted at rest (`lib/mail-crypto.ts`, AES-256-GCM via `SESSION_SECRET`).
- **Send API:** `import { sendMail } from "@/lib/mail"` — default active config (use this for all future notifications).
- **Test:** form sends a test message; last status on the config row.
- Nav: `/admin/messagerie` in `lib/app-pages.ts` (section Technique).

## Data import / purge (v0.4.0 · Technique)

- **UI:** Technique → **Import / Purge** (`/admin/donnees`) — Admin only.
- **Tables (current):** `Ressources`, `RAID` only (extend carefully with same CSV helpers).
- **CSV separator:** pipe `|` — `CSV_SEPARATOR` / `rowsToCsv` / `parseCsv` in `lib/csv-data-admin.ts` (commas allowed in cell text). Legacy comma files accepted only if header has no `|`.
- **Preview:** full column set + horizontal scroll; report OK/errors per line.
- **Write modes after preview:**
  - **append** — insert only.
  - **replace** — purge table then insert; if table not empty, **force backup CSV download** first; confirm with `PURGE`.
- **Standalone purge button:** 3-step wizard — (1) mandatory backup download, (2) type exact table **label** (`Ressources` or `RAID`), (3) type `PURGE`.
- **System fields:** never in CSV import — `id`, `createdAt`, `updatedAt` generated by DB.
- **FKs in CSV:** RAID → `chantier_code`, `responsable_email`; Ressources → `profil` (name match).
- **Purge Ressources:** delete `SaisieTemps`, nullify User/MembreEquipe/Raid.responsable links, then delete rows.
- **Lib / actions:** `lib/csv-data-admin.ts`, `app/(app)/admin/donnees/actions.ts`.

## Timeline (hydration)

- Client timelines must receive **`nowMs`** from a Server Component (do not use bare `Date.now()` during SSR render).
- Format CSS percentages with a stable helper (e.g. 4 decimal places) to avoid float serialization mismatch.
- Components: `ChantierTimelineChart`, `ChantierTimelinePMO`.

## Domain rules

- Chantier progress (`avancement` / `statut`) from **jalons** + Settings phase weights (`recalculateChantierProgress`).
- Risk score: `impact × probabilite` (1–25); critical thresholds 12 / 15 / 20 — see **`KPIS.txt`**.
- RAID types: Risque, Action, Information, Décision.
- UI language: **French**.

## Git / release state (as of 2026-07-12)

| Item | Value |
|------|--------|
| Tag `v0.4.0` | SMTP admin, CSV Import/Purge, system DB maintenance, timeline hydration fix |
| Tag `v0.3.1` | BOA branding, theme preference, KPI/timeline polish |
| Tag `v0.3.0` | Dark mode, dynamic roles, profiles, avatars |
| Tag `v0.2.0` | PostgreSQL-only |
| `main` | At `v0.4.0` (merged `SMTP-Server-Connection`) |
| Remote | May still need `git push origin main` + tags if not published |

## Recent release notes

### v0.2.0 → v0.3.0 (`Style-Review`)

1. Dark mode + sidebar toggle  
2. Dynamic roles + permissions UI  
3. User first/last name, phone, email  
4. Self-service profile page  
5. Custom avatars with crop/zoom/delete  
6. Avatars in admin user maintenance  
7. `KPIS.txt`  
8. Prisma stale-client stamp; theme without forbidden `<script>` patterns  

### v0.3.0 → v0.3.1

1. `User.theme_preference` + `/profil` Mode d'affichage + `UserThemeSync`  
2. Home KPI **Lancés / total** + card hover/typography polish  
3. Timeline Jan/Jul colors, **Auj.** marker, BOA bar palette  
4. BOA login/change-password shell + logo; light-mode app brand tokens  
5. Sidebar TransfoHub brand block  

### v0.3.1 → v0.4.0

1. Technique → **Serveur De Messagerie** (SMTP config, encrypted password, test send)  
2. Technique → **Import / Purge** (RAID & Ressources CSV `|`, append or replace with backup)  
3. File-based **system** maintenance user + `/maintenance/db` (dump/SQL/CSV, DROP/TRUNCATE, live log)  
4. Timeline « Auj. » hydration fix (`nowMs` + stable percentages)  
5. Prisma `MailServerConfig` migration + client stamp  

## Conventions

- Prefer server components + `"use server"` actions over new API routes.
- Keep French domain labels in `lib/*-labels.ts`.
- Do not commit `.env`, `*.db`, `config/maintenance-user.json`, uploaded avatars under `public/uploads/**` (except `.gitkeep`).
- Never reintroduce `better-sqlite3` / SQLite adapters.
- After Prisma schema change: migrate + generate + **bump `PRISMA_MODEL_STAMP`**.
- Product emails only via `sendMail()` from `lib/mail.ts`.
- CSV in this product = **pipe-separated** unless extending a format that documents otherwise.
- Destructive DB ops (purge/replace/maintenance import) require explicit user confirmation + backup where designed.
- Project memory: `.grok/MEMORY.md` + `.grok/config.toml` (`[memory] enabled = true`). User must also enable memory in `~/.grok/config.toml` and/or set `GROK_MEMORY=1`. Mid-session: `/memory on`.
