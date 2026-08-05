/**
 * Remplacement contrôlé des plannings stratégiques CH_016 (CRM) et CH_023 (CBS).
 *
 * - sauvegarde JSON préalable dans le répertoire temporaire du système ;
 * - suppression + recréation atomiques par chantier ;
 * - nouveaux identifiants pour les jalons, workstreams et activités ;
 * - dates de début des jalons calculées depuis leur arborescence.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrismaClient } from "../lib/create-prisma";
import {
  CH023_PLANNING,
  type JalonSeed,
  type Ws,
} from "./seed-ch023-planning";

const prisma = createPrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

function ws(
  nom: string,
  ordre: number,
  date_debut: string,
  date_fin: string,
  activites: [string, string, string][],
  statut = "Planifié"
): Ws {
  return {
    nom,
    ordre,
    date_debut,
    date_fin,
    statut,
    activites: activites.map(([activityName, start, end], index) => ({
      nom: activityName,
      ordre: index + 1,
      date_debut: start,
      date_fin: end,
      statut,
    })),
  };
}

const CH016_PLANNING: JalonSeed[] = [
  {
    phase: "Précadrage",
    nom: "J0 | Programme CRM mobilisé et gouvernance installée",
    ordre: 1,
    date_cible: "2026-01-20",
    description: "Mandat, gouvernance, ambition de valeur et dispositif de delivery CRM.",
    workstreams: [
      ws("1 | Gouvernance et mobilisation", 1, "2026-01-01", "2026-01-12", [
        ["Nomination du sponsor, du directeur de programme et du PMO", "2026-01-01", "2026-01-05"],
        ["Installation du COPIL, du design authority et des instances métier", "2026-01-04", "2026-01-09"],
        ["Validation du RACI, des délégations et des règles d'escalade", "2026-01-07", "2026-01-12"],
      ]),
      ws("2 | Ambition CRM et création de valeur", 2, "2026-01-05", "2026-01-16", [
        ["Formalisation de l'ambition Customer 360 et omnicanale", "2026-01-05", "2026-01-09"],
        ["Définition des résultats clients et commerciaux attendus", "2026-01-07", "2026-01-13"],
        ["Construction de la première arborescence de KPI de valeur", "2026-01-10", "2026-01-16"],
      ]),
      ws("3 | Plan directeur et maîtrise des risques", 3, "2026-01-08", "2026-01-20", [
        ["Construction de la macro-roadmap sélection, build et déploiement", "2026-01-08", "2026-01-14"],
        ["Identification des dépendances CBS, MDM, digital et centre de relation client", "2026-01-10", "2026-01-17"],
        ["Validation des risques initiaux et des plans de mitigation", "2026-01-15", "2026-01-20"],
      ]),
    ],
  },
  {
    phase: "Cadrage",
    nom: "A | Objectiver la couverture des besoins technico-fonctionnels",
    ordre: 2,
    date_cible: "2026-02-15",
    description: "Objectivation top-down et bottom-up de la couverture CRM et des écarts structurants.",
    workstreams: [
      ws("1 | Analyse à plat technico-fonctionnelle (top-down)", 1, "2026-01-12", "2026-01-31", [
        ["Consolidation et normalisation des réponses éditeurs dans une grille comparable", "2026-01-12", "2026-01-20"],
        ["Analyse de la couverture par exigence technico-fonctionnelle", "2026-01-18", "2026-01-27"],
        ["Pour les exigences non couvertes, identification des must have [as-is] et décision du plan d'action", "2026-01-25", "2026-01-31"],
        ["Production de la heatmap de couverture par parcours et canal", "2026-01-27", "2026-01-31"],
      ]),
      ws("2 | Affinement des besoins (bottom-up) — backlog priorisé jusqu'au niveau EPIC, co-construit", 2, "2026-01-15", "2026-02-07", [
        ["Enrichissement du backlog fonctionnel (incl. existant et future)", "2026-01-15", "2026-01-27"],
        ["Construction du backlog technique (incl. architecture; existant et future)", "2026-01-20", "2026-02-01"],
        ["Consolidation du backlog technico-fonctionnel et priorisation", "2026-01-27", "2026-02-05"],
        ["Validation du MVP et des EPIC différenciants par les métiers", "2026-02-02", "2026-02-07"],
      ]),
      ws("3 | Fit/gap - couverture & qualification des écarts", 3, "2026-01-28", "2026-02-15", [
        ["Croisement de la couverture des éditeurs avec le backlog technico-fonctionnel consolidé", "2026-01-28", "2026-02-05"],
        ["Analyse du fit / gap à date", "2026-02-03", "2026-02-09"],
        ["Consolidation et formalisation des demandes finales aux éditeurs", "2026-02-08", "2026-02-13"],
        ["Qualification Adopt / Adapt / Build et impacts sur le time-to-market", "2026-02-10", "2026-02-15"],
      ]),
    ],
  },
  {
    phase: "Cadrage",
    nom: "B | Comparer le coût complet de possession (TCO)",
    ordre: 3,
    date_cible: "2026-03-08",
    description: "Comparaison économique transparente des scénarios CRM sur cinq ans.",
    workstreams: [
      ws("4 | Modélisation d'un TCO paramétrable", 1, "2026-02-01", "2026-02-16", [
        ["Modélisation du TCO propre au chantier", "2026-02-01", "2026-02-08"],
        ["Revue des hypothèses et validation finale par le programme (si applicable)", "2026-02-07", "2026-02-12"],
        ["Partage aux éditeurs du TCO à remplir (si applicable)", "2026-02-11", "2026-02-16"],
      ]),
      ws("5 | Premier échange avec les éditeurs", 2, "2026-02-10", "2026-02-23", [
        ["Envoi des questions fonctionnelles et techniques aux éditeurs", "2026-02-10", "2026-02-13"],
        ["Réception de toutes les réponses aux questions technico-fonctionnelles des éditeurs", "2026-02-13", "2026-02-20"],
        ["Clôture de la notation technique", "2026-02-19", "2026-02-22"],
        ["Ouverture des plis financiers", "2026-02-22", "2026-02-23"],
      ]),
      ws("6 | Deuxième échange avec les éditeurs - Analyses financières (sensibilité, CAPEX/OPEX)", 3, "2026-02-20", "2026-03-03", [
        ["Réalisation des analyses de sensibilité", "2026-02-20", "2026-02-25"],
        ["Projection et décomposition des coûts CAPEX/OPEX", "2026-02-22", "2026-02-27"],
        ["Retour vers les éditeurs avec des questions financières", "2026-02-26", "2026-02-28"],
        ["Analyse du retour des éditeurs sur les questions financières", "2026-02-28", "2026-03-03"],
      ]),
      ws("7 | Business case par décision structurante (ex. Adopt / Adapt / Build) avec évaluation économique", 4, "2026-02-25", "2026-03-08", [
        ["Évaluation économique des scénarios Adopt / Adapt / Build", "2026-02-25", "2026-03-02"],
        ["Comparaison NPV, payback, TCO cinq ans et coûts de sortie", "2026-02-28", "2026-03-05"],
        ["Validation des hypothèses de revenus, productivité et adoption", "2026-03-03", "2026-03-08"],
      ]),
    ],
  },
  {
    phase: "Cadrage",
    nom: "C | Sécuriser la sélection",
    ordre: 4,
    date_cible: "2026-04-05",
    description: "Décision documentée, arbitrages explicites et conditions de succès sécurisées.",
    workstreams: [
      ws("8 | Evaluation comparative objectivée des offres", 1, "2026-03-01", "2026-03-13", [
        ["Consolidation comparative des évaluations technico-fonctionnelles et financières", "2026-03-01", "2026-03-08"],
        ["Construction de la scorecard finale et du classement multicritère", "2026-03-06", "2026-03-11"],
        ["Revue indépendante en quatre yeux des notations", "2026-03-10", "2026-03-13"],
      ]),
      ws("9 | Arbitrage des écarts - positions Adopt/Adapt/Build & impacts coûts/délais/risques", 2, "2026-03-08", "2026-03-23", [
        ["Instruction des dossiers d'arbitrages", "2026-03-08", "2026-03-16"],
        ["Formalisation de la version finale des arbitrages à intégrer au dossier de décision", "2026-03-15", "2026-03-21"],
        ["Chiffrage des impacts coûts, délais, architecture et risques", "2026-03-17", "2026-03-23"],
      ]),
      ws("10 | Pre-negotiation", 3, "2026-03-18", "2026-03-30", [
        ["Préparation des réunions de pre-negotiation", "2026-03-18", "2026-03-23"],
        ["Réunions de pre-negotiation", "2026-03-23", "2026-03-28"],
        ["Formalisation des engagements et concessions obtenus", "2026-03-27", "2026-03-30"],
      ]),
      ws("11 | Dossier de décision synthétique par chantier", 4, "2026-03-22", "2026-04-05", [
        ["Formalisation du scénario de décision", "2026-03-22", "2026-03-27"],
        ["Formalisation de la note de décision synthétique", "2026-03-25", "2026-03-31"],
        ["Consolidation du dossier de décision", "2026-03-29", "2026-04-03"],
        ["Syndication et validation du dossier", "2026-04-01", "2026-04-05"],
      ]),
    ],
  },
  {
    phase: "Cadrage",
    nom: "D | Contrat signé et dispositif de delivery engagé",
    ordre: 5,
    date_cible: "2026-04-30",
    description: "Contractualisation orientée résultats et mobilisation conjointe banque-intégrateur-éditeur.",
    workstreams: [
      ws("12 | Contractualisation et garanties de résultat", 1, "2026-04-01", "2026-04-22", [
        ["Négociation du périmètre, des SLA et des critères d'acceptation", "2026-04-01", "2026-04-10"],
        ["Sécurisation des clauses de réversibilité, audit et protection des données", "2026-04-08", "2026-04-17"],
        ["Signature du contrat, des annexes et du plan de paiement", "2026-04-16", "2026-04-22"],
      ]),
      ws("13 | Mobilisation de la delivery factory", 2, "2026-04-10", "2026-04-27", [
        ["Onboarding de l'éditeur, de l'intégrateur et des product owners", "2026-04-10", "2026-04-16"],
        ["Installation des squads parcours, data, intégration et adoption", "2026-04-14", "2026-04-22"],
        ["Validation du plan intégré, de la cadence et de la Definition of Done", "2026-04-20", "2026-04-27"],
      ]),
      ws("14 | Environnements et outillage", 3, "2026-04-15", "2026-04-30", [
        ["Provisionnement des environnements et accès sécurisés", "2026-04-15", "2026-04-22"],
        ["Mise en place CI/CD, gestion de configuration et observabilité", "2026-04-20", "2026-04-27"],
        ["Revue de readiness technique de démarrage du build", "2026-04-27", "2026-04-30"],
      ]),
    ],
  },
  {
    phase: "Exécution",
    nom: "E | Modèle CRM cible et parcours prioritaires validés",
    ordre: 6,
    date_cible: "2026-06-10",
    description: "Blueprint métier, parcours omnicanaux et modèle opérationnel cible validés.",
    workstreams: [
      ws("15 | Segmentation et connaissance client 360", 1, "2026-04-15", "2026-05-15", [
        ["Définition du golden customer profile et des attributs de connaissance", "2026-04-15", "2026-04-25"],
        ["Conception des segmentations retail, premium, corporate et prospects", "2026-04-22", "2026-05-05"],
        ["Validation des règles de consentement, préférences et next-best-action", "2026-05-01", "2026-05-15"],
      ]),
      ws("16 | Parcours commerciaux omnicanaux", 2, "2026-04-20", "2026-05-25", [
        ["Blueprint Lead-to-Opportunity et Opportunity-to-Sale", "2026-04-20", "2026-05-02"],
        ["Conception des campagnes, leads, opportunités et pipeline commercial", "2026-04-28", "2026-05-12"],
        ["Validation des handoffs agence, digital et centre de relation client", "2026-05-10", "2026-05-25"],
      ]),
      ws("17 | Parcours service et réclamation", 3, "2026-04-27", "2026-06-03", [
        ["Blueprint Request-to-Resolution et complaint management", "2026-04-27", "2026-05-10"],
        ["Définition des SLA, files, escalades et knowledge base", "2026-05-08", "2026-05-22"],
        ["Conception de la vue conseiller et des scripts assistés", "2026-05-18", "2026-06-03"],
      ]),
      ws("18 | Target Operating Model CRM", 4, "2026-05-10", "2026-06-10", [
        ["Définition des rôles front-office, marketing, service et administration CRM", "2026-05-10", "2026-05-22"],
        ["Conception des processus de gouvernance client et campagne", "2026-05-18", "2026-06-01"],
        ["Validation du TOM, des KPI et des contrôles de premier niveau", "2026-06-01", "2026-06-10"],
      ]),
    ],
  },
  {
    phase: "Exécution",
    nom: "F | Fondations plateforme, data et intégration opérationnelles",
    ordre: 7,
    date_cible: "2026-07-15",
    description: "Socle sécurisé et industrialisé connecté à l'écosystème bancaire.",
    workstreams: [
      ws("19 | Architecture de solution et sécurité", 1, "2026-05-15", "2026-06-20", [
        ["Finalisation de l'architecture logique, physique et de déploiement", "2026-05-15", "2026-05-28"],
        ["Threat modeling, IAM, rôles, chiffrement et journalisation", "2026-05-25", "2026-06-10"],
        ["Validation du dossier d'architecture et de l'homologation intermédiaire", "2026-06-08", "2026-06-20"],
      ]),
      ws("20 | Intégration SI bancaire", 2, "2026-05-20", "2026-07-05", [
        ["Conception des API CBS, MDM, KYC, GED, paiements et canaux digitaux", "2026-05-20", "2026-06-05"],
        ["Développement des services d'intégration et gestion des événements", "2026-06-01", "2026-06-25"],
        ["Tests de contrat API et gestion des erreurs de bout en bout", "2026-06-20", "2026-07-05"],
      ]),
      ws("21 | Data platform et analytics CRM", 3, "2026-05-25", "2026-07-10", [
        ["Modélisation des objets clients, interactions, consentements et campagnes", "2026-05-25", "2026-06-10"],
        ["Construction des flux CRM vers DataLake et reporting commercial", "2026-06-05", "2026-06-30"],
        ["Mise en place des indicateurs de qualité et de fraîcheur des données", "2026-06-25", "2026-07-10"],
      ]),
      ws("22 | Exploitabilité et résilience", 4, "2026-06-01", "2026-07-15", [
        ["Définition des SLO, supervision, alerting et capacité", "2026-06-01", "2026-06-15"],
        ["Conception sauvegarde, reprise, continuité et mode dégradé", "2026-06-12", "2026-06-30"],
        ["Test de résilience technique du socle CRM", "2026-07-01", "2026-07-15"],
      ]),
    ],
  },
  {
    phase: "Exécution",
    nom: "G | MVP CRM configuré et démontré de bout en bout",
    ordre: 8,
    date_cible: "2026-08-31",
    description: "MVP couvrant vente, service, campagne et vue 360 prêt pour qualification.",
    workstreams: [
      ws("23 | Sales CRM", 1, "2026-06-01", "2026-08-10", [
        ["Configuration comptes, contacts, leads et opportunités", "2026-06-01", "2026-06-25"],
        ["Configuration pipeline, objectifs, activités et mobilité conseiller", "2026-06-20", "2026-07-15"],
        ["Mise en œuvre des règles d'affectation et recommandations commerciales", "2026-07-10", "2026-07-31"],
        ["Démonstration Sales CRM sur parcours représentatifs", "2026-08-01", "2026-08-10"],
      ]),
      ws("24 | Service CRM", 2, "2026-06-10", "2026-08-15", [
        ["Configuration demandes, réclamations, SLA et files de traitement", "2026-06-10", "2026-07-05"],
        ["Construction de la knowledge base et des réponses assistées", "2026-07-01", "2026-07-25"],
        ["Intégration téléphonie, messagerie et interactions digitales", "2026-07-15", "2026-08-05"],
        ["Démonstration Service CRM de bout en bout", "2026-08-05", "2026-08-15"],
      ]),
      ws("25 | Marketing automation", 3, "2026-06-20", "2026-08-20", [
        ["Configuration segments, audiences, campagnes et journeys", "2026-06-20", "2026-07-15"],
        ["Mise en œuvre consentement, pression commerciale et préférences", "2026-07-10", "2026-07-31"],
        ["Activation des canaux e-mail, SMS, push et tâches conseiller", "2026-07-25", "2026-08-12"],
        ["Démonstration campagne omnicanale et mesure des conversions", "2026-08-12", "2026-08-20"],
      ]),
      ws("26 | Customer 360 et pilotage", 4, "2026-07-01", "2026-08-31", [
        ["Construction de la vue client 360 et de la timeline d'interactions", "2026-07-01", "2026-07-25"],
        ["Mise en place dashboards managers, conseillers et marketing", "2026-07-20", "2026-08-10"],
        ["Paramétrage des alertes, opportunités et next-best-actions", "2026-08-01", "2026-08-20"],
        ["Revue MVP et décision de passage en qualification", "2026-08-20", "2026-08-31"],
      ]),
    ],
  },
  {
    phase: "Exécution",
    nom: "H | Données clients migrées avec qualité maîtrisée",
    ordre: 9,
    date_cible: "2026-09-30",
    description: "Migration répétable, réconciliée et conforme des données CRM historiques.",
    workstreams: [
      ws("27 | Qualification et remédiation des données", 1, "2026-06-15", "2026-08-20", [
        ["Profiling des données clients, prospects, contacts et interactions", "2026-06-15", "2026-06-30"],
        ["Définition des règles de dédoublonnage, survivorship et qualité", "2026-06-25", "2026-07-15"],
        ["Campagnes de remédiation avec les responsables de données", "2026-07-10", "2026-08-10"],
        ["Certification du niveau de qualité avant migration à blanc", "2026-08-10", "2026-08-20"],
      ]),
      ws("28 | Factory de migration", 2, "2026-07-01", "2026-09-15", [
        ["Mapping source-cible et règles de transformation", "2026-07-01", "2026-07-20"],
        ["Développement des extractions, transformations et contrôles", "2026-07-15", "2026-08-15"],
        ["Répétitions de migration M1 et M2 avec chronométrage", "2026-08-10", "2026-09-05"],
        ["Correction des rejets et stabilisation du runbook", "2026-09-01", "2026-09-15"],
      ]),
      ws("29 | Réconciliation et conformité", 3, "2026-08-01", "2026-09-30", [
        ["Définition des contrôles de volumétrie, exhaustivité et cohérence", "2026-08-01", "2026-08-15"],
        ["Réconciliation métier des données migrées par échantillonnage", "2026-08-15", "2026-09-10"],
        ["Contrôle consentements, conservation et traçabilité réglementaire", "2026-09-01", "2026-09-20"],
        ["Sign-off data owners pour la migration de production", "2026-09-20", "2026-09-30"],
      ]),
    ],
  },
  {
    phase: "Exécution",
    nom: "I | Solution qualifiée et prête pour le pilote",
    ordre: 10,
    date_cible: "2026-10-15",
    description: "Qualité fonctionnelle, technique, sécurité et opérationnelle démontrée.",
    workstreams: [
      ws("30 | Tests système et intégration", 1, "2026-08-01", "2026-09-15", [
        ["Exécution des tests SIT sur parcours critiques", "2026-08-01", "2026-08-25"],
        ["Tests de bout en bout CRM-CBS-MDM-canaux", "2026-08-20", "2026-09-05"],
        ["Correction des anomalies majeures et campagne de non-régression", "2026-09-01", "2026-09-15"],
      ]),
      ws("31 | Recette métier et expérience utilisateur", 2, "2026-08-25", "2026-09-30", [
        ["Préparation des scénarios UAT et des jeux de données", "2026-08-25", "2026-09-05"],
        ["Recette par conseillers, managers, marketing et service client", "2026-09-05", "2026-09-23"],
        ["Arbitrage des écarts et sign-off des product owners", "2026-09-20", "2026-09-30"],
      ]),
      ws("32 | Performance, sécurité et résilience", 3, "2026-09-01", "2026-10-05", [
        ["Tests de charge aux volumes cibles et pics de campagne", "2026-09-01", "2026-09-15"],
        ["Tests d'intrusion et correction des vulnérabilités", "2026-09-10", "2026-09-28"],
        ["Tests de reprise, continuité et observabilité opérationnelle", "2026-09-25", "2026-10-05"],
      ]),
      ws("33 | Go-live readiness", 4, "2026-09-20", "2026-10-15", [
        ["Revue des critères de passage, risques et plans de contingence", "2026-09-20", "2026-09-30"],
        ["Répétition générale du cutover et validation du rollback", "2026-10-01", "2026-10-10"],
        ["Go/no-go du pilote CRM", "2026-10-10", "2026-10-15"],
      ]),
    ],
  },
  {
    phase: "Exécution",
    nom: "J | Pilote CRM en production et valeur démontrée",
    ordre: 11,
    date_cible: "2026-11-05",
    description: "Pilote agence et centre de relation client stabilisé sur des parcours réels.",
    workstreams: [
      ws("34 | Déploiement pilote", 1, "2026-09-15", "2026-10-25", [
        ["Sélection des agences, équipes CRC et populations pilotes", "2026-09-15", "2026-09-25"],
        ["Préparation des données, habilitations et postes de travail", "2026-09-25", "2026-10-10"],
        ["Exécution du cutover et ouverture du pilote", "2026-10-15", "2026-10-20"],
        ["Support renforcé des premiers jours de production", "2026-10-20", "2026-10-25"],
      ]),
      ws("35 | Adoption et coaching terrain", 2, "2026-09-20", "2026-10-31", [
        ["Formation des managers, super-users et conseillers pilotes", "2026-09-20", "2026-10-10"],
        ["Coaching en situation de travail et animation des communautés", "2026-10-10", "2026-10-25"],
        ["Mesure de l'usage, de la satisfaction et des irritants", "2026-10-20", "2026-10-31"],
        ["Plan de remédiation adoption avant généralisation", "2026-10-27", "2026-10-31"],
      ]),
      ws("36 | Mesure de valeur du pilote", 3, "2026-10-15", "2026-11-05", [
        ["Baseline des KPI commerciaux, service et productivité", "2026-10-15", "2026-10-20"],
        ["Mesure conversion, délai de traitement et qualité de service", "2026-10-20", "2026-10-31"],
        ["Évaluation de la stabilité et des incidents du pilote", "2026-10-22", "2026-11-02"],
        ["Décision de généralisation fondée sur les résultats", "2026-11-02", "2026-11-05"],
      ]),
    ],
  },
  {
    phase: "Exécution",
    nom: "K | CRM généralisé au réseau et aux canaux prioritaires",
    ordre: 12,
    date_cible: "2026-11-30",
    description: "Déploiement industrialisé, piloté par vague et sécurisé par la donnée d'adoption.",
    workstreams: [
      ws("37 | Déploiement réseau par vagues", 1, "2026-10-15", "2026-11-25", [
        ["Segmentation du réseau et ordonnancement des vagues", "2026-10-15", "2026-10-22"],
        ["Déploiement vague 1 : agences à fort potentiel", "2026-10-24", "2026-11-05"],
        ["Déploiement vague 2 : reste du réseau et fonctions centrales", "2026-11-06", "2026-11-20"],
        ["Contrôle de complétude et rattrapage des unités en écart", "2026-11-20", "2026-11-25"],
      ]),
      ws("38 | Généralisation centre de relation client et digital", 2, "2026-10-20", "2026-11-25", [
        ["Activation des files, scripts et connaissances pour le CRC", "2026-10-20", "2026-11-05"],
        ["Activation des interactions web, mobile, e-mail et messagerie", "2026-11-01", "2026-11-15"],
        ["Validation de la continuité omnicanale des interactions", "2026-11-12", "2026-11-25"],
      ]),
      ws("39 | Conduite du changement à l'échelle", 3, "2026-10-20", "2026-11-30", [
        ["Déploiement des parcours de formation par rôle", "2026-10-20", "2026-11-15"],
        ["Animation du réseau de champions et des managers de proximité", "2026-11-01", "2026-11-25"],
        ["Pilotage quotidien de l'adoption et des actions correctives", "2026-11-10", "2026-11-30"],
      ]),
      ws("40 | Stabilisation des vagues", 4, "2026-11-01", "2026-11-30", [
        ["War room transverse métier, IT, data et intégrateur", "2026-11-01", "2026-11-20"],
        ["Résolution des incidents critiques et anomalies d'usage", "2026-11-01", "2026-11-25"],
        ["Passage sous seuil cible des incidents et du backlog critique", "2026-11-20", "2026-11-30"],
      ]),
    ],
  },
  {
    phase: "Clôture",
    nom: "L | Hypercare achevée et exploitation autonome",
    ordre: 13,
    date_cible: "2026-12-20",
    description: "Service stabilisé, exploitation outillée et responsabilités transférées au RUN.",
    workstreams: [
      ws("41 | Hypercare et réduction du backlog", 1, "2026-11-01", "2026-12-15", [
        ["Pilotage des incidents par criticité et analyse des causes racines", "2026-11-01", "2026-11-25"],
        ["Traitement des anomalies résiduelles et optimisation des performances", "2026-11-15", "2026-12-08"],
        ["Réduction du backlog sous les seuils convenus", "2026-12-01", "2026-12-15"],
        ["Décision de sortie d'hypercare", "2026-12-12", "2026-12-15"],
      ]),
      ws("42 | Transfert au RUN et modèle de service", 2, "2026-11-15", "2026-12-20", [
        ["Transfert des procédures, architectures et dossiers d'exploitation", "2026-11-15", "2026-11-30"],
        ["Formation support L1/L2/L3 et administration fonctionnelle", "2026-11-25", "2026-12-10"],
        ["Mise en place des SLA, comités de service et capacité de support", "2026-12-05", "2026-12-15"],
        ["Sign-off de prise en charge par le RUN", "2026-12-15", "2026-12-20"],
      ]),
      ws("43 | Pérennisation de l'adoption", 3, "2026-11-20", "2026-12-20", [
        ["Intégration des usages CRM dans les rituels de management commercial", "2026-11-20", "2026-12-05"],
        ["Mise en place du cockpit adoption et qualité de données", "2026-12-01", "2026-12-12"],
        ["Plan de coaching ciblé des populations sous-adoptantes", "2026-12-08", "2026-12-18"],
        ["Validation du dispositif d'amélioration continue", "2026-12-15", "2026-12-20"],
      ]),
    ],
  },
  {
    phase: "Clôture",
    nom: "M | Valeur sécurisée et programme clôturé",
    ordre: 14,
    date_cible: "2026-12-31",
    description: "Bénéfices mesurés, roadmap suivante arbitrée et clôture formelle du programme.",
    workstreams: [
      ws("44 | Réalisation des bénéfices", 1, "2026-12-01", "2026-12-27", [
        ["Mesure des gains commerciaux, service, productivité et satisfaction", "2026-12-01", "2026-12-15"],
        ["Comparaison des résultats à la baseline et au business case", "2026-12-12", "2026-12-22"],
        ["Validation du plan de réalisation des bénéfices à douze mois", "2026-12-20", "2026-12-27"],
      ]),
      ws("45 | Roadmap CRM post-programme", 2, "2026-12-05", "2026-12-29", [
        ["Priorisation du backlog résiduel et des nouvelles capacités", "2026-12-05", "2026-12-15"],
        ["Construction de la roadmap IA, personnalisation et canaux additionnels", "2026-12-12", "2026-12-24"],
        ["Arbitrage budget, capacité et gouvernance produit CRM", "2026-12-22", "2026-12-29"],
      ]),
      ws("46 | Clôture et retour d'expérience", 3, "2026-12-15", "2026-12-31", [
        ["Bilan coûts, délais, qualité, risques et fournisseurs", "2026-12-15", "2026-12-23"],
        ["Capitalisation des enseignements et pratiques réutilisables", "2026-12-20", "2026-12-28"],
        ["Réception définitive, clôture contractuelle et COPIL de clôture", "2026-12-28", "2026-12-31"],
      ]),
    ],
  },
];

const localIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

function jalonStart(jalon: JalonSeed) {
  return (
    jalon.workstreams?.reduce(
      (earliest, workstream) =>
        workstream.date_debut < earliest ? workstream.date_debut : earliest,
      jalon.date_cible
    ) ?? jalon.date_cible
  );
}

function statusFor(start: string, end: string, level: "jalon" | "detail") {
  const today = localIso(new Date());
  // Même catalogue que les jalons (pas de statut « Terminé » en base)
  if (end < today) return "Atteint";
  if (start <= today) return "En cours";
  return "Planifié";
}

function validatePlanning(code: string, start: string, end: string, planning: JalonSeed[]) {
  const errors: string[] = [];
  if (!planning.length) errors.push("Planning vide");
  for (const jalon of planning) {
    const jStart = jalonStart(jalon);
    if (jStart < start || jalon.date_cible > end || jStart > jalon.date_cible) {
      errors.push(`${jalon.nom}: dates de jalon hors période ou inversées`);
    }
    for (const workstream of jalon.workstreams ?? []) {
      if (workstream.date_debut < start || workstream.date_fin > end || workstream.date_debut > workstream.date_fin) {
        errors.push(`${workstream.nom}: dates de workstream invalides`);
      }
      for (const activity of workstream.activites) {
        if (activity.date_debut < workstream.date_debut || activity.date_fin > workstream.date_fin || activity.date_debut > activity.date_fin) {
          errors.push(`${activity.nom}: activité hors de son workstream`);
        }
      }
    }
  }
  if (errors.length) throw new Error(`${code}:\n- ${errors.join("\n- ")}`);
}

async function replacePlanning(code: "CH_016" | "CH_023", planning: JalonSeed[]) {
  const chantier = await prisma.chantier.findUnique({
    where: { code },
    include: {
      jalons: {
        orderBy: { ordre: "asc" },
        include: {
          workstreams: {
            orderBy: { ordre: "asc" },
            include: { activites: { orderBy: { ordre: "asc" } } },
          },
        },
      },
    },
  });
  if (!chantier) throw new Error(`Chantier ${code} introuvable`);

  const chantierStart = localIso(chantier.date_debut);
  const chantierEnd = localIso(chantier.date_fin);
  validatePlanning(code, chantierStart, chantierEnd, planning);

  if (DRY_RUN) {
    return {
      id: chantier.id,
      code,
      backupPath: "DRY-RUN",
      statut: chantier.statut,
      avancement: chantier.avancement,
      jalons: planning.length,
      workstreams: planning.reduce(
        (count, jalon) => count + (jalon.workstreams?.length ?? 0),
        0
      ),
      activites: planning.reduce(
        (count, jalon) =>
          count +
          (jalon.workstreams ?? []).reduce(
            (wsCount, workstream) => wsCount + workstream.activites.length,
            0
          ),
        0
      ),
    };
  }

  const backupDir = join(tmpdir(), "transfohub-planning-backups");
  await mkdir(backupDir, { recursive: true });
  const backupPath = join(
    backupDir,
    `${code}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  await writeFile(
    backupPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), chantier }, null, 2),
    "utf8"
  );

  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const weights: Record<string, number> = {
    Précadrage: settings?.poids_precadrage ?? 10,
    Cadrage: settings?.poids_cadrage ?? 20,
    Exécution: settings?.poids_execution ?? 60,
    Clôture: settings?.poids_cloture ?? 10,
  };
  const phaseStatus: Record<string, string> = {
    Précadrage: "Pré cadrage",
    Cadrage: "Cadrage",
    Exécution: "Exécution",
    Clôture: "Clôture",
  };
  let progress = 0;
  let chantierStatus = "Non démarré";
  for (const phase of ["Précadrage", "Cadrage", "Exécution", "Clôture"]) {
    const phaseJalons = planning.filter((jalon) => jalon.phase === phase);
    if (!phaseJalons.length) continue;
    const statuses = phaseJalons.map((jalon) =>
      statusFor(jalonStart(jalon), jalon.date_cible, "jalon")
    );
    progress +=
      (statuses.filter((status) => status === "Atteint").length / phaseJalons.length) *
      weights[phase];
    if (statuses.some((status) => status === "Atteint" || status === "En cours")) {
      chantierStatus = phaseStatus[phase];
    }
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.jalon.deleteMany({ where: { chantierId: chantier.id } });
      for (const jalon of planning) {
        const start = jalonStart(jalon);
        await tx.jalon.create({
          data: {
            chantierId: chantier.id,
            phase: jalon.phase,
            nom: jalon.nom,
            description: jalon.description ?? "",
            ordre: jalon.ordre,
            date_debut: d(start),
            date_cible: d(jalon.date_cible),
            statut: statusFor(start, jalon.date_cible, "jalon"),
            livrables: `Livrable de décision — ${jalon.nom}`,
            commentaire: "Planning directeur stratégique — trajectoire intégrée métier, data, technologie et conduite du changement",
            workstreams: {
              create: (jalon.workstreams ?? []).map((workstream) => ({
                nom: workstream.nom,
                ordre: workstream.ordre,
                description: `Workstream contribuant au jalon « ${jalon.nom} »`,
                date_debut: d(workstream.date_debut),
                date_fin: d(workstream.date_fin),
                statut: statusFor(workstream.date_debut, workstream.date_fin, "detail"),
                commentaire: "Pilotage intégré par résultat et critères d'acceptation",
                activites: {
                  create: workstream.activites.map((activity) => ({
                    nom: activity.nom,
                    ordre: activity.ordre,
                    description: `Activité planifiée dans « ${workstream.nom} »`,
                    date_debut: d(activity.date_debut),
                    date_fin: d(activity.date_fin),
                    statut: statusFor(activity.date_debut, activity.date_fin, "detail"),
                    commentaire: "",
                  })),
                },
              })),
            },
          },
        });
      }
      await tx.chantier.update({
        where: { id: chantier.id },
        data: { avancement: Math.round(progress), statut: chantierStatus },
      });
    },
    { timeout: 120_000 }
  );

  const summary = await prisma.chantier.findUniqueOrThrow({
    where: { id: chantier.id },
    include: { jalons: { include: { workstreams: { include: { activites: true } } } } },
  });
  return {
    id: chantier.id,
    code,
    backupPath,
    statut: summary.statut,
    avancement: summary.avancement,
    jalons: summary.jalons.length,
    workstreams: summary.jalons.reduce((count, jalon) => count + jalon.workstreams.length, 0),
    activites: summary.jalons.reduce(
      (count, jalon) =>
        count + jalon.workstreams.reduce((wsCount, workstream) => wsCount + workstream.activites.length, 0),
      0
    ),
  };
}

async function main() {
  const results = [];
  results.push(await replacePlanning("CH_016", CH016_PLANNING));
  results.push(await replacePlanning("CH_023", CH023_PLANNING));
  console.log(JSON.stringify(results, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
