# TransfoHub — Règles de développement

Règles pour les humains et les agents. En cas de conflit : **`AGENTS.md`** + code actuel.

---

## 1. Principes généraux

1. **Ne pas inventer** de fonctionnalités métier non présentes dans le code ou non demandées.  
2. **UI métier en français** (labels, messages, libellés).  
3. **Pas de secrets** dans Git (`.env`, certificats, mots de passe, dumps).  
4. **PostgreSQL only** — interdiction de réintroduire SQLite / better-sqlite3.  
5. Préférer **server components** + **`"use server"` actions** aux routes API inutiles.  
6. Changements **ciblés** : pas de refactor large hors demande.  
7. Respecter la **charte BOA** : navy `#0A3C74`, teal `#00BDBB`.  

---

## 2. Git / branches

```bash
git checkout main
git pull origin main
git checkout -b feature/sujet-court
# ... dev ...
git push -u origin feature/sujet-court
```

- Branche par défaut : **`main`**.  
- Messages de commit : style conventionnel, phrases claires (`feat:`, `fix:`, `chore:`, `docs:`).  
- Ne pas force-push sur `main`.  
- Ne pas committer : `node_modules`, `generated/prisma`, `.env`, `*.db`, uploads avatars, `config/maintenance-user.json`.  

---

## 3. Prisma / base de données

| Étape | Action |
|-------|--------|
| Changer le schéma | Éditer `prisma/schema.prisma` |
| Migration | `npx prisma migrate dev --name description` (dev) ou migration SQL versionnée |
| Client | `npm run db:generate` |
| HMR stale | **Bump** `PRISMA_MODEL_STAMP` dans `lib/prisma.ts` |
| Prod/recette | `npm run db:migrate` (= `prisma migrate deploy`) **sans seed** sauf ordre explicite |

- Factory partagée : `lib/create-prisma.ts`.  
- Singleton app : `lib/prisma.ts` (Proxy + stamp).  
- **`db:seed`** : reseed domaine **destructif** — seulement base de dev vide / accord d’équipe.  

---

## 4. Front / back (pièges Next.js)

| À faire | À éviter |
|---------|----------|
| Labels dans `lib/*-labels.ts` | Hardcoder des rôles métier en dur dans les features |
| `lib/workflow-shared.ts` côté client | Importer `lib/workflow.ts` (Prisma) dans un Client Component |
| `planning-status-rules.ts` côté client | Importer assert Prisma dans le client |
| Actions serveur pour mutations | Exposer des secrets ou `DATABASE_URL` au client |
| `nowMs` passé du serveur aux timelines | `Date.now()` pour des pourcentages SSR (hydratation) |

Fichiers « client-safe » vs serveur : bien séparer pure logique et accès DB.

---

## 5. Domain rules (extraits critiques)

### Dual échéances (Q&A + RAID)

| Champ | Comportement |
|-------|----------------|
| Initiale | Fixée à la création, **non modifiable** ensuite |
| Actualisée | Pilotage ; seule échéance éditable en suivi |
| Fin réelle | À la clôture (statuts terminaux) |
| En retard | Sur **actualisée** (fallback initiale) |

RAID : **pas** de workflow de validation des dates (contrairement aux jalons / Q&A selon config).

### Gantt

- Clip barres : `left`/`right` clampés dans `[0,100]` avant `width`.  
- Portefeuille : pas d’HTML interactif.  
- HTML interactif chantier = **tout** le planning.  

### CSV produit

- Séparateur **`|`** (pipe).  

### Mail

- Uniquement `sendMail()` depuis `lib/mail.ts`.  

---

## 6. UI / composants

- Primitives : `components/ui/*` (shadcn).  
- Features : `components/<feature>-*.tsx`.  
- Formulaires complexes : dialogs larges, sections BOA (comme RAID / jalon).  
- Pas d’images de captures dans les livrables doc générés sauf emplacements demandés.  

---

## 7. Qualité avant de proposer une PR

```bash
npx tsc --noEmit
npm run lint          # si le temps le permet
npm run build         # avant merge sensible / prod
```

Vérifier manuellement le parcours touché (login, écran modifié, droits de rôle).

---

## 8. Rôles & permissions

- Rôles **dynamiques** (`AppRole`) — codes en base, pas une union TypeScript figée.  
- Pages autorisées : JSON `pages` + catalogue `lib/app-pages.ts`.  
- Guards : `requireAuth`, `requirePageAccess`, `requireRole` (legacy + pages).  
- Ne pas hardcoder « si Admin alors… » partout : s’appuyer sur helpers existants (`lib/roles.ts`, `lib/raid-collaboration.ts`, etc.).  

---

## 9. Tests & scripts

- Scripts one-shot : `scripts/*.ts` via `npx tsx`.  
- Smoke workflow : `scripts/smoke-workflow.ts` (si besoin).  
- Seeds de démo (ex. CH_023) : scripts dédiés — lire l’en-tête avant exécution.  

---

## 10. Revue / collaboration

- Expliquer le **pourquoi** métier dans la description de PR.  
- Captures d’écran pour UI sensible.  
- Signaler impacts migrations / droits / perf.  
- Mettre à jour **`.grok/MEMORY.md`** et/ou `docs/CONTEXTE_RECENT.md` si décision durable.  

---

## 11. Ce qu’on ne fait pas

- Pas de force-push sur `main`.  
- Pas de commit de `.env` ou dumps.  
- Pas de seed en production.  
- Pas de contournement des droits RAID / workflow sans design validé.  
- Pas de réintroduction SQLite.  
