import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Get existing chantiers to link RAID items
  const chantiers = await prisma.chantier.findMany({ select: { id: true, code: true, nom: true } });
  console.log(`Found ${chantiers.length} chantiers`);

  if (chantiers.length === 0) {
    console.log("No chantiers found — RAID items will be created without chantier links.");
  }

  // Helper to pick a random chantier ID
  const pickChantier = (index: number) => chantiers[index % chantiers.length]?.id ?? null;

  // ── RISKS ──────────────────────────────────────────────
  const risks = [
    {
      type: "Risque",
      intitule: "Retard de livraison du progiciel bancaire EI",
      description: "Le fournisseur EI pourrait ne pas livrer la version cible dans les délais prévus, impactant l'ensemble du programme.",
      categorie: "Fournisseur",
      domaine: "Programme Office",
      probabilite: 4,
      impact: 5,
      strategie: "Atténuer",
      mitigation: "Suivi hebdomadaire avec EI, clause pénalité contractuelle, plan B avec version intermédiaire.",
      responsable: "M. Alami",
      statut: "Ouvert",
      date_identification: new Date("2025-09-15"),
      date_revision: new Date("2026-03-01"),
    },
    {
      type: "Risque",
      intitule: "Pénurie de ressources AMOA qualifiées",
      description: "Difficulté à recruter des profils AMOA avec expertise bancaire et connaissance des processus métier.",
      categorie: "Ressources",
      domaine: "Programme Office",
      probabilite: 3,
      impact: 4,
      strategie: "Atténuer",
      mitigation: "Recours à des prestataires spécialisés, formation interne accélérée.",
      responsable: "Mme Bennani",
      statut: "En mitigation",
      date_identification: new Date("2025-10-01"),
      date_revision: new Date("2026-02-15"),
    },
    {
      type: "Risque",
      intitule: "Non-conformité réglementaire Bank Al-Maghrib",
      description: "Les nouvelles fonctionnalités pourraient ne pas respecter les dernières directives BAM sur la monétique.",
      categorie: "Stratégique",
      domaine: "Monétique",
      probabilite: 2,
      impact: 5,
      strategie: "Éviter",
      mitigation: "Audit réglementaire préalable avec cabinet externe, validation juridique systématique.",
      responsable: "M. El Fassi",
      statut: "Surveillé",
      date_identification: new Date("2025-11-20"),
      date_revision: new Date("2026-03-05"),
    },
    {
      type: "Risque",
      intitule: "Incompatibilité des données migrées",
      description: "Les données de l'ancien système pourraient ne pas être compatibles avec le nouveau modèle de données EI.",
      categorie: "Technique",
      domaine: "Migration",
      probabilite: 3,
      impact: 4,
      strategie: "Atténuer",
      mitigation: "Campagnes de data cleansing, scripts de transformation, tests de migration à blanc.",
      responsable: "M. Chraibi",
      statut: "Ouvert",
      date_identification: new Date("2025-12-10"),
      date_revision: new Date("2026-02-28"),
    },
    {
      type: "Risque",
      intitule: "Dépassement budgétaire infrastructure cloud",
      description: "Les coûts d'infrastructure pourraient dépasser l'enveloppe prévue suite aux exigences de performance.",
      categorie: "Budget",
      domaine: "Infrastructure",
      probabilite: 3,
      impact: 3,
      strategie: "Accepter",
      mitigation: "Monitoring mensuel des coûts, optimisation des ressources, négociation contrat pluriannuel.",
      responsable: "M. Tazi",
      statut: "Planifié",
      date_identification: new Date("2026-01-08"),
      date_revision: new Date("2026-03-01"),
    },
  ];

  // ── ACTIONS ────────────────────────────────────────────
  const actions = [
    {
      type: "Action",
      intitule: "Finaliser le cahier des charges monétique",
      description: "Compléter les spécifications fonctionnelles détaillées pour le module monétique.",
      categorie: "Opérationnel",
      domaine: "Monétique",
      responsable: "Mme Lahlou",
      statut: "En cours",
      date_identification: new Date("2026-01-15"),
      date_echeance: new Date("2026-03-05"),
      date_revision: new Date("2026-02-20"),
    },
    {
      type: "Action",
      intitule: "Organiser la formation des key users Agence",
      description: "Planifier et dispenser la formation pour les utilisateurs clés du module Agence.",
      categorie: "Ressources",
      domaine: "Agence",
      responsable: "M. Berrada",
      statut: "A planifier",
      date_identification: new Date("2026-02-01"),
      date_echeance: new Date("2026-04-30"),
    },
    {
      type: "Action",
      intitule: "Valider l'architecture technique cible",
      description: "Revue et validation de l'architecture technique avec le Design Authority Board.",
      categorie: "Technique",
      domaine: "Architecture et sécurité",
      responsable: "M. Tazi",
      statut: "En cours",
      date_identification: new Date("2026-01-20"),
      date_echeance: new Date("2026-02-28"),
      date_revision: new Date("2026-02-15"),
    },
    {
      type: "Action",
      intitule: "Lancer l'appel d'offres intégrateur BSS",
      description: "Préparer et lancer la consultation pour l'intégrateur du module BSS.",
      categorie: "Fournisseur",
      domaine: "BSS",
      responsable: "Mme Bennani",
      statut: "Clôturé",
      date_identification: new Date("2025-11-01"),
      date_echeance: new Date("2026-01-15"),
      date_revision: new Date("2026-01-10"),
    },
    {
      type: "Action",
      intitule: "Mettre à jour le planning programme Q2 2026",
      description: "Réviser le planning directeur intégrant les dernières dépendances inter-chantiers.",
      categorie: "Planning",
      domaine: "Programme Office",
      responsable: "M. Alami",
      statut: "A lancer",
      date_identification: new Date("2026-03-01"),
      date_echeance: new Date("2026-03-15"),
    },
    {
      type: "Action",
      intitule: "Effectuer les tests de migration virement domestique",
      description: "Exécuter les tests de migration des données virements et prélèvements depuis l'ancien système.",
      categorie: "Technique",
      domaine: "Virements domestiques & prélèvements",
      responsable: "M. Chraibi",
      statut: "En cours",
      date_identification: new Date("2026-02-10"),
      date_echeance: new Date("2026-03-20"),
    },
    {
      type: "Action",
      intitule: "Négocier le contrat de support EI niveau 2",
      description: "Finaliser les conditions contractuelles du support niveau 2 avec l'éditeur EI.",
      categorie: "Fournisseur",
      domaine: "Programme Office",
      responsable: "Mme Bennani",
      statut: "Stand-By",
      date_identification: new Date("2026-01-05"),
      date_echeance: new Date("2026-02-15"),
    },
  ];

  // ── INFORMATIONS ───────────────────────────────────────
  const informations = [
    {
      type: "Information",
      intitule: "Nouvelle directive BAM sur les paiements instantanés",
      description: "Bank Al-Maghrib publie de nouvelles exigences pour les paiements instantanés, applicables à partir de Q3 2026.",
      categorie: "Stratégique",
      domaine: "Virements domestiques & prélèvements",
      responsable: "M. El Fassi",
      statut: "Ouvert",
      date_identification: new Date("2026-02-20"),
    },
    {
      type: "Information",
      intitule: "Migration vers Kubernetes planifiée par la DSI",
      description: "La DSI prévoit une migration globale vers Kubernetes, à intégrer dans l'architecture cible du programme.",
      categorie: "Technique",
      domaine: "Infrastructure",
      responsable: "M. Tazi",
      statut: "Ouvert",
      date_identification: new Date("2026-01-25"),
    },
    {
      type: "Information",
      intitule: "Fermeture annuelle du 28 au 31 décembre 2026",
      description: "Gel des mises en production du 28 au 31 décembre. Planifier les releases en conséquence.",
      categorie: "Planning",
      domaine: "Programme Office",
      responsable: "M. Alami",
      statut: "Ouvert",
      date_identification: new Date("2026-03-05"),
    },
    {
      type: "Information",
      intitule: "Partenariat Visa renouvelé pour 3 ans",
      description: "Le contrat Visa a été renouvelé avec de nouvelles conditions tarifaires avantageuses.",
      categorie: "Fournisseur",
      domaine: "Monétique",
      responsable: "Mme Lahlou",
      statut: "Clôturé",
      date_identification: new Date("2026-02-10"),
    },
  ];

  // ── DECISIONS ──────────────────────────────────────────
  const decisions = [
    {
      type: "Décision",
      intitule: "Adopter l'approche Big Bang pour la migration chèques",
      description: "Décision de migrer l'ensemble du module chèques en une seule vague plutôt qu'en migration progressive.",
      categorie: "Stratégique",
      domaine: "Chèques & LCN",
      responsable: "M. Alami",
      statut: "Validée",
      date_identification: new Date("2026-02-05"),
    },
    {
      type: "Décision",
      intitule: "Reporter le Go-Live Bancassurance à Q4 2026",
      description: "Suite aux retards du partenaire assurance, le Go-Live est reporté de Q3 à Q4 2026.",
      categorie: "Planning",
      domaine: "Bancassurance",
      responsable: "Mme Bennani",
      statut: "En attente",
      date_identification: new Date("2026-03-01"),
    },
    {
      type: "Décision",
      intitule: "Augmenter le budget infrastructure de 15%",
      description: "Enveloppe supplémentaire de 15% pour couvrir les besoins en haute disponibilité et DR.",
      categorie: "Budget",
      domaine: "Infrastructure",
      responsable: "M. Tazi",
      statut: "En attente",
      date_identification: new Date("2026-02-25"),
    },
    {
      type: "Décision",
      intitule: "Sélectionner le prestataire MOE pour le module Crédit",
      description: "Choix du prestataire retenu suite à l'appel d'offres MOE Crédit.",
      categorie: "Fournisseur",
      domaine: "Crédit",
      responsable: "M. Alami",
      statut: "Validée",
      date_identification: new Date("2026-01-20"),
    },
    {
      type: "Décision",
      intitule: "Externaliser les tests de performance",
      description: "Décision de confier les tests de performance à un cabinet spécialisé plutôt que de les réaliser en interne.",
      categorie: "Technique",
      domaine: "Programme Office",
      responsable: "M. Chraibi",
      statut: "Refusée",
      date_identification: new Date("2026-02-15"),
    },
  ];

  // Insert all RAID items
  const allItems = [...risks, ...actions, ...informations, ...decisions];

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const chantierId = chantiers.length > 0 ? pickChantier(i) : null;

    await prisma.raid.create({
      data: {
        type: item.type,
        intitule: item.intitule,
        description: item.description,
        categorie: item.categorie,
        domaine: item.domaine,
        probabilite: "probabilite" in item ? (item.probabilite as number) : null,
        impact: "impact" in item ? (item.impact as number) : null,
        strategie: "strategie" in item ? (item.strategie as string) : "",
        mitigation: "mitigation" in item ? (item.mitigation as string) : "",
        responsable: item.responsable,
        statut: item.statut,
        date_identification: item.date_identification ?? null,
        date_revision: "date_revision" in item ? (item.date_revision as Date) : null,
        date_echeance: "date_echeance" in item ? (item.date_echeance as Date) : null,
        commentaires: "",
        chantierId,
      },
    });
    console.log(`Created [${item.type}] ${item.intitule}`);
  }

  console.log(`\nDone! Created ${allItems.length} RAID items (${risks.length} risks, ${actions.length} actions, ${informations.length} informations, ${decisions.length} decisions).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
