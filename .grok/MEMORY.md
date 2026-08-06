# TransfoHub — project memory (workspace)

Last updated: **2026-08-06** · package **0.4.0+** · branch **`main`**

This file is for **agents and humans** working on TransfoHub. Canonical product rules also live in **`AGENTS.md`**.  
**New developer / agent handoff:** `docs/ONBOARDING.md`, `docs/CONTEXTE_RECENT.md`, `docs/REGLES_DEVELOPPEMENT.md`, `docs/AGENT_BOOTSTRAP.md`.  
Functional docs: **`docs/DOCUMENTATION_FONCTIONNELLE.md`**. Deploy: **`DEPLOY.md`**.

---

## Project identity

| Item | Value |
|------|--------|
| Name | TransfoHub / PMO Transformation Bancaire |
| Remote | `https://github.com/Larbs77/TransfoHub.git` |
| Local path | `E:\Bank-Of-Africa\TransfoHub` |
| **main** | See `git log -1` — handoff docs added 2026-08-06; deploy shell packs removed from repo |
| Tag released | `v0.4.0` (SMTP, Import/Purge, system DB maintenance) |
| UI language | **French** |
| Brand | Bank of Africa navy `#0A3C74` + teal `#00BDBB` |
| Local DB (often) | PostgreSQL **`transfohuDB`** / `transfodb` |

---

## Stack (do not regress)

- Next.js 16 App Router + React 19 + TypeScript  
- Prisma 7 → **PostgreSQL only** — **no SQLite / better-sqlite3**  
- Auth: iron-session + bcryptjs  
- Mail: `sendMail()` from `lib/mail.ts`  
- CSV product format: **pipe `|`**  

**Prisma stamp:** bump `PRISMA_MODEL_STAMP` in `lib/prisma.ts` after every schema change.  
**Current stamp:** `raid-echeance-actualisee-v1`

**Client vs server:** never import `lib/workflow.ts` / Prisma into client components — use `lib/workflow-shared.ts` / pure helpers.

---

## Dual échéances (Q&A + RAID) — decision 2026-08

Same pattern on **ConsultationQuestion** and **Raid** (RAID **without** workflow):

| Field (Q&A / RAID) | Role |
|--------------------|------|
| Initiale (`echeance` / `date_echeance`) | Set at **create**, **immutable** after (engagement) |
| Actualisée (`echeance_actualisee` / `date_echeance_actualisee`) | Copy of initiale at create; **only** editable pilot date |
| Fin réelle (`date_fin_reelle`) | Set on terminal status (Résolue/Abandonnée Q&A; Clôturé/Clos/Abandonné/Validée/… RAID) |

- **KPI / « En retard »** = based on **actualisée** (fallback initiale).  
- RAID list: under intitulé, if **initiale** past and not closed → amber `AlertTriangle` + « Échéance initiale dd/MM/yy · dépassée » (same style as planning coherence).  
- Helpers: `isQuestionEnRetard` (`lib/consultation-labels.ts`), `isRaidOverdue` / `isRaidInitialEcheancePast` / `raidEffectiveEcheance` (`lib/raid-labels.ts`).  
- Migrations: `20260805190000_qa_echeance_actualisee`, `20260805210000_raid_echeance_actualisee`.

---

## Gantt

### Chantier (`/chantiers/[id]/gantt`)
- Sticky header + structure column; week ticks `dd/MM` + `Sxx`; bar **clip** (clamp left/right in `[0,100]` before width).  
- Jalon bars + diamond in screen and HTML exports.  
- Export **HTML figé** (WYSIWYG filtered view) + **HTML interactif** (full plan offline, not filtered).  
- Both HTML modes: sticky first row + first column.  
- Filters toolbar 2 lines: (1) Du/Au, Trimestre en cours, scale, contenu période, Aujourd’hui, Ajuster; (2) Jalons/WS/Act, déplier/replier, exports.  
- Back nav: `?from=jalons` → `/jalons`; `?from=portefeuille` → `/gantt`.  
- Files: `components/chantier-gantt-view.tsx`, `lib/gantt-export-html.ts`, `lib/gantt-export-interactive.ts`.

### Portefeuille (`/gantt`)
- Same UX improvements as chantier **except interactive HTML** (not needed).  
- Export **HTML figé** only via `lib/gantt-export-portfolio-html.ts` (scale snapshot before dynamic import; filename includes scale).  
- `components/portfolio-gantt-view.tsx`.  
- Migration roles: `20260805120000_grant_portfolio_gantt_default_roles`.

### Bar clip rule (critical)
Always clamp `left`/`right` to `[0,100]` **before** computing width — otherwise bars overshoot when start is outside the window.

---

## Planning jalons / workstreams / activités

- Status rules split: pure rules `lib/planning-status-rules.ts`, server assert `lib/planning-status-assert.ts` (client must not pull Prisma).  
- Cascade **Atteint**, clear `date_reelle` rules, coherence `lib/planning-coherence.ts`.  
- WS/activité real date field: migration `20260805200000_ws_activite_date_reelle`.  
- Import Excel/CSV planning: admin données + scripts; date format **`jj/mm/aaaa`**.  
- Chantiers tab order pattern: **Chantiers | Ressources | RAID** where applicable.

---

## Consultation Q&A

- Backlog + chantier tab; view dialog `components/consultation-question-view-dialog.tsx`.  
- Affectation helpers `lib/consultation-affectation.ts`.  
- Workflow modes for Q&A: migration `20260805180000_qa_workflow_modes`.  
- Seed sample: `scripts/seed-ch023-qa-questions.ts` (CH_023).

---

## RAID

### Collaboration (unchanged principles)
- List `/raid` → detail `/raid/[id]`.  
- Comments + audit; status change requires comment.  
- Assign: Admin / Bureau Programme any; DC/Suppléant/PMO on linked chantier only.  
- `RAID.equipeId` via `resolveRaidEquipeId` (func if member of chantier, else institutional).

### Form & list (2026-08)
- Dialog BOA-styled, wide (~68rem), sections Identification / Rattachement / Risque / Pilotage.  
- Table: `table-fixed`, compact columns, dates `dd/MM/yy`, header **Identification** (not bare « Date »).  
- Seed demo RAID: `scripts/seed-ch023-raids.ts` (20 mixed types on CH_023).

---

## Équipes (institutionnelle vs fonctionnelle)

| Type | Meaning | Creation |
|------|---------|----------|
| `institutionnelle` | Bank org unit; `Ressource.equipeHierarchieId` | Admin `/admin/equipes` |
| `fonctionnelle` | Chantier team 1:1 (`Equipe.chantierId`) | Auto on chantier create |

Helpers: `lib/equipe-types.ts`, `lib/equipe-chantier.ts`.

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

- Guide: **`DEPLOY.md`** · PM2 `ecosystem.config.cjs` · Nginx `deploy/nginx-transfohub.conf`  
- Cloud: pull **`origin/main`** → `npm ci` → `db:generate` → `db:migrate` → `build` → `pm2 restart`  

---

## Key migrations (recent)

| Migration | Topic |
|-----------|--------|
| `…_grant_portfolio_gantt_default_roles` | Page `/gantt` on default roles |
| `…_qa_workflow_modes` | Q&A workflow modes |
| `…_qa_echeance_actualisee` | Q&A dual échéances + fin réelle |
| `…_ws_activite_date_reelle` | Workstream/activité real dates |
| `…_raid_echeance_actualisee` | RAID dual échéances + fin réelle |

---

## Suggested next work (open)

- Wire product emails via `sendMail()` for RAID / workflow notifications  
- Extend Import/Purge to more tables  
- Tag a release beyond `v0.4.0` when ready  
- Production: rotate maintenance + admin passwords; SMTP  

---

## Key paths

| Concern | Path |
|---------|------|
| Agent rules | `AGENTS.md` |
| This memory | `.grok/MEMORY.md` |
| Functional doc | `docs/DOCUMENTATION_FONCTIONNELLE.md` |
| Deploy | `DEPLOY.md`, `ecosystem.config.cjs` |
| Gantt chantier | `components/chantier-gantt-view.tsx`, `lib/gantt-export-*.ts` |
| Gantt portefeuille | `components/portfolio-gantt-view.tsx`, `lib/gantt-export-portfolio-html.ts` |
| RAID | `components/raid-list.tsx`, `raid-form-dialog.tsx`, `app/(app)/raid/[id]/` |
| Q&A | `components/consultation-*`, `lib/consultation-*.ts` |
| Planning rules | `lib/planning-status-rules.ts`, `lib/planning-status-assert.ts` |
| Prisma stamp | `lib/prisma.ts` |
