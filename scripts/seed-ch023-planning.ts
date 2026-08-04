/**
 * Planning détaillé CH_023 — Core Banking (AO + implémentation).
 * Posture : Directeur de projet senior programme transformation bancaire.
 *
 * Run: npx tsx scripts/seed-ch023-planning.ts
 */
import { createPrismaClient } from "../lib/create-prisma";

const prisma = createPrismaClient();

function d(iso: string): Date {
  return new Date(iso + "T12:00:00.000Z");
}

type Act = {
  nom: string;
  ordre: number;
  date_debut: string;
  date_fin: string;
  statut?: string;
};
type Ws = {
  nom: string;
  ordre: number;
  date_debut: string;
  date_fin: string;
  statut?: string;
  activites: Act[];
};
type JalonSeed = {
  phase: string;
  nom: string;
  ordre: number;
  date_cible: string;
  statut?: string;
  description?: string;
  workstreams?: Ws[];
};

function ws(
  nom: string,
  ordre: number,
  debut: string,
  fin: string,
  acts: [string, string, string][],
  statut = "Planifié"
): Ws {
  return {
    nom,
    ordre,
    date_debut: debut,
    date_fin: fin,
    statut,
    activites: acts.map(([nomA, d0, d1], i) => ({
      nom: nomA,
      ordre: i + 1,
      date_debut: d0,
      date_fin: d1,
      statut,
    })),
  };
}

/**
 * Planning programme CBS — sélection éditeur + implémentation multi-vagues.
 * Jalons A/B/C (sélection) conservés et enrichis ; reste du cycle densifié.
 */
const PLANNING: JalonSeed[] = [
  // ═══════════════════════════════════════════════════
  // PRÉCADRAGE
  // ═══════════════════════════════════════════════════
  {
    phase: "Précadrage",
    nom: "J0 | Lancement programme & gouvernance projet",
    ordre: 1,
    date_cible: "2025-02-15",
    statut: "Atteint",
    description:
      "Constitution de l'équipe, instances de pilotage, RACI, budget enveloppe.",
    workstreams: [
      ws(
        "1 | Gouvernance & pilotage",
        1,
        "2025-01-15",
        "2025-02-10",
        [
          ["Nomination du Directeur de projet et du PMO chantier", "2025-01-15", "2025-01-22"],
          ["Mise en place COPIL / COPROJ / cellule sélection", "2025-01-20", "2025-01-31"],
          ["Validation RACI et matrice de décisions", "2025-01-28", "2025-02-07"],
          ["Calendrier des instances et règles d'escalade", "2025-02-03", "2025-02-10"],
        ],
        "Atteint"
      ),
      ws(
        "2 | Enveloppe budgétaire & business case initial",
        2,
        "2025-01-20",
        "2025-02-12",
        [
          ["Estimation rough order of magnitude (ROM) programme", "2025-01-20", "2025-01-31"],
          ["Identification des postes CAPEX / OPEX prévisionnels", "2025-01-28", "2025-02-07"],
          ["Validation de l'enveloppe par la Direction Financière", "2025-02-05", "2025-02-12"],
        ],
        "Atteint"
      ),
      ws(
        "3 | Kick-off & alignement parties prenantes",
        3,
        "2025-02-05",
        "2025-02-15",
        [
          ["Atelier de lancement avec métiers (Retail, Corporate, Finance)", "2025-02-05", "2025-02-08"],
          ["Alignement DSI / Sécurité / Risques / Conformité", "2025-02-07", "2025-02-12"],
          ["Communication interne de lancement programme", "2025-02-12", "2025-02-15"],
        ],
        "Atteint"
      ),
    ],
  },
  {
    phase: "Précadrage",
    nom: "J1 | Cadrage stratégique & vision cible CBS",
    ordre: 2,
    date_cible: "2025-03-31",
    statut: "Atteint",
    description:
      "Ambition produit, domaines fonctionnels, principes d'architecture, hors-scope.",
    workstreams: [
      ws(
        "1 | Vision produit & domaines cibles",
        1,
        "2025-02-16",
        "2025-03-15",
        [
          ["Ateliers vision cible (comptes, dépôts, crédits, packages)", "2025-02-16", "2025-02-28"],
          ["Cartographie des parcours clients prioritaires", "2025-02-24", "2025-03-08"],
          ["Décision multi-produit vs progressive roll-out", "2025-03-05", "2025-03-15"],
        ],
        "Atteint"
      ),
      ws(
        "2 | Principes d'architecture & intégration",
        2,
        "2025-02-20",
        "2025-03-25",
        [
          ["Principes API-first / event-driven / data domain", "2025-02-20", "2025-03-05"],
          ["Cadrage des canaux (mobile, web, agence, ATM, corporate)", "2025-03-01", "2025-03-15"],
          ["Positionnement vs data warehouse, CRM, paiement, risk", "2025-03-10", "2025-03-25"],
        ],
        "Atteint"
      ),
      ws(
        "3 | Périmètre & hors-scope formalisés",
        3,
        "2025-03-10",
        "2025-03-31",
        [
          ["Rédaction de la note de cadrage stratégique", "2025-03-10", "2025-03-22"],
          ["Revue et validation COPIL stratégique", "2025-03-20", "2025-03-28"],
          ["Gel V1 du périmètre pour consultation éditeurs", "2025-03-26", "2025-03-31"],
        ],
        "Atteint"
      ),
    ],
  },
  {
    phase: "Précadrage",
    nom: "J2 | Cartographie AS-IS & inventaire SI",
    ordre: 3,
    date_cible: "2025-04-30",
    statut: "Atteint",
    description:
      "Inventaire applicatif, flux, données critiques, dettes techniques.",
    workstreams: [
      ws(
        "1 | Inventaire applicatif & flux",
        1,
        "2025-03-20",
        "2025-04-15",
        [
          ["Recensement des applications du domaine dépôts / comptes", "2025-03-20", "2025-03-31"],
          ["Cartographie des interfaces entrantes / sortantes", "2025-03-28", "2025-04-10"],
          ["Identification des points de couplage fort et single points of failure", "2025-04-05", "2025-04-15"],
        ],
        "Atteint"
      ),
      ws(
        "2 | Données & qualité",
        2,
        "2025-03-25",
        "2025-04-22",
        [
          ["Inventaire des référentiels (client, produit, compte, contrat)", "2025-03-25", "2025-04-05"],
          ["Diagnostic qualité données et volumétrie migration", "2025-04-01", "2025-04-15"],
          ["Identification des règles de reprise prioritaires", "2025-04-12", "2025-04-22"],
        ],
        "Atteint"
      ),
      ws(
        "3 | Synthèse AS-IS & risques de bascule",
        3,
        "2025-04-15",
        "2025-04-30",
        [
          ["Atelier risques de bascule avec RUN / Continuity", "2025-04-15", "2025-04-22"],
          ["Formalisation de la cartographie AS-IS validée DSI", "2025-04-18", "2025-04-28"],
          ["Livrable inventaire pour dossier de consultation", "2025-04-25", "2025-04-30"],
        ],
        "Atteint"
      ),
    ],
  },
  {
    phase: "Précadrage",
    nom: "J3 | Stratégie make/buy & shortlist préliminaire marché",
    ordre: 4,
    date_cible: "2025-05-20",
    statut: "Atteint",
    description:
      "Revue marché éditeurs, critères d'éligibilité, shortlist indicative.",
    workstreams: [
      ws(
        "1 | Scan marché & veille éditeurs",
        1,
        "2025-04-20",
        "2025-05-10",
        [
          ["Benchmark solutions CBS (global / régional / niche)", "2025-04-20", "2025-05-02"],
          ["Analyse références bancaires comparables (taille, régulation)", "2025-04-28", "2025-05-08"],
          ["Synthèse forces / faiblesses / risques éditeur", "2025-05-05", "2025-05-10"],
        ],
        "Atteint"
      ),
      ws(
        "2 | Critères d'éligibilité AO",
        2,
        "2025-05-01",
        "2025-05-18",
        [
          ["Définition des critères eliminatoires (KO)", "2025-05-01", "2025-05-08"],
          ["Pondération technico-fonctionnelle vs financière", "2025-05-06", "2025-05-14"],
          ["Validation des critères avec Achats / Juridique", "2025-05-12", "2025-05-18"],
        ],
        "Atteint"
      ),
    ],
  },

  // ═══════════════════════════════════════════════════
  // CADRAGE
  // ═══════════════════════════════════════════════════
  {
    phase: "Cadrage",
    nom: "J4 | Expression des besoins & référentiel d'exigences",
    ordre: 1,
    date_cible: "2025-06-20",
    statut: "Atteint",
    description:
      "Exigences métier, réglementaires, non-fonctionnelles (NFR), traçabilité.",
    workstreams: [
      ws(
        "1 | Exigences métier",
        1,
        "2025-05-15",
        "2025-06-10",
        [
          ["Ateliers Retail (comptes, packages, tarification)", "2025-05-15", "2025-05-28"],
          ["Ateliers Corporate & trésorerie", "2025-05-22", "2025-06-02"],
          ["Ateliers Finance / produit / reporting réglementaire", "2025-05-28", "2025-06-08"],
          ["Consolidation du catalogue d'exigences métier", "2025-06-05", "2025-06-10"],
        ],
        "Atteint"
      ),
      ws(
        "2 | Exigences non-fonctionnelles & sécurité",
        2,
        "2025-05-20",
        "2025-06-15",
        [
          ["Définition NFR (perf, dispo, RPO/RTO, scalabilité)", "2025-05-20", "2025-06-02"],
          ["Exigences cybersécurité & conformité (PCI, local reg.)", "2025-05-25", "2025-06-08"],
          ["Exigences d'auditabilité et de pistes d'audit", "2025-06-05", "2025-06-15"],
        ],
        "Atteint"
      ),
      ws(
        "3 | Traçabilité & validation référentiel",
        3,
        "2025-06-08",
        "2025-06-20",
        [
          ["Mise en place de la matrice exigences / tests futurs", "2025-06-08", "2025-06-14"],
          ["Revue métier / DSI du référentiel V1", "2025-06-12", "2025-06-18"],
          ["Gel du référentiel pour consultation", "2025-06-17", "2025-06-20"],
        ],
        "Atteint"
      ),
    ],
  },
  {
    phase: "Cadrage",
    nom: "J5 | Dossier de consultation & lancement AO",
    ordre: 2,
    date_cible: "2025-07-31",
    statut: "Atteint",
    description:
      "Règlement de consultation, pièces techniques, critères, publication.",
    workstreams: [
      ws(
        "1 | Constitution du dossier AO",
        1,
        "2025-06-20",
        "2025-07-15",
        [
          ["Rédaction du règlement de la consultation", "2025-06-20", "2025-07-05"],
          ["Cahier des charges technico-fonctionnel", "2025-06-22", "2025-07-12"],
          ["Annexes data, architecture, volumétrie, NFR", "2025-07-01", "2025-07-15"],
        ],
        "Atteint"
      ),
      ws(
        "2 | Cadre juridique & achats",
        2,
        "2025-06-25",
        "2025-07-25",
        [
          ["Revue juridique des conditions générales", "2025-06-25", "2025-07-10"],
          ["Définition des modalités de dépôt et d'évaluation", "2025-07-05", "2025-07-18"],
          ["Validation Achats / Secrétariat des marchés", "2025-07-15", "2025-07-25"],
        ],
        "Atteint"
      ),
      ws(
        "3 | Publication & session d'information",
        3,
        "2025-07-20",
        "2025-07-31",
        [
          ["Publication de l'AO et envoi aux éditeurs éligibles", "2025-07-20", "2025-07-24"],
          ["Session d'information éditeurs (Q&A formalisé)", "2025-07-25", "2025-07-28"],
          ["Publication des réponses aux questions (addendum)", "2025-07-28", "2025-07-31"],
        ],
        "Atteint"
      ),
    ],
  },
  {
    phase: "Cadrage",
    nom: "J6 | Réception, conformité & shortlist des offres",
    ordre: 3,
    date_cible: "2025-09-20",
    statut: "Atteint",
    description:
      "Ouverture administrative, checklist conformité, shortlist technique.",
    workstreams: [
      ws(
        "1 | Ouverture & conformité administrative",
        1,
        "2025-09-01",
        "2025-09-10",
        [
          ["Réception et horodatage des plis", "2025-09-01", "2025-09-03"],
          ["Vérification pièces administratives et engagement", "2025-09-03", "2025-09-08"],
          ["PV d'ouverture et liste des offres recevables", "2025-09-08", "2025-09-10"],
        ],
        "Atteint"
      ),
      ws(
        "2 | Pré-qualification technique",
        2,
        "2025-09-08",
        "2025-09-18",
        [
          ["Application des critères KO", "2025-09-08", "2025-09-12"],
          ["Notation préliminaire couverture macro", "2025-09-10", "2025-09-16"],
          ["Décision shortlist pour analyse détaillée", "2025-09-15", "2025-09-18"],
        ],
        "Atteint"
      ),
      ws(
        "3 | Organisation de la cellule d'évaluation",
        3,
        "2025-09-12",
        "2025-09-20",
        [
          ["Affectation des évaluateurs par domaine", "2025-09-12", "2025-09-15"],
          ["Briefing règles d'indépendance et de confidentialité", "2025-09-14", "2025-09-17"],
          ["Planning des analyses et des demos éditeurs", "2025-09-16", "2025-09-20"],
        ],
        "Atteint"
      ),
    ],
  },

  // ── A / B / C sélection (demandé + densifié) ───────
  {
    phase: "Cadrage",
    nom: "A | Objectiver la couverture des besoins technico-fonctionnels",
    ordre: 4,
    date_cible: "2025-11-20",
    statut: "En cours",
    description:
      "Top-down, bottom-up EPIC, fit/gap et qualification des écarts éditeurs.",
    workstreams: [
      ws(
        "1 | Analyse à plat technico-fonctionnelle (top-down)",
        1,
        "2025-09-22",
        "2025-10-18",
        [
          [
            "Consolidation et normalisation des réponses éditeurs dans une grille comparable",
            "2025-09-22",
            "2025-10-02",
          ],
          [
            "Analyse de la couverture par exigence technico-fonctionnelle",
            "2025-10-01",
            "2025-10-12",
          ],
          [
            "Pour les exigences non couvertes, identification des must have [as-is] et décision du plan d'action",
            "2025-10-10",
            "2025-10-18",
          ],
          [
            "Synthèse par éditeur et heatmap de couverture",
            "2025-10-14",
            "2025-10-18",
          ],
        ],
        "En cours"
      ),
      ws(
        "2 | Affinement des besoins (bottom-up) — backlog priorisé jusqu'au niveau EPIC, co-construit",
        2,
        "2025-10-05",
        "2025-11-05",
        [
          [
            "Enrichissement du backlog fonctionnel (incl. existant et future)",
            "2025-10-05",
            "2025-10-20",
          ],
          [
            "Construction du backlog technique (incl. architecture; existant et future)",
            "2025-10-12",
            "2025-10-28",
          ],
          [
            "Consolidation du backlog technico-fonctionnel et priorisation",
            "2025-10-22",
            "2025-11-02",
          ],
          [
            "Revue métier du backlog EPIC et validation MoSCoW",
            "2025-10-28",
            "2025-11-05",
          ],
        ]
      ),
      ws(
        "3 | Fit/gap - couverture & qualification des écarts",
        3,
        "2025-10-25",
        "2025-11-18",
        [
          [
            "Croisement de la couverture des éditeurs avec le backlog technico-fonctionnel consolidé",
            "2025-10-25",
            "2025-11-06",
          ],
          ["Analyse du fit / gap à date", "2025-11-04", "2025-11-12"],
          [
            "Consolidation et formalisation des demandes finales aux éditeurs",
            "2025-11-10",
            "2025-11-18",
          ],
          [
            "Classification des écarts (Adopt / Adapt / Build / Out-of-scope)",
            "2025-11-12",
            "2025-11-18",
          ],
        ]
      ),
      ws(
        "4 | Démonstrations & deep-dives éditeurs",
        4,
        "2025-10-15",
        "2025-11-15",
        [
          ["Script de démonstration standardisé par parcours métier", "2025-10-15", "2025-10-22"],
          ["Sessions demo Retail & Corporate par éditeur shortlisté", "2025-10-22", "2025-11-08"],
          ["Deep-dive architecture / sécurité / opérations", "2025-11-01", "2025-11-12"],
          ["Compte-rendu d'évaluation demo et score qualitatif", "2025-11-08", "2025-11-15"],
        ]
      ),
    ],
  },
  {
    phase: "Cadrage",
    nom: "B | Comparer le coût complet de possession (TCO)",
    ordre: 5,
    date_cible: "2025-12-22",
    statut: "Planifié",
    description:
      "TCO paramétrable, échanges éditeurs, analyses CAPEX/OPEX, business case.",
    workstreams: [
      ws(
        "4 | Modélisation d'un TCO paramétrable",
        1,
        "2025-11-10",
        "2025-11-30",
        [
          ["Modélisation du TCO propre au chantier", "2025-11-10", "2025-11-20"],
          [
            "Revue des hypothèses et validation finale par le programme (si applicable)",
            "2025-11-18",
            "2025-11-25",
          ],
          [
            "Partage aux éditeurs du TCO à remplir (si applicable)",
            "2025-11-24",
            "2025-11-30",
          ],
          ["Calibrage des scénarios bas / médian / haut", "2025-11-22", "2025-11-30"],
        ]
      ),
      ws(
        "5 | Premier echange avec les editeurs",
        2,
        "2025-11-22",
        "2025-12-08",
        [
          [
            "Envoie des questions fonctionnelles et techniques aux editeurs",
            "2025-11-22",
            "2025-11-27",
          ],
          [
            "Reception de toutes les reponses aux questions technico-fonctionnelles des editeurs",
            "2025-11-27",
            "2025-12-04",
          ],
          ["Clôture de la notation technique", "2025-12-02", "2025-12-06"],
          ["Ouverture des plis financier", "2025-12-05", "2025-12-08"],
        ]
      ),
      ws(
        "6 | Deuxieme echange avec les editeurs - Analyses financières (sensibilité, CAPEX/OPEX)",
        3,
        "2025-12-06",
        "2025-12-16",
        [
          ["Réalisation des analyses de sensibilité", "2025-12-06", "2025-12-09"],
          ["Projection et décomposition des coûts CAPEX/OPEX", "2025-12-08", "2025-12-11"],
          [
            "Retour vers les éditeurs avec des questions financières",
            "2025-12-10",
            "2025-12-12",
          ],
          [
            "Analyse du retour des éditeurs sur les questions financières",
            "2025-12-12",
            "2025-12-16",
          ],
        ]
      ),
      ws(
        "7 | Business case par décision structurante (ex. Adopt / Adapt / Build) avec évaluation économique",
        4,
        "2025-12-12",
        "2025-12-22",
        [
          [
            "Élaboration des scénarios Adopt / Adapt / Build et évaluation économique",
            "2025-12-12",
            "2025-12-18",
          ],
          ["Comparaison NPV / payback / TCO 5 ans par scénario", "2025-12-15", "2025-12-20"],
          ["Validation du business case par le programme", "2025-12-18", "2025-12-22"],
        ]
      ),
      ws(
        "8 | Analyse des modèles de licence & services",
        5,
        "2025-12-01",
        "2025-12-14",
        [
          ["Comparaison modèles licence (user / volume / module)", "2025-12-01", "2025-12-07"],
          ["Coûts d'implémentation SI, AMS, formation, data", "2025-12-05", "2025-12-11"],
          ["Identification des clauses de prix et d'indexation", "2025-12-08", "2025-12-14"],
        ]
      ),
    ],
  },
  {
    phase: "Cadrage",
    nom: "C | Sécuriser la sélection",
    ordre: 6,
    date_cible: "2026-02-20",
    statut: "Planifié",
    description:
      "Comparatif objectivé, arbitrages, pré-négociation, dossier de décision.",
    workstreams: [
      ws(
        "8 | Evaluation comparative objectivée des offres",
        1,
        "2025-12-18",
        "2026-01-12",
        [
          [
            "Consolidation comparative des évaluations technico-fonctionnelles et financières",
            "2025-12-18",
            "2026-01-08",
          ],
          ["Scorecard consolidée et classement des offres", "2026-01-05", "2026-01-12"],
          ["Revue croisée cellule d'évaluation (4-eyes)", "2026-01-08", "2026-01-12"],
        ]
      ),
      ws(
        "9 | Arbitrage des écarts - positions Adopt/Adapt/Build & impacts coûts/délais/risques",
        2,
        "2026-01-08",
        "2026-01-28",
        [
          ["Instruction des dossiers d'arbitrages", "2026-01-08", "2026-01-18"],
          [
            "Formalisation de la version finale des arbitrages à intégrer au dossier de décision",
            "2026-01-16",
            "2026-01-26",
          ],
          ["Impact sur planning, budget et risques résiduels", "2026-01-20", "2026-01-28"],
        ]
      ),
      ws(
        "10 | Pre-negotiation",
        3,
        "2026-01-20",
        "2026-02-08",
        [
          ["Preparation des reunion de pre-negotiation", "2026-01-20", "2026-01-28"],
          ["Reunion de pre-negotiation", "2026-01-28", "2026-02-06"],
          ["Compte-rendu des engagements et conditions obtenues", "2026-02-04", "2026-02-08"],
        ]
      ),
      ws(
        "11 | Dossier de décision synthétique par chantier",
        4,
        "2026-01-25",
        "2026-02-18",
        [
          ["Formalisation du scénario de décision", "2026-01-25", "2026-02-02"],
          ["Formalisation de la note de décision synthétique", "2026-01-30", "2026-02-08"],
          ["Consolidation du dossier de décision", "2026-02-03", "2026-02-12"],
          ["Syndication et validation du dossier", "2026-02-08", "2026-02-18"],
        ]
      ),
      ws(
        "12 | Due diligence éditeur & références clients",
        5,
        "2026-01-15",
        "2026-02-10",
        [
          ["Prises de références clients bancaires (calls / site visits)", "2026-01-15", "2026-01-30"],
          ["Revue solidité financière et roadmap produit éditeur", "2026-01-20", "2026-02-05"],
          ["Avis juridique / compliance sur le partenaire retenu", "2026-01-28", "2026-02-10"],
        ]
      ),
    ],
  },
  {
    phase: "Cadrage",
    nom: "J7 | Décision d'attribution & notification",
    ordre: 7,
    date_cible: "2026-02-28",
    statut: "Planifié",
    description: "Instance de décision, notification, gestion des recours.",
    workstreams: [
      ws(
        "1 | Instance de décision",
        1,
        "2026-02-18",
        "2026-02-25",
        [
          ["Présentation du dossier au comité d'attribution", "2026-02-18", "2026-02-22"],
          ["Décision formelle et PV d'attribution", "2026-02-22", "2026-02-25"],
        ]
      ),
      ws(
        "2 | Notification & standstill",
        2,
        "2026-02-24",
        "2026-02-28",
        [
          ["Notification aux soumissionnaires", "2026-02-24", "2026-02-26"],
          ["Gestion période standstill / réponses aux questions", "2026-02-25", "2026-02-28"],
        ]
      ),
    ],
  },

  // ═══════════════════════════════════════════════════
  // EXÉCUTION
  // ═══════════════════════════════════════════════════
  {
    phase: "Exécution",
    nom: "J8 | Contractualisation & onboarding éditeur",
    ordre: 1,
    date_cible: "2026-04-15",
    statut: "Planifié",
    description: "Négociation finale, signature, mobilisation équipe éditeur.",
    workstreams: [
      ws(
        "1 | Négociation contractuelle",
        1,
        "2026-03-01",
        "2026-03-31",
        [
          ["Négociation clauses SLA, pénalités, IP, exit", "2026-03-01", "2026-03-20"],
          ["Finalisation des annexes techniques et SOW", "2026-03-10", "2026-03-28"],
          ["Circuit de signature et publication marché", "2026-03-25", "2026-03-31"],
        ]
      ),
      ws(
        "2 | Mobilisation & onboarding",
        2,
        "2026-03-20",
        "2026-04-15",
        [
          ["Plan de mobilisation ressources éditeur / SI / métiers", "2026-03-20", "2026-03-28"],
          ["Mise en place outils collab, environnements, accès", "2026-03-25", "2026-04-08"],
          ["Kick-off d'implémentation joint", "2026-04-08", "2026-04-15"],
        ]
      ),
      ws(
        "3 | PMO d'exécution & baseline",
        3,
        "2026-03-25",
        "2026-04-15",
        [
          ["Baseline planning détaillé (WBS / jalons contractuels)", "2026-03-25", "2026-04-05"],
          ["Dispositif RAID d'exécution et reporting", "2026-04-01", "2026-04-12"],
          ["Accord sur la definition of done par vague", "2026-04-08", "2026-04-15"],
        ]
      ),
    ],
  },
  {
    phase: "Exécution",
    nom: "J9 | Architecture cible & design solution",
    ordre: 2,
    date_cible: "2026-06-30",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Architecture d'entreprise & solution",
        1,
        "2026-04-15",
        "2026-06-10",
        [
          ["Architecture logique CBS et domaines de données", "2026-04-15", "2026-05-10"],
          ["Design des patterns d'intégration (API, events, batch)", "2026-04-25", "2026-05-25"],
          ["Sécurité, IAM, chiffrement, zoning réseau", "2026-05-10", "2026-06-05"],
          ["Validation architecture board / CISO", "2026-06-01", "2026-06-10"],
        ]
      ),
      ws(
        "2 | Design fonctionnel détaillé",
        2,
        "2026-04-20",
        "2026-06-20",
        [
          ["Spécifications fonctionnelles par domaine prioritaire", "2026-04-20", "2026-05-30"],
          ["Modèle produit / tarification / packages", "2026-05-05", "2026-06-10"],
          ["Règles métier transverses (client unique, KYC links)", "2026-05-15", "2026-06-15"],
          ["Revue et gel design V1 pour build", "2026-06-10", "2026-06-20"],
        ]
      ),
      ws(
        "3 | Environnements & DevOps",
        3,
        "2026-05-01",
        "2026-06-30",
        [
          ["Dimensionnement DEV / SIT / UAT / PREPROD / PROD", "2026-05-01", "2026-05-20"],
          ["Pipeline CI/CD et stratégie de déploiement", "2026-05-15", "2026-06-15"],
          ["Mise à disposition des environnements initiaux", "2026-06-01", "2026-06-30"],
        ]
      ),
    ],
  },
  {
    phase: "Exécution",
    nom: "J10 | Paramétrage produit & modules cœur",
    ordre: 3,
    date_cible: "2026-10-15",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Paramétrage cœur dépôts / comptes",
        1,
        "2026-06-15",
        "2026-09-15",
        [
          ["Paramétrage plan de comptes et produits de base", "2026-06-15", "2026-07-20"],
          ["Règles d'ouverture / clôture / gel / saisie-arrêt", "2026-07-10", "2026-08-20"],
          ["Intérêts, commissions, packages tarifaires", "2026-08-01", "2026-09-10"],
          ["Revue métier paramétrage vague 1", "2026-09-01", "2026-09-15"],
        ]
      ),
      ws(
        "2 | Modules associés (cartes, chéquiers, virements)",
        2,
        "2026-07-15",
        "2026-10-05",
        [
          ["Paramétrage virements domestiques / SEPA-like", "2026-07-15", "2026-08-25"],
          ["Règles chéquiers et oppositions", "2026-08-10", "2026-09-15"],
          ["Interfaces cartes / authorization (cadrage)", "2026-08-20", "2026-10-05"],
        ]
      ),
      ws(
        "3 | Contrôles & conformité produit",
        3,
        "2026-08-01",
        "2026-10-15",
        [
          ["Paramétrage contrôles KYC / limites / alertes", "2026-08-01", "2026-09-10"],
          ["Pistes d'audit et journalisation métier", "2026-08-20", "2026-09-25"],
          ["Validation conformité réglementaire paramétrage", "2026-09-20", "2026-10-15"],
        ]
      ),
    ],
  },
  {
    phase: "Exécution",
    nom: "J11 | Intégrations SI (interfaces, data, canaux)",
    ordre: 4,
    date_cible: "2026-12-15",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Intégrations cœur de banque & paiement",
        1,
        "2026-08-15",
        "2026-11-30",
        [
          ["Interfaces clearing / settlement / RTGS", "2026-08-15", "2026-10-15"],
          ["Interfaces mobile banking & internet banking", "2026-09-01", "2026-11-15"],
          ["Interfaces CRM / middle office commercial", "2026-09-15", "2026-11-20"],
          ["Tests d'intégration bout-en-bout (SIT)", "2026-10-20", "2026-11-30"],
        ]
      ),
      ws(
        "2 | Data platform & reporting",
        2,
        "2026-09-01",
        "2026-12-10",
        [
          ["Flux vers data warehouse / lakehouse", "2026-09-01", "2026-11-01"],
          ["Reporting réglementaire et de gestion", "2026-10-01", "2026-12-01"],
          ["Contrôles de réconciliation inter-systèmes", "2026-11-01", "2026-12-10"],
        ]
      ),
      ws(
        "3 | API management & sécurité d'intégration",
        3,
        "2026-08-20",
        "2026-12-05",
        [
          ["Exposition API sécurisée (gateway, OAuth/mTLS)", "2026-08-20", "2026-10-30"],
          ["Tests de charge et résilience des interfaces critiques", "2026-10-15", "2026-11-30"],
          ["Runbook d'exploitation des flux", "2026-11-15", "2026-12-05"],
        ]
      ),
    ],
  },
  {
    phase: "Exécution",
    nom: "J12 | Migration données (reprise & bascule pilote)",
    ordre: 5,
    date_cible: "2027-03-15",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Stratégie & règles de reprise",
        1,
        "2026-10-01",
        "2026-12-15",
        [
          ["Stratégie big-bang vs progressive par portefeuille", "2026-10-01", "2026-10-20"],
          ["Règles de mapping et de nettoyage données", "2026-10-10", "2026-11-20"],
          ["Critères d'acceptation de la reprise (DQ gates)", "2026-11-15", "2026-12-15"],
        ]
      ),
      ws(
        "2 | Cycles de migration pilote",
        2,
        "2026-12-01",
        "2027-02-20",
        [
          ["Dry-run #1 sur échantillon représentatif", "2026-12-01", "2026-12-20"],
          ["Dry-run #2 volume étendu + réconciliation", "2027-01-05", "2027-01-31"],
          ["Dry-run #3 dress rehearsal bascule", "2027-02-01", "2027-02-20"],
        ]
      ),
      ws(
        "3 | Bascule pilote & cutover plan",
        3,
        "2027-02-10",
        "2027-03-15",
        [
          ["Plan de cutover minute par minute", "2027-02-10", "2027-02-28"],
          ["Bascule pilote agences / segments pilotes", "2027-03-01", "2027-03-08"],
          ["Retour d'expérience pilote et go/no-go vague 1", "2027-03-08", "2027-03-15"],
        ]
      ),
    ],
  },
  {
    phase: "Exécution",
    nom: "J13 | Recette UAT, non-régression & performance",
    ordre: 6,
    date_cible: "2027-05-15",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Préparation UAT",
        1,
        "2027-02-15",
        "2027-03-31",
        [
          ["Jeux de données UAT et personas métier", "2027-02-15", "2027-03-10"],
          ["Scénarios de test bout-en-bout par parcours", "2027-02-20", "2027-03-20"],
          ["Formation des testeurs métier UAT", "2027-03-10", "2027-03-31"],
        ]
      ),
      ws(
        "2 | Exécution UAT & non-régression",
        2,
        "2027-03-20",
        "2027-05-05",
        [
          ["Campagne UAT vague 1", "2027-03-20", "2027-04-20"],
          ["Non-régression automatisée des parcours critiques", "2027-04-01", "2027-04-30"],
          ["Suivi des anomalies et retests", "2027-03-25", "2027-05-05"],
        ]
      ),
      ws(
        "3 | Performance, sécurité & acceptation",
        3,
        "2027-04-01",
        "2027-05-15",
        [
          ["Tests de performance et de résilience", "2027-04-01", "2027-04-25"],
          ["Tests d'intrusion / revue sécu pré-prod", "2027-04-10", "2027-05-05"],
          ["PV d'acceptation métier et technique", "2027-05-05", "2027-05-15"],
        ]
      ),
    ],
  },
  {
    phase: "Exécution",
    nom: "J14 | Formation, change & readiness opérationnelle",
    ordre: 7,
    date_cible: "2027-06-10",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Formation",
        1,
        "2027-04-01",
        "2027-06-05",
        [
          ["Parcours formation agence / back-office / support", "2027-04-01", "2027-05-15"],
          ["Formation des formateurs (train-the-trainer)", "2027-04-15", "2027-05-20"],
          ["Évaluation des compétences et certification interne", "2027-05-15", "2027-06-05"],
        ]
      ),
      ws(
        "2 | Change management & communication",
        2,
        "2027-03-15",
        "2027-06-10",
        [
          ["Plan de communication interne multi-cibles", "2027-03-15", "2027-04-15"],
          ["Accompagnement des managers de proximité", "2027-04-01", "2027-05-20"],
          ["FAQ terrain et cellule d'appui change", "2027-05-01", "2027-06-10"],
        ]
      ),
      ws(
        "3 | Operational readiness",
        3,
        "2027-05-01",
        "2027-06-10",
        [
          ["Procédures RUN, N2/N3, escalades", "2027-05-01", "2027-05-25"],
          ["Staffing hypercare et planning d'astreintes", "2027-05-10", "2027-06-01"],
          ["Checklist readiness go-live sign-off", "2027-05-25", "2027-06-10"],
        ]
      ),
    ],
  },
  {
    phase: "Exécution",
    nom: "J15 | Go-Live production (vague 1)",
    ordre: 8,
    date_cible: "2027-06-30",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Cutover production",
        1,
        "2027-06-10",
        "2027-06-28",
        [
          ["Gel des changements et war-room cutover", "2027-06-10", "2027-06-20"],
          ["Exécution du plan de bascule production", "2027-06-20", "2027-06-25"],
          ["Contrôles post-bascule et réconciliations J+0 / J+1", "2027-06-25", "2027-06-28"],
        ]
      ),
      ws(
        "2 | Pilotage go-live",
        2,
        "2027-06-20",
        "2027-06-30",
        [
          ["Command center multi-équipes (métier / SI / éditeur)", "2027-06-20", "2027-06-30"],
          ["Suivi KPI live (incidents, volumes, file d'attente)", "2027-06-25", "2027-06-30"],
          ["Décision go / no-go et communication Direction", "2027-06-28", "2027-06-30"],
        ]
      ),
    ],
  },
  {
    phase: "Exécution",
    nom: "J16 | Déploiement vagues 2+ & industrialisation",
    ordre: 9,
    date_cible: "2027-09-15",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Roll-out géographique / segments",
        1,
        "2027-07-01",
        "2027-09-10",
        [
          ["Plan de vagues 2 et 3 (réseau / corporate)", "2027-07-01", "2027-07-15"],
          ["Exécution vague 2 et stabilisation", "2027-07-15", "2027-08-20"],
          ["Exécution vague 3 et couverture réseau cible", "2027-08-15", "2027-09-10"],
        ]
      ),
      ws(
        "2 | Industrialisation & automatisation",
        2,
        "2027-07-10",
        "2027-09-15",
        [
          ["Industrialisation des runbooks de bascule", "2027-07-10", "2027-08-10"],
          ["Automatisation contrôles post-migration", "2027-07-20", "2027-08-31"],
          ["Retour d'expérience multi-vagues", "2027-09-01", "2027-09-15"],
        ]
      ),
    ],
  },

  // ═══════════════════════════════════════════════════
  // CLÔTURE
  // ═══════════════════════════════════════════════════
  {
    phase: "Clôture",
    nom: "J17 | Hypercare & stabilisation",
    ordre: 1,
    date_cible: "2027-10-15",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Support hypercare",
        1,
        "2027-07-01",
        "2027-09-30",
        [
          ["Cellule hypercare N1/N2/N3 et suivi tickets critiques", "2027-07-01", "2027-09-15"],
          ["War-room incidents majeurs et RCA", "2027-07-01", "2027-09-30"],
          ["Suivi satisfaction terrain (agences / back-office)", "2027-07-15", "2027-09-30"],
        ]
      ),
      ws(
        "2 | Stabilisation performance & qualité",
        2,
        "2027-07-15",
        "2027-10-10",
        [
          ["Tuning performance prod et capacité", "2027-07-15", "2027-09-15"],
          ["Plan de correction des anomalies résiduelles", "2027-07-20", "2027-10-01"],
          ["Critères de sortie d'hypercare et décision de bascule RUN", "2027-09-20", "2027-10-10"],
        ]
      ),
    ],
  },
  {
    phase: "Clôture",
    nom: "J18 | Bilan projet & capitalisation",
    ordre: 2,
    date_cible: "2027-10-31",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Bilan coûts / délais / bénéfices",
        1,
        "2027-09-15",
        "2027-10-20",
        [
          ["Comparaison baseline vs réalisé (budget, jalons)", "2027-09-15", "2027-10-05"],
          ["Mesure des bénéfices (time-to-market, ops, client)", "2027-09-20", "2027-10-15"],
          ["Rapport de clôture programme pour le COPIL", "2027-10-05", "2027-10-20"],
        ]
      ),
      ws(
        "2 | Lessons learned & assets",
        2,
        "2027-09-20",
        "2027-10-31",
        [
          ["Ateliers lessons learned multi-équipes", "2027-09-20", "2027-10-10"],
          ["Capitalisation modèles (exigences, tests, cutover)", "2027-10-01", "2027-10-25"],
          ["Recommandations pour vagues futures / filiales", "2027-10-15", "2027-10-31"],
        ]
      ),
    ],
  },
  {
    phase: "Clôture",
    nom: "J19 | Clôture contractuelle & transfert RUN",
    ordre: 3,
    date_cible: "2027-11-15",
    statut: "Planifié",
    workstreams: [
      ws(
        "1 | Transfert au RUN",
        1,
        "2027-10-01",
        "2027-11-05",
        [
          ["Transfert documentation, accès, procédures", "2027-10-01", "2027-10-20"],
          ["Accord de service AMS / TMA avec indicateurs", "2027-10-10", "2027-10-31"],
          ["Sign-off formal de prise en charge RUN", "2027-10-25", "2027-11-05"],
        ]
      ),
      ws(
        "2 | Clôture contractuelle & administrative",
        2,
        "2027-10-15",
        "2027-11-15",
        [
          ["Réception définitive et levée des réserves", "2027-10-15", "2027-11-01"],
          ["Clôture financière du marché / avenants", "2027-10-20", "2027-11-10"],
          ["Archivage projet et clôture administrative", "2027-11-01", "2027-11-15"],
        ]
      ),
    ],
  },
];

async function main() {
  const chantier = await prisma.chantier.findFirst({
    where: {
      OR: [
        { code: "CH_023" },
        { code: "CH023" },
        { code: { contains: "023" } },
      ],
    },
  });

  if (!chantier) {
    console.error("Chantier CH_023 introuvable.");
    process.exit(1);
  }

  console.log(
    `Chantier : ${chantier.code} — ${chantier.nom}\nID: ${chantier.id}`
  );

  const deleted = await prisma.jalon.deleteMany({
    where: { chantierId: chantier.id },
  });
  console.log(`Ancien planning purgé : ${deleted.count} jalon(s)`);

  await prisma.chantier.update({
    where: { id: chantier.id },
    data: {
      date_debut: d("2025-01-15"),
      date_fin: d("2027-11-15"),
      statut: "En cours",
    },
  });

  let jCount = 0;
  let wCount = 0;
  let aCount = 0;

  for (const j of PLANNING) {
    await prisma.jalon.create({
      data: {
        chantierId: chantier.id,
        phase: j.phase,
        nom: j.nom,
        ordre: j.ordre,
        date_cible: d(j.date_cible),
        statut: j.statut ?? "Planifié",
        description: j.description ?? "",
        livrables: "",
        commentaire: "Planning démonstration — Directeur de projet senior",
        workstreams: j.workstreams
          ? {
              create: j.workstreams.map((w) => ({
                nom: w.nom,
                ordre: w.ordre,
                date_debut: d(w.date_debut),
                date_fin: d(w.date_fin),
                statut: w.statut ?? "Planifié",
                description: "",
                commentaire: "",
                activites: {
                  create: w.activites.map((a) => ({
                    nom: a.nom,
                    ordre: a.ordre,
                    date_debut: d(a.date_debut),
                    date_fin: d(a.date_fin),
                    statut: a.statut ?? "Planifié",
                    description: "",
                    commentaire: "",
                  })),
                },
              })),
            }
          : undefined,
      },
    });
    jCount++;
    if (j.workstreams) {
      wCount += j.workstreams.length;
      aCount += j.workstreams.reduce((n, w) => n + w.activites.length, 0);
    }
  }

  console.log("────────────────────────────────────");
  console.log(`✓ ${jCount} jalons`);
  console.log(`✓ ${wCount} workstreams`);
  console.log(`✓ ${aCount} activités`);
  console.log(
    `Gantt : /chantiers/${chantier.id}/gantt`
  );
  console.log(
    `Fiche  : /chantiers/${chantier.id}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
