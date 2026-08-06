# TransfoHub — Contexte récent (handoff)

**Dernière mise à jour doc :** 2026-08-06  
**Branche de référence :** `main`  
**Version package :** `0.4.0` (+ évolutions post-tag sur `main`)  
**Tag historique important :** `v0.4.0` (SMTP, Import/Purge, maintenance DB)

Ce document résume **ce qui a été fait** pour un nouveau développeur ou un agent IA.  
Le code fait foi : en cas d’écart avec la doc fonctionnelle, **suivre le code**.

---

## 1. Produit (rappel)

**TransfoHub** = tableau de bord PMO (français) pour le programme de transformation bancaire Bank of Africa.

Domaines principaux :
- Chantiers, jalons / workstreams / activités  
- RAID (Risques, Actions, Informations, Décisions)  
- Adhérences, ressources / capacité, comités  
- Consultation Q&A (backlog)  
- Workflow de validation (jalons, etc.)  
- Gantt chantier + Gantt portefeuille  
- Admin : rôles dynamiques, users, SMTP, import/purge CSV  

Marque UI : navy `#0A3C74`, teal `#00BDBB`.

---

## 2. Stack (ne pas régresser)

- **Next.js 16** App Router + **React 19** + TypeScript  
- **Prisma 7** → **PostgreSQL uniquement** (pas de SQLite / better-sqlite3)  
- Auth : iron-session + bcryptjs  
- UI : Tailwind 4, shadcn/Radix  
- Client Prisma généré dans `generated/prisma` (gitignored)  

Après tout changement de schéma Prisma :
1. migration  
2. `npm run db:generate`  
3. **bump `PRISMA_MODEL_STAMP`** dans `lib/prisma.ts`  
4. redémarrer le serveur de dev si besoin  

---

## 3. Livraisons / thèmes récents (2026-07 → 2026-08)

### 3.1 Planning & jalons
- Règles de statuts planning (cascade **Atteint**, dates réelles, cohérence).  
- Split **client-safe** : `lib/planning-status-rules.ts` vs assert serveur `lib/planning-status-assert.ts` (ne pas tirer Prisma côté client).  
- Workflow jalon (DIRECT / VALIDATION / INTERDIT) selon rôles.  
- Import planning Excel/CSV (formats dates **`jj/mm/aaaa`**).  

### 3.2 Gantt
- **Chantier** (`/chantiers/[id]/gantt`) : sticky timeline + colonne structure, ticks semaine, clip des barres, exports **HTML figé** + **HTML interactif** (planning complet hors filtres écran).  
- **Portefeuille** (`/gantt`) : mêmes améliorations écran, export **HTML figé seulement** (pas d’interactif).  
- **Clip barres** : clamp `left`/`right` dans `[0,100]` **avant** le calcul de largeur.  
- Retour navigation Gantt : `?from=jalons` → `/jalons`, `?from=portefeuille` → `/gantt`.  

Fichiers clés :
- `components/chantier-gantt-view.tsx`  
- `components/portfolio-gantt-view.tsx`  
- `lib/gantt-export-html.ts`, `lib/gantt-export-interactive.ts`, `lib/gantt-export-portfolio-html.ts`  

### 3.3 Consultation Q&A
- Échéance **initiale** figée + **actualisée** modifiable + **date de fin réelle** à la clôture.  
- KPI « En retard » sur l’**actualisée**.  
- Dialog de consultation, affectations, modes workflow Q&A.  

### 3.4 RAID
- Collaboration (commentaires, audit, assignation, Kanban).  
- **Même modèle dual échéances** que Q&A (**sans** workflow de dates).  
- Formulaire BOA large, liste compacte, alerte ambre si **échéance initiale** dépassée.  
- Helpers : `lib/raid-labels.ts` (`isRaidOverdue`, `isRaidInitialEcheancePast`, …).  

### 3.5 Admin / technique (v0.4.0 et suites)
- SMTP : `/admin/messagerie`  
- Import/Purge CSV (`|`) : `/admin/donnees`  
- Maintenance DB (user fichier `system`) : `/maintenance/db`  
- Rôles dynamiques + pages : `/admin/roles`  
- Équipes institutionnelles / fonctionnelles  

### 3.6 Déploiement
- Doc serveur : `DEPLOY.md`, `ecosystem.config.cjs`, `deploy/nginx-transfohub.conf`.  
- Scripts shell d’admin temporairement expérimentés puis **retirés du repo** (nettoyage `main`) — le déploiement manuel (zip + `npm ci` / migrate / build / PM2) reste la référence partagée.  

---

## 4. Décisions métier / techniques à ne pas casser

| Sujet | Règle |
|-------|--------|
| Dual échéances Q&A & RAID | Initiale **immutable** après création ; actualisée = pilotage ; fin réelle à clôture |
| En retard | Calcul sur **actualisée** (fallback initiale) |
| Gantt portefeuille | Pas d’export HTML interactif |
| HTML interactif chantier | Export du **planning complet**, pas de la vue filtrée |
| Clip barres Gantt | Clamp L/R avant width |
| Client / serveur | Pas de Prisma / `lib/workflow.ts` dans les composants client |
| CSV produit | Séparateur **pipe `|`** |
| Mail | Uniquement via `sendMail()` (`lib/mail.ts`) |
| RAID.equipeId | `resolveRaidEquipeId` (équipe fonctionnelle si membre du chantier, sinon institutionnelle) |
| Langue UI | **Français** pour libellés métier |

---

## 5. Environnements connus (indicatif)

| Env | Notes |
|-----|--------|
| Dev local | `npm run dev`, Postgres local, `.env` |
| Recette banque | Domaine type `transfohub-recette.eurafric.com`, PM2, Nginx déjà mappé |
| Prod banque | Domaine type `transfohub.eurafric.com`, app souvent sous user applicatif (ex. `admin_keba`), port derrière Nginx (ex. 8000) |
| Cloud demo | Historique VPS (PM2 + Nginx) — voir `DEPLOY.md` |

Ne jamais committer `.env`, dumps DB, certificats, mots de passe.

---

## 6. Où lire ensuite

1. `AGENTS.md`  
2. `.grok/MEMORY.md`  
3. `docs/REGLES_DEVELOPPEMENT.md`  
4. `docs/AGENT_BOOTSTRAP.md` (session IA)  
5. Code des modules touchés (plus fiable que la doc fonctionnelle longue)  

---

## 7. État Git (au moment de la rédaction)

- Remote : `origin/main`  
- Nettoyage : packs shell de déploiement retirés du dépôt (commit de chore sur `main`).  
- Toujours `git pull origin main` avant de brancher.  

Si ce fichier n’a pas été mis à jour depuis longtemps, se fier à **`git log`** et **`.grok/MEMORY.md`**.
