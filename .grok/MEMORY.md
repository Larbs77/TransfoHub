# TransfoHub — project memory (workspace)

Last updated: 2026-07-12 · **v0.4.0** · branch `main` (tag `v0.4.0`)

This file is for **agents and humans** working on TransfoHub. Canonical product rules also live in **`AGENTS.md`** (always loaded when the project is trusted). Keep durable facts here and in `AGENTS.md`; session scratch goes to Grok session memory.

---

## Project identity

| Item | Value |
|------|--------|
| Name | TransfoHub / PMO Transformation Bancaire |
| Package | `pmo-transformation-bancaire` |
| Remote | `https://github.com/Larbs77/TransfoHub.git` |
| Local path | `E:\Bank-Of-Africa\TransfoHub` |
| **Version** | **`0.4.0`** (tag **`v0.4.0`**) |
| **main tip** | Release commit for v0.4.0 (SMTP + Import/Purge + system DB maintenance) |
| UI language | **French** |
| Brand | Bank of Africa navy `#0A3C74` + teal `#00BDBB` |

Prior tags: `v0.3.1` (BOA brand/KPI), `v0.3.0` (roles/profiles/dark), `v0.2.0` (Postgres-only).

---

## Stack (do not regress)

- Next.js 16 App Router + React 19 + TypeScript  
- Prisma 7 → **PostgreSQL only** (`@prisma/adapter-pg`) — **no SQLite / better-sqlite3**  
- Client: `generated/prisma` (gitignored) — `npm run db:generate`  
- Auth: iron-session + bcryptjs (`SESSION_SECRET`)  
- Mail: nodemailer via `lib/mail.ts`  
- UI: Tailwind 4, shadcn/Radix, Recharts, xyflow, dnd-kit  

**Prisma stamp:** `PRISMA_MODEL_STAMP` in `lib/prisma.ts` — currently related to **`mail-server-config-v2`**. **Bump after every schema change** or HMR keeps a stale client.

---

## v0.4.0 features (what was just shipped)

### 1. Technique → Serveur De Messagerie (`/admin/messagerie`)

- Admin only; nav section **Technique**.  
- Model `MailServerConfig`; password encrypted (`lib/mail-crypto.ts`, AES-256-GCM + `SESSION_SECRET`).  
- Future sends: `import { sendMail } from "@/lib/mail"`.  
- Migration: `20260711220000_add_mail_server_config`.

### 2. Technique → Import / Purge (`/admin/donnees`)

- Admin only. Tables for now: **Ressources**, **RAID**.  
- CSV **separator = pipe `|`** (not comma) — `CSV_SEPARATOR` in `lib/csv-data-admin.ts`.  
- Flow: export / template → upload → validation report (all columns, horizontal scroll) → approve.  
- Write modes: **append** | **replace** (purge table then insert).  
- **Replace** forces download of backup CSV when table not empty; confirm with `PURGE`.  
- Standalone **Purger la table**: 3 steps — (1) backup CSV, (2) type exact table label e.g. `Ressources` / `RAID`, (3) type `PURGE`.  
- System fields never imported: `id`, `createdAt`, `updatedAt`.  
- RAID CSV FKs: `chantier_code`, `responsable_email`; Ressources: `profil` (name).  
- Purge Ressources also deletes timesheets and nullifies user/équipe/RAID links.

### 3. System maintenance user (not in DB)

- File: `config/maintenance-user.json` (**gitignored**); example: `config/maintenance-user.example.json`.  
- Dev default often `system` / `123.Pol*` — **change in production**.  
- Login: if username matches file → file password; else normal DB users.  
- Session: `isMaintenance: true`, `userId` `__maintenance__`, role `__MAINTENANCE__`.  
- Console only: `/maintenance/db` — red critical banner; app layout redirects maintenance users there.  
- Export: `.thdump.json` dump, SQL INSERT, ZIP of pipe-CSVs.  
- Import modes: **truncate** (data only) or **drop** (DROP SCHEMA → `prisma migrate deploy` → **truncate seed rows** → load).  
- After migrations, AppRole seeds exist → always truncate before dump load (unique on `code`).  
- JSON columns (e.g. `AppRole.pages`): must `JSON.stringify` + `::jsonb` on insert (node-pg array bug).  
- Live progress log in confirm dialog (step-by-step server actions).  
- After import: **restart Next.js**; DROP may need `db:generate`.  
- Libs: `lib/maintenance-auth.ts`, `lib/db-maintenance.ts`.  
- `next.config.ts`: serverActions `bodySizeLimit: "64mb"`.

### 4. Timeline hydration

- Do **not** call `Date.now()` in timeline client render for SSR.  
- Pass **`nowMs`** from server page; format positions with stable `pct()` (4 decimals).  
- Files: `dashboard-charts.tsx`, `chantier-timeline-pmo.tsx`, `app/(app)/page.tsx`, `dashboard-pmo.tsx`.

---

## Brand (Bank of Africa)

| Color | Hex | Role |
|-------|-----|------|
| Navy | `#0A3C74` | Primary, text, buttons, nav active |
| Teal | `#00BDBB` | Accents, focus, brand labels |
| White | — | Dominant surfaces (auth + light app) |

- Logo: `public/boa-logo.png`  
- Auth: `components/auth-brand-shell.tsx`  
- Light tokens: `app/globals.css` `:root`  
- Timeline bars: `TIMELINE_PRIORITE_COLORS` (not rainbow `PRIORITE_CHANTIER_COLORS`)

---

## Theme

- Sidebar toggle = temporary (`localStorage["pmo-theme"]`).  
- Account default: `User.theme_preference` on `/profil`.  
- Apply: `UserThemeSync` in app layout.  
- No `<script>` / `next/script` for theme (React 19).

---

## Auth / roles (summary)

- Dynamic `AppRole`; Admin sees all pages via `resolveAllowedPages`.  
- Guards: `requireAuth`, `requirePageAccess`, `requireRole`, **`requireMaintenanceAuth`**.  
- `requireAuth` redirects maintenance sessions to `/maintenance/db`.  
- Seeded roles: Admin, Programme_Office, PMO_Chantier, Workforce_Manager.  
- Migration seed inserts 4 AppRole rows — important for dump restore.

---

## Home KPIs

- **Lancés / total** = statut ≠ « Non démarré » / total.  
- Formulas: `KPIS.txt`.

---

## Prisma migrations (Postgres era)

1. `20260710172723_init_postgres`  
2. `…_add_app_roles` (**seeds AppRole**)  
3. `…_add_user_profile_fields`  
4. `…_add_user_avatar`  
5. `…_add_user_theme_preference`  
6. `…_add_mail_server_config` (v0.4.0)

---

## Known pitfalls

1. **Stale Prisma client:** bump `PRISMA_MODEL_STAMP` + restart dev.  
2. **`npm run db:seed`:** destructive domain reseed.  
3. **Never commit** `.env`, `config/maintenance-user.json`, avatar JPGs under `public/uploads/`.  
4. **CSV:** use `|` separator; commas allowed in text.  
5. **Dump restore DROP:** truncate after migrate to clear AppRole seeds; coerce JSON fields.  
6. **Timeline:** pass `nowMs` from server — avoid hydration mismatch on « Auj. ».  
7. **Memory:** enable in `~/.grok/config.toml` and/or `GROK_MEMORY=1`; project `.grok/config.toml` alone may not suffice.  
8. **Remote:** local `main` may be ahead of `origin/main` (push main + `v0.4.0` if not published).

---

## Equipe institutionnelle vs fonctionnelle (2026-07-13)

- **Institutionnelle** (`type=institutionnelle`): org bank; `Ressource.equipeHierarchieId`; comité owners; admin CRUD.
- **Fonctionnelle** (`type=fonctionnelle`): 1:1 with Chantier (`Equipe.chantierId`); auto-created on chantier create; members = `MembreEquipe` (synced to `RessourceEquipeFonctionnelle`).
- **RAID.equipeId**: if assignee is on RAID chantier team → functional equipe; else hierarchy institutional.
- Admin UI `/admin/equipes`: tabs Institutionnelles | Fonctionnelles.
- Helpers: `lib/equipe-types.ts`, `lib/equipe-chantier.ts`. Stamp: `equipe-institutionnelle-fonctionnelle-v1`.
- Migration: `20260713180000_equipe_institutionnelle_fonctionnelle`.

---

## RAID collaborative detail (2026-07-13 · Optimisation-Fonctionnelle-V1.0)

- Route: `/raid/[id]` — click row in RAID list / Mon Tableau de bord.
- Models: `RaidComment`, `RaidAuditLog`; Raid has `equipeId`, `createdByUserId/Name`.
- Collaboration if: assignee · chantier MembreEquipe · same Equipe as RAID.equipeId · Admin/Programme.
- Actions: comment (no auto-assign), status change (**comment mandatory**), assign, auto-assign me.
- Unassigned + non-comment action → auto-assign actor.
- UI: circulation timeline dialog + audit table; BOA navy/teal hero.
- Stamp: `raid-collaboration-v1`. Migration: `20260713160000_raid_collaboration`.

---

## RAID create permission (2026-07-13 · Optimisation-Fonctionnelle-V1.0)

- `AppRole.raid_create_scope`: `none` | `chantier` | `programme` (default **`none`** = Non autorisé).
- Labels UI: Non autorisé · Niveau Chantier · Niveau Programme.
- Admin always effective **programme** at runtime.
- Enforced in `createRaid` via `requireRaidCreateAccess`; Add buttons hidden when none.
- Niveau Chantier: must pick a chantier where user is `MembreEquipe` via their Ressource.
- Migration: `20260713140000_app_role_raid_create_scope`. Stamp: `raid-create-scope-v1`.

---

## MembreEquipe ↔ Ressource (2026-07-13 · Optimisation-Fonctionnelle-V1.0)

- Every chantier team member **must** reference a `Ressource` (`ressourceId` required).
- Free-text `nom_complet` removed from `MembreEquipe`; display name = `ressource.nom_complet`.
- Optional `commentaires` field replaces identity free-text on the form.
- Orphans without ressource deleted in migration `20260713120000_membre_equipe_require_ressource`.
- UI: Chantier → Équipe form selects a ressource (mandatory) + optional comments.
- Stamp: `membre-equipe-ressource-required-v1`.
- Purge Ressources also deletes all `MembreEquipe` rows (no longer nullifies FK).

---

## Suggested next work (open)

- Wire product emails (alerts, comité invites) through `sendMail()`.  
- Extend Import/Purge to more tables (Chantier, Jalon, …).  
- Optional multi-SMTP profiles UI.  
- Push `main` + tag `v0.4.0` if not on origin.  
- Deploy/recette checklist (migrate + maintenance credentials + SMTP).

---

## Key paths cheat-sheet

| Concern | Path |
|---------|------|
| Agent rules | `AGENTS.md` |
| This memory | `.grok/MEMORY.md` |
| SMTP UI | `app/(app)/admin/messagerie/` |
| CSV Import/Purge UI | `app/(app)/admin/donnees/` |
| System DB console | `app/(maintenance)/maintenance/db/` |
| Maintenance auth | `lib/maintenance-auth.ts` |
| DB dump/import | `lib/db-maintenance.ts` |
| CSV pipe helpers | `lib/csv-data-admin.ts` |
| Mail send | `lib/mail.ts`, `lib/mail-crypto.ts` |
| Auth / session | `lib/auth.ts` |
| Page catalog | `lib/app-pages.ts` |
| Prisma stamp | `lib/prisma.ts` |
| Maintenance creds example | `config/maintenance-user.example.json` |
| KPI docs | `KPIS.txt` |
| Timeline | `components/dashboard-charts.tsx`, `chantier-timeline-pmo.tsx` |
