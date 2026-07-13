# TransfoHub — project memory (workspace)

Last updated: **2026-07-13** · package **0.4.0** · branch **`main`** @ **`534bf23`** (pushed to `origin/main`)

This file is for **agents and humans** working on TransfoHub. Canonical product rules also live in **`AGENTS.md`**. Functional docs: **`docs/DOCUMENTATION_FONCTIONNELLE.md`**. Deploy: **`DEPLOY.md`**.

---

## Project identity

| Item | Value |
|------|--------|
| Name | TransfoHub / PMO Transformation Bancaire |
| Remote | `https://github.com/Larbs77/TransfoHub.git` |
| Local path | `E:\Bank-Of-Africa\TransfoHub` |
| **main tip** | `534bf23` — RAID assign rules, team header, audit UI, deploy docs |
| Prior feature commit | `facf69a` — collaborative RAID, team types, membership rules |
| Tag released | `v0.4.0` (SMTP, Import/Purge, system DB maintenance) |
| UI language | **French** |
| Brand | Bank of Africa navy `#0A3C74` + teal `#00BDBB` |

---

## Stack (do not regress)

- Next.js 16 App Router + React 19 + TypeScript  
- Prisma 7 → **PostgreSQL only** — **no SQLite / better-sqlite3**  
- Auth: iron-session + bcryptjs  
- Mail: `sendMail()` from `lib/mail.ts`  
- CSV product format: **pipe `|`**  

**Prisma stamp:** bump `PRISMA_MODEL_STAMP` in `lib/prisma.ts` after every schema change.  
Current stamp family: **`equipe-institutionnelle-fonctionnelle-v1`** (+ raid collab models).

---

## Équipes (institutionnelle vs fonctionnelle)

| Type | Meaning | Creation |
|------|---------|----------|
| `institutionnelle` | Bank org unit; `Ressource.equipeHierarchieId`; comité owners | Admin CRUD `/admin/equipes` |
| `fonctionnelle` | Chantier programme team 1:1 (`Equipe.chantierId`) | **Auto** on chantier create; members = `MembreEquipe` |

- Helpers: `lib/equipe-types.ts`, `lib/equipe-chantier.ts`  
- Migration: `20260713180000_equipe_institutionnelle_fonctionnelle`  
- Admin UI: tabs Institutionnelles | Fonctionnelles  

### RAID.equipeId (assignment rule — do not break)

When assignee is set:
1. If assignee is **MembreEquipe** on RAID’s `chantierId` → **functional** chantier team  
2. Else → assignee’s **institutional** hierarchy team  
3. Unassign → clear `equipeId`  

---

## MembreEquipe

- `ressourceId` **required**; no free-text identity (`nom_complet` removed)  
- Optional `commentaires`  
- Display name = `ressource.nom_complet`  
- Migration: `20260713120000_membre_equipe_require_ressource`  

---

## RAID collaboration & rights

### Surfaces
- List: `/raid` (click row) → detail **`/raid/[id]`**  
- Models: `RaidComment`, `RaidAuditLog`  
- UI: `components/raid-detail-client.tsx`; actions: `app/(app)/raid/[id]/actions.ts`  
- Lib: `lib/raid-collaboration.ts`, `lib/raid-labels.ts`  

### Create (`AppRole.raid_create_scope`)
- `none` (default) | `chantier` | `programme`  
- Admin effective **programme**  
- Migration: `20260713140000_app_role_raid_create_scope`  

### Collaborate (comment, status, auto-assign if unassigned)
- Admin / Programme_Office / institutional **Bureau Programme**  
- Assignee  
- Any `MembreEquipe` on RAID chantier  
- Same institutional team as assignee  
- Same derived `raid.equipeId` (func or inst)  
- Status change: **comment mandatory**  
- Comment does **not** auto-assign  

### Assign / reassign only (`canAssignRaid`)
- Admin, role Programme_Office, or institutional team « Bureau Programme » → **any** RAID  
- Directeur de chantier / Suppléant / PMO on **that** chantier → RAID **linked to that chantier** only  
- Others cannot reassign  
- Team resolution on reassign still uses `resolveRaidEquipeId`  

### List visibility (`getRaidItems` when scope ≠ all)
OR: chantier in scope · assigned to me · `equipeId` = my institutional team  

### Kanban
- Move: assignee · institutional teammates (when `equipeId` inst) · DC/Suppléant/PMO · programme-level  
- Mandatory comment on move  

### UI details
- Header shows **Équipe liée** (info only) + Fonctionnelle/Institutionnelle badge  
- Journal d’audit = card list (no horizontal scroll; text wraps)  

### Import RAID CSV
- Script: `scripts/import-raid-csv.ts`  
- Source used: `E:\Bank-Of-Africa\TRANSFO-HUB-DB\20260713\Raid.csv` (66 rows imported locally once)  

---

## v0.4.0 Technique / system (still current)

| Surface | Path | Who |
|---------|------|-----|
| SMTP | `/admin/messagerie` | Admin |
| Import/Purge CSV | `/admin/donnees` | Admin (Ressources, RAID) |
| DB console | `/maintenance/db` | File user `system` |

- Maintenance file: `config/maintenance-user.json` (gitignored)  
- After restore: restart Next.js  

---

## Deploy (VPS Node + PM2 + Nginx)

- Guide: **`DEPLOY.md`**  
- PM2: `ecosystem.config.cjs`  
- Nginx sample: `deploy/nginx-transfohub.conf`  
- Cloud: pull **`origin/main`** (not `master`), then `npm ci` → `db:generate` → `db:migrate` → `build` → `pm2 restart`  
- Collaborative RAID has **no separate menu**: open `/raid` → click a row → `/raid/{id}`  

---

## Functional documentation

- **`docs/DOCUMENTATION_FONCTIONNELLE.md`** — full French functional doc (features + rules)  
- KPI formulas: **`KPIS.txt`**  

---

## Stack hard rules

- No SQLite / better-sqlite3  
- After schema change: migrate + generate + **bump PRISMA_MODEL_STAMP**  
- French UI labels  
- Brand navy/teal/white  

---

## Suggested next work (open)

- Wire product emails via `sendMail()`  
- Align full form `updateRaid` guards with collab matrix  
- Extend Import/Purge to more tables  
- Optional: tag a release after Optimisation-Fonctionnelle (beyond v0.4.0)  
- Production: change maintenance + admin passwords; SMTP  

---

## Key paths

| Concern | Path |
|---------|------|
| Agent rules | `AGENTS.md` |
| This memory | `.grok/MEMORY.md` |
| Functional doc | `docs/DOCUMENTATION_FONCTIONNELLE.md` |
| Deploy | `DEPLOY.md`, `ecosystem.config.cjs` |
| RAID collab | `app/(app)/raid/[id]/`, `lib/raid-collaboration.ts` |
| Equipe helpers | `lib/equipe-chantier.ts`, `lib/equipe-types.ts` |
| Page catalog | `lib/app-pages.ts` |
| Prisma stamp | `lib/prisma.ts` |
