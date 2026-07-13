# TransfoHub — Documentation fonctionnelle

**Application :** TransfoHub (PMO Transformation Bancaire)  
**Éditeur métier :** Bank of Africa  
**Langue interface :** Français  
**Version applicative :** 0.4.0 (+ évolutions sur `main` : RAID collaboratif, équipes institutionnelle/fonctionnelle)  
**Public cible :** Utilisateurs métier, PMO, administrateurs, recette / formation  

Ce document décrit **les fonctionnalités** et **les règles métier** en vigueur dans l’application, telles qu’implémentées.

---

## 1. Objet de l’application

TransfoHub est un **tableau de bord PMO** de pilotage de la transformation bancaire. Il permet de :

- Suivre les **chantiers** (périmètre, avancement, jalons, équipe, budget)
- Gérer le **RAID** (Risques, Actions, Informations, Décisions) de façon collaborative
- Cartographier les **adhérences** inter-chantiers
- Piloter les **ressources**, la **capacité** et la **saisie de temps**
- Organiser les **comités** et les **RMD**
- Produire des **dashboards** et rapports (dont synthèses imprimables)
- Administrer **utilisateurs**, **rôles**, **équipes** et paramètres techniques

---

## 2. Concepts métier fondamentaux

### 2.1 Chantier

Unité de travail du programme (projet / lot). Il porte notamment :

- Identité : code, nom, description, domaine, type, priorité  
- Planning : dates début/fin, durée  
- Budget (JH, MAD, postes)  
- Statut et **avancement %** (calculés à partir des jalons)  
- Équipe chantier (membres)  
- RAID, jalons, adhérences, saisie temps, RMD liés  

### 2.2 Ressource

Personne participant au programme (interne, externe, consultant).  
Peut exister **sans compte applicatif**.

Rattachements :

| Type | Description |
|------|-------------|
| **Équipe institutionnelle** | Organisation banque (hiérarchie RH) — une par ressource |
| **Équipes fonctionnelles** | Équipes programme des chantiers (via affectation chantier) |

### 2.3 Utilisateur (compte applicatif)

Compte de connexion toujours **lié à une Ressource** (1:1).  
Porte le rôle, le mot de passe, le thème, l’avatar, etc.

Règle : un utilisateur **est** une ressource + données d’accès.

### 2.4 Équipes (deux natures)

| Nature | Rôle | Création |
|--------|------|----------|
| **Institutionnelle** | Unité d’organisation de la banque | Catalogue admin (CRUD) |
| **Fonctionnelle** | Équipe programme d’un **chantier** (1:1) | **Automatique** à la création du chantier |

Les membres d’un chantier (`MembreEquipe`) constituent l’équipe fonctionnelle de ce chantier.

### 2.5 RAID

Registre des éléments :

| Type | Usage typique |
|------|----------------|
| **Risque** | Menace avec probabilité × impact |
| **Action** | Tâche à piloter (Kanban, échéance) |
| **Information** | Point d’info |
| **Décision** | Décision à prendre / prise |

Chaque entrée peut être liée à un **chantier**, un **responsable (ressource)**, une **équipe dérivée**, un **comité**.

### 2.6 Jalons

Livrables / étapes par phase :

**Précadrage → Cadrage → Exécution → Clôture**

Ils pilotent l’avancement et le statut du chantier.

### 2.7 Adhérence

Dépendance entre chantiers (source → dépendant), avec criticité et statut.

### 2.8 Comité

Instance de gouvernance (type paramétrable) : date, statut, ODJ, RAID rattachés.

### 2.9 RMD

Référent Métier / Domain (catalogue) pouvant être lié à un ou plusieurs chantiers.

---

## 3. Accès, authentification et profil

### 3.1 Connexion

- Identifiant + mot de passe  
- Rôle **actif** obligatoire  
- Rôles inactifs ou absents : connexion refusée  
- Premier accès possible avec **changement de mot de passe forcé**  

### 3.2 Utilisateur maintenance (système)

- Compte **hors base** (fichier `config/maintenance-user.json`)  
- Accès uniquement à `/maintenance/db` (console critique)  
- **Pas** de navigation applicative métier  
- Mot de passe par défaut de dev **à changer en production**  

### 3.3 Profil personnel (`/profil`)

Accessible via l’avatar / nom dans la barre latérale :

- Identité en lecture seule (hors téléphone)  
- Modification du **téléphone**  
- Changement de **mot de passe**  
- **Mode d’affichage** clair / sombre (préférence compte)  
- Photo de profil (recadrage type LinkedIn)  

### 3.4 Thème

- Toggle sidebar : bascule temporaire de session  
- Préférence compte : appliquée à la connexion suivante  

### 3.5 Charte visuelle

- Couleurs Bank of Africa : marine `#0A3C74`, teal `#00BDBB`  
- Interface en français  

---

## 4. Rôles et permissions

### 4.1 Rôles dynamiques

Les rôles ne sont pas figés dans le code : table **`AppRole`**.

| Attribut | Signification |
|----------|----------------|
| `code` | Clé stockée sur l’utilisateur |
| `label` / `description` / `color` | Affichage |
| `is_active` | Rôle utilisable ou non |
| `is_system` | Rôles seedés (ex. Admin non désactivable) |
| `pages` | Pages autorisées (chemins) |
| `chantier_scope` | Périmètre données chantiers |
| `raid_create_scope` | Droit de **création** RAID |

### 4.2 Périmètre chantiers (`chantier_scope`)

| Valeur | Règle |
|--------|--------|
| **all** | Accès à tous les chantiers |
| **assigned** | Uniquement les chantiers où la ressource de l’utilisateur est membre d’équipe |
| **none** | Pas d’accès données chantier (sauf pages explicitement ouvertes) |

### 4.3 Création RAID (`raid_create_scope`)

| Valeur | Règle |
|--------|--------|
| **none** (défaut) | Ne peut pas créer d’entrées RAID |
| **chantier** | Création uniquement pour les chantiers où il est membre (ressource) |
| **programme** | Création pour tout chantier (ou sans chantier selon le formulaire) |

L’**Administrateur** est toujours traité en **niveau Programme** pour la création.

### 4.4 Rôles système seedés (exemples)

| Code | Libellé typique | Orientation |
|------|-----------------|-------------|
| `Admin` | Administrateur | Accès complet |
| `Programme_Office` | Bureau Programme | Pilotage programme |
| `PMO_Chantier` | PMO Chantier | Chantiers assignés |
| `Workforce_Manager` | Gestionnaire Ressources | Ressources / capacité |

Des rôles **personnalisés** peuvent être créés (pages + scopes).

### 4.5 Pages (catalogue navigation)

| Section | Pages |
|---------|--------|
| **Général** | Tableau de bord, Mon Tableau de bord |
| **Suivi opérationnel** | Chantiers, Adhérences, RAID, Jalons, Saisie temps, Backlog Q&A, Favoris |
| **Gouvernance** | Comités, Dashboards, RMD, Calendrier |
| **Ressources** | Ressources, Profils, Capacité |
| **Administration** | Utilisateurs, Rôles, Équipes, Paramètres comités, Paramètres |
| **Technique** | Serveur de messagerie, Import / Purge |

La navigation n’affiche que les pages accordées au rôle.  
L’Admin voit toutes les pages.

---

## 5. Modules fonctionnels

### 5.1 Tableau de bord (accueil)

KPIs programme (selon périmètre rôle), dont notamment :

- **Lancés / total** : chantiers dont le statut ≠ « Non démarré » / total  
- Indicateurs RAID, jalons, alertes  
- Timeline chantiers (priorités, marqueurs Jan / Jul / **Auj.**)  

Formules détaillées : fichier **`KPIS.txt`**.

### 5.2 Mon Tableau de bord

Vue **personnelle** centrée sur la **ressource** liée au compte :

- KPIs personnels  
- Équipes (hiérarchique + fonctionnelles)  
- Chantiers dont je suis membre  
- RAID (moi / équipes & chantiers)  
- Capacité personnelle  
- Saisie de temps en **lecture seule** (timeline)  

Filtres : chantier, équipe, bascule Mon RAID / RAID équipes & chantiers.

### 5.3 Chantiers

**Liste** filtrable, favoris, accès selon `chantier_scope`.

**Fiche chantier** (onglets typiques) :

- Vue générale / description  
- **Équipe** (par lot AMOA, MOE, PMO, etc.)  
- RAID  
- Jalons  
- Capacité / burn rate  
- Adhérences  
- Consultation Q&A  
- KPI  
- Synthèse PDF  

#### Règles équipe chantier

- Tout membre doit être une **Ressource** existante (sélection obligatoire).  
- Pas de saisie libre « Nom prénom » pour l’identité : le nom vient de la ressource.  
- Champ **commentaires** optionnel sur l’affectation.  
- Un **directeur de chantier** peut être désigné (`is_directeur`).  
- Charge % par membre.  
- L’affectation alimente l’**équipe fonctionnelle** du chantier.

#### Règles avancement / statut

- Recalculés à partir des **jalons** et des **poids de phase** (Paramètres).  
- Phases : Précadrage, Cadrage, Exécution, Clôture.  
- Statut « Clôturé » lorsque tous les jalons de phase Clôture sont « Atteint ».

### 5.4 RAID

#### Registre (`/raid` et sous-pages par type)

- Vues Tableau / **Kanban** (Actions) / Calendrier  
- Filtres Mon RAID / RAID Équipes & Chantiers  
- Clic sur une ligne → **page détail collaborative** `/raid/{id}`  

#### Création

Soumise à `raid_create_scope` (voir § 4.3).

#### Assignation d’équipe (dérivée, automatique)

Lorsqu’un responsable (ressource) est positionné :

| Situation | Équipe liée au RAID (`equipeId`) |
|-----------|-----------------------------------|
| La personne est **membre** du chantier du RAID | Équipe **fonctionnelle** du chantier |
| Sinon | Équipe **institutionnelle** (hiérarchie) de la personne |
| Désassignation | Plus d’équipe liée |

#### Visibilité liste (hors Admin / périmètre « all »)

Une entrée RAID est visible si au moins une condition :

- Son chantier est dans le périmètre de l’utilisateur, **ou**  
- Elle est **assignée** à sa ressource, **ou**  
- Son `equipeId` correspond à l’équipe **institutionnelle** de l’utilisateur  

#### Collaboration — page détail

Fonctions :

- Conversation (commentaires)  
- Changement de statut (**commentaire obligatoire**)  
- Assigner / réassigner (selon droits)  
- Auto-assignation  
- Circulation (timeline)  
- Journal d’audit  

**Qui peut collaborer** (commentaire, statut, auto-assign si non assigné) :

- Admin / Bureau Programme (rôle ou équipe institutionnelle « Bureau Programme »)  
- Le **responsable** assigné  
- Tout **membre** de l’équipe du chantier lié  
- Toute personne de la **même équipe institutionnelle** que le responsable  
- Toute personne rattachée à l’**équipe dérivée** du RAID (`equipeId`)  

**Auto-assignation** :

- Possible si l’utilisateur a un droit de collaboration  
- Si l’entrée est **déjà assignée à un tiers**, seule une personne autorisée à **réassigner** peut la reprendre  

**Qui peut assigner / réassigner** :

| Acteur | Périmètre |
|--------|-----------|
| Admin | Tous les RAID |
| Rôle Bureau Programme | Tous les RAID |
| Membre de l’équipe institutionnelle « Bureau Programme » | Tous les RAID |
| Directeur de chantier, Suppléant, PMO **sur le chantier** | Uniquement les RAID **liés à ce chantier** |

Les autres utilisateurs **ne réassignent pas**.

#### Kanban Actions

- Déplacement réservé à : assigné, collègues d’équipe institutionnelle (si RAID institutionnel), DC / Suppléant / PMO du chantier, Admin / Programme  
- **Commentaire obligatoire** à chaque déplacement de statut  
- Cartes non autorisées en lecture seule  

### 5.5 Jalons

- Gestion par chantier et vue globale  
- Statuts (ex. Planifié, En cours, Atteint, Annulé…)  
- Impact direct sur avancement chantier  
- Templates de jalons côté paramètres  

### 5.6 Adhérences

- Registre des interfaces / dépendances  
- Graphe de dépendances  
- Criticité, statut, chantiers source / dépendant  

### 5.7 Saisie de temps

- Saisie hebdomadaire (jours travaillés par ressource / chantier)  
- Sur **Mon Tableau de bord** : affichage **lecture seule** (timeline)  
- La saisie opérationnelle est portée par les profils autorisés (PMO / programme)  

### 5.8 Backlog consultation (Q&A)

- Questions / réponses liées aux chantiers  
- Priorités, statuts, échéances  
- Alertes selon seuils (paramètres)  

### 5.9 Favoris

- Marquage de chantiers favoris  
- Filtrage dans la navigation / listes  

### 5.10 Comités

- Instances de gouvernance planifiées  
- Types d’instance gérés en admin (**Paramètres comités**)  
- Lien possible avec éléments RAID  
- Fréquence, propriétaire (équipe institutionnelle)  

Règles catalogue types de comité :

- Propriétaire = équipe du catalogue  
- Renommage d’équipe peut propager le libellé propriétaire  
- Suppression d’un type bloquée s’il reste des réunions rattachées (préférence : désactivation)  

### 5.11 Dashboards CTP / CTR

- Vues de gouvernance (indicateurs programme, risques, SPI/CPI approximés, etc.)  
- Formules : voir `KPIS.txt`  

### 5.12 RMD

- Catalogue des référents métier / domain  
- Association multi-chantiers  

### 5.13 Calendrier

- Vue consolidée des échéances (RAID, comités, etc. selon contenu)  

### 5.14 Ressources

- CRUD ressources (droits selon rôles)  
- Équipe institutionnelle **obligatoire**  
- Équipes fonctionnelles (chantiers) affichables / éditables  
- Création de **compte applicatif** (Admin) pour une ressource existante  
- Détail ressource : chantiers, RAID, capacité  

### 5.15 Profils ressources

- Catalogue de profils (type + TJM par défaut, etc.)  
- Utilisés à la création / édition de ressources  

### 5.16 Capacité

- Charge planifiée vs capacité  
- Heatmap, RAG (Disponible / Chargé / Surchargé / Non alloué)  
- Vision globale et par ressource  

### 5.17 Administration

| Écran | Fonction |
|-------|----------|
| **Utilisateurs** | Comptes, rôles, profils, lien ressource |
| **Rôles** | Pages, scopes chantier & création RAID, activation |
| **Équipes** | Institutionnelles (CRUD) + Fonctionnelles (liées chantiers, auto) |
| **Paramètres comités** | Types d’instances |
| **Paramètres** | Poids phases, seuils alertes, workflows de statuts |

### 5.18 Technique

| Écran | Fonction |
|-------|----------|
| **Messagerie** | Configuration SMTP (mot de passe chiffré), test d’envoi |
| **Import / Purge** | CSV pipe `\|` pour **Ressources** et **RAID** ; modes append / replace ; purge sécurisée |

### 5.19 Maintenance DB (`/maintenance/db`)

Réservé à l’utilisateur **system** fichier :

- Export dump JSON, SQL, ZIP CSV  
- Import truncate / drop  
- Opérations critiques avec confirmation  

### 5.20 Rapports imprimables

- Synthèse chantier (PDF / impression)  
- Batch rapports  
- Météo chantier (vert / orange / rouge) selon jalons, risques, écart planning  

---

## 6. Règles métier transverses

### 6.1 Criticité risque

```
score = impact × probabilité   (chacun 1–5 → score 1–25)
```

| Score | Libellé typique |
|-------|-----------------|
| ≤ 3 | Négligeable |
| ≤ 6 | Mineur |
| ≤ 10 | Modéré |
| ≤ 15 | Majeur |
| > 15 | Critique |

Seuils dashboards : ≥ 12 (majeur), ≥ 15 (critique météo), ≥ 20 (bloquant CTP/CTR).

### 6.2 Avancement chantier

Pour chaque phase ayant des jalons :

```
progress_phase = (jalons Atteint / jalons de la phase) × poids_phase
avancement = arrondi(somme des progress_phase)
```

Poids par défaut (paramétrables) : Précadrage 10 %, Cadrage 20 %, Exécution 50 %, Clôture 20 %.

### 6.3 Identité des personnes

- Source de vérité : **Ressource** (nom, email, téléphone…)  
- Utilisateur : synchronisé pour l’identité liée  
- Membre d’équipe chantier : **toujours** une ressource  

### 6.4 Suppression / purge

- Purge Ressources : nettoyage saisies, détachement users / RAID / membres  
- Purge / replace CSV : sauvegarde forcée si table non vide + confirmation  
- Seed métier : **destructif** sur le domaine (à éviter en production)  

### 6.5 CSV métier

- Séparateur **pipe `|`**  
- Champs système `id`, `createdAt`, `updatedAt` non importés en import métier standard  

---

## 7. Matrice synthétique des droits RAID

| Action | Admin / Bureau Programme | DC / Suppléant / PMO chantier | Assigné | Membre chantier | Collègue équipe institutionnelle (hors chantier) |
|--------|--------------------------|-------------------------------|---------|-----------------|--------------------------------------------------|
| Voir (liste / détail selon règles) | Oui | Oui (périmètre) | Oui | Oui | Oui si même équipe institutionnelle que l’assigné (et `equipeId`) |
| Créer | Selon `raid_create_scope` (Admin = programme) | Selon scope rôle | Selon scope | Selon scope | Selon scope |
| Commenter / changer statut | Oui | Oui (si collab) | Oui | Oui | Oui (si collab) |
| Auto-assign (si libre) | Oui | Oui (si collab) | — | Oui (si collab) | Oui (si collab) |
| Assigner / réassigner | **Oui (tous)** | **Oui (RAID de son chantier)** | Non | Non | Non |
| Kanban déplacer | Oui | Oui (leadership chantier) | Oui | Non* | Oui si RAID institutionnel lié |

\*Sauf si aussi leadership ou assigné.

---

## 8. Parcours utilisateurs types

### 8.1 Administrateur

Configure rôles, utilisateurs, équipes institutionnelles, SMTP, import/purge, paramètres ; accès total aux chantiers et RAID.

### 8.2 Bureau Programme

Pilote le portefeuille, comités, dashboards, réaffectation RAID globale, vision transverse.

### 8.3 PMO / Directeur de chantier

Travaille sur ses chantiers, anime l’équipe, gère jalons et RAID du chantier, réassigne les RAID du chantier (si DC / Suppléant / PMO).

### 8.4 Contributeur (ressource avec compte)

Consulte Mon Tableau de bord, ses RAID, commente / change statut sur les entrées autorisées, auto-s’assigne si non assigné.

### 8.5 Gestionnaire de ressources

Administre ressources, profils, capacité, saisie temps (selon pages).

### 8.6 Maintenance système

Export / import base uniquement via console dédiée.

---

## 9. Indicateurs et documents de référence

| Document / zone | Contenu |
|-----------------|---------|
| `KPIS.txt` | Catalogue complet des formules KPI |
| `docs/DOCUMENTATION_FONCTIONNELLE.md` | Ce document |
| `DEPLOY.md` | Déploiement technique (serveur) |
| `AGENTS.md` | Notes techniques pour l’équipe de dev |

---

## 10. Glossaire

| Terme | Définition |
|-------|------------|
| **TransfoHub** | Application PMO de transformation bancaire |
| **Chantier** | Projet / lot du programme |
| **RAID** | Risque, Action, Information, Décision |
| **Ressource** | Personne du programme |
| **Équipe institutionnelle** | Structure organisationnelle banque |
| **Équipe fonctionnelle** | Équipe programme d’un chantier |
| **RMD** | Référent métier / domain |
| **PMO** | Project / Programme Management Office |
| **Avancement** | % de progression du chantier issu des jalons |
| **Criticité** | impact × probabilité d’un risque |

---

## 11. Historique du document

| Date | Évolution |
|------|-----------|
| 2026-07-13 | Version initiale consolidée (rôles, RAID collaboratif, équipes, règles d’accès) |

---

*Document généré à partir du comportement applicatif TransfoHub (code et règles en production sur la branche `main`).*
