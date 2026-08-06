# TransfoHub — Bootstrap agent IA

**À charger en début de session** (fichier projet + règles).  
Objectif : initialiser un agent (Grok, Claude, Cursor, etc.) avec le bon contexte sans attendre une conversation longue.

---

## Message type à coller dans le chat agent

```text
Tu travailles sur TransfoHub (Bank of Africa), monorepo Next.js PMO.

Lis dans cet ordre et applique strictement :
1. AGENTS.md
2. .grok/MEMORY.md
3. docs/AGENT_BOOTSTRAP.md (ce fichier)
4. docs/CONTEXTE_RECENT.md
5. docs/REGLES_DEVELOPPEMENT.md

Règles non négociables :
- PostgreSQL only (jamais SQLite / better-sqlite3)
- UI métier en français
- Après schéma Prisma : migrate + db:generate + bump PRISMA_MODEL_STAMP dans lib/prisma.ts
- Ne pas importer lib/workflow.ts ni Prisma dans un Client Component
- CSV produit = séparateur pipe |
- Mail uniquement via sendMail() (lib/mail.ts)
- Dual échéances Q&A et RAID : initiale figée, actualisée éditable, retard = actualisée
- Gantt : clip barres (clamp L/R avant width) ; portefeuille sans HTML interactif
- Pas de secrets dans le git ; pas de seed en prod
- Changements ciblés ; ne pas inventer de features hors code / hors demande

Stack : Next.js 16 + React 19 + Prisma 7 + PostgreSQL.
Remote : https://github.com/Larbs77/TransfoHub.git — branche main.
```

---

## Identité projet

| Item | Valeur |
|------|--------|
| Nom | TransfoHub / PMO Transformation Bancaire |
| Langue UI | Français |
| Brand | `#0A3C74` navy, `#00BDBB` teal |
| Package | `0.4.0` (+ commits post-tag sur `main`) |
| Tag référence | `v0.4.0` |

---

## Stack & commandes

```bash
npm ci
cp .env.example .env   # DATABASE_URL postgres + SESSION_SECRET ≥ 32 chars
npm run db:generate
npm run db:migrate
# npm run db:seed    # DEV ONLY — destructif métier
npm run dev
npx tsc --noEmit
```

---

## Cartographie code (où chercher)

| Besoin | Où |
|--------|-----|
| Actions serveur bulk | `app/(app)/actions.ts` |
| Auth / session | `lib/auth.ts` |
| Rôles / pages | `lib/roles.ts`, `lib/app-pages.ts` |
| Prisma app | `lib/prisma.ts`, `lib/create-prisma.ts` |
| RAID collab | `lib/raid-collaboration.ts`, `app/(app)/raid/[id]/` |
| RAID UI | `components/raid-list.tsx`, `raid-form-dialog.tsx` |
| Q&A | `components/consultation-*`, `lib/consultation-*` |
| Gantt chantier | `components/chantier-gantt-view.tsx` |
| Gantt portefeuille | `components/portfolio-gantt-view.tsx` |
| Exports HTML Gantt | `lib/gantt-export-*.ts` |
| Workflow (serveur) | `lib/workflow.ts` |
| Workflow (client-safe) | `lib/workflow-shared.ts` |
| Planning rules (client-safe) | `lib/planning-status-rules.ts` |
| Labels métier | `lib/*-labels.ts` |

---

## Décisions récentes (résumé)

1. **Dual échéances** (Q&A + RAID) : initiale / actualisée / fin réelle.  
2. **Gantt** polish + exports ; portefeuille **sans** HTML interactif.  
3. **Clip barres** Gantt obligatoire.  
4. **Planning** : rules/assert séparés (pas de Prisma côté client).  
5. **Scripts shell deploy** expérimentaux : **retirés du repo** — déploiement manuel documenté dans l’historique de collab / `DEPLOY.md`.  

Détail : `docs/CONTEXTE_RECENT.md` + `.grok/MEMORY.md`.

---

## Interdits rapides

- SQLite  
- Seed en production  
- Secrets commités  
- Force-push `main`  
- Import Prisma / workflow serveur dans `"use client"`  
- Inventer des écrans ou règles métier absentes du code  

---

## Checklist agent avant de coder

- [ ] Branche depuis `main` à jour  
- [ ] Fichiers lus : AGENTS + MEMORY + ce bootstrap  
- [ ] Scope de la demande clair (pas de scope creep)  
- [ ] Si schéma touché : plan migration + stamp  
- [ ] `tsc --noEmit` après changements TS non triviaux  

---

## Setup humain associé

Voir **`docs/ONBOARDING.md`** pour clone, Postgres, seed, premier login.
