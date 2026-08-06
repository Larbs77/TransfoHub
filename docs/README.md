# Documentation TransfoHub

| Document | Pour qui | Contenu |
|----------|----------|---------|
| [ONBOARDING.md](./ONBOARDING.md) | Nouveau développeur | Installer l’environnement, commandes, checklist J1 |
| [CONTEXTE_RECENT.md](./CONTEXTE_RECENT.md) | Humain + IA | Historique récent, décisions, modules livrés |
| [REGLES_DEVELOPPEMENT.md](./REGLES_DEVELOPPEMENT.md) | Humain + IA | Conventions Git, Prisma, UI, interdits |
| [AGENT_BOOTSTRAP.md](./AGENT_BOOTSTRAP.md) | **Agent IA** | Message d’init + cartes code + règles non négociables |
| [DOCUMENTATION_FONCTIONNELLE.md](./DOCUMENTATION_FONCTIONNELLE.md) | Métier / projet | Doc fonctionnelle (peut être en retard vs code) |

## Racine du dépôt (à lire aussi)

| Fichier | Rôle |
|---------|------|
| `AGENTS.md` | Notes agents / stack / layout / auth / technique |
| `.grok/MEMORY.md` | Mémoire projet durable |
| `DEPLOY.md` | Déploiement serveur (PM2, Nginx, Postgres) |
| `KPIS.txt` | Catalogue KPI |
| `.env.example` | Variables d’environnement |

## Initialiser un collègue + son agent

1. Lui envoyer le lien du repo + **`docs/ONBOARDING.md`**.  
2. Lui demander de lire **`CONTEXTE_RECENT.md`** + **`REGLES_DEVELOPPEMENT.md`**.  
3. Pour son agent IA : coller le bloc de **`AGENT_BOOTSTRAP.md`** en premier message de session, workspace = racine du repo.  

Le **code** prime sur la doc si divergence.

---

## Message type à envoyer au collègue

```text
Bienvenue sur TransfoHub (PMO Bank of Africa).

1) Clone le repo :
   git clone https://github.com/Larbs77/TransfoHub.git
   cd TransfoHub
   git checkout main && git pull

2) Suis le guide d’installation :
   docs/ONBOARDING.md

3) Contexte métier / technique récent (obligatoire) :
   docs/CONTEXTE_RECENT.md
   docs/REGLES_DEVELOPPEMENT.md
   AGENTS.md
   .grok/MEMORY.md

4) Pour ton agent IA (Grok / Cursor / Claude…), dès la 1re session :
   - workspace = racine du repo
   - coller le bloc « Message type » de docs/AGENT_BOOTSTRAP.md
   - puis lui faire lire les fichiers listés dans ce bloc

5) Branche de travail : partir de main, créer feature/… — pas de force-push sur main.
6) Secrets (.env, mots de passe recette/prod) : te les donnerai hors Git.

Index de la doc : docs/README.md
```
