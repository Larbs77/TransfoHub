import { createPrismaClient } from "../lib/create-prisma";
import { DEFAULT_ROLE_PAGES, ALL_PAGE_PATHS } from "../lib/app-pages";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import * as path from "path";

const prisma = createPrismaClient();

async function main() {
  // Nettoyage (order matters for FK constraints)
  await prisma.jalonTemplate.deleteMany();
  await prisma.consultationQuestion.deleteMany();
  await prisma.favoriChantier.deleteMany();
  await prisma.adherence.deleteMany();
  await prisma.jalon.deleteMany();
  await prisma.saisieTemps.deleteMany();
  await prisma.membreEquipe.deleteMany();
  await prisma.chantierRmd.deleteMany();
  await prisma.raid.deleteMany();
  await prisma.chantier.deleteMany();
  await prisma.comite.deleteMany();
  await prisma.comiteParametre.deleteMany();
  await prisma.equipe.deleteMany();
  await prisma.rmd.deleteMany();
  // Detach users from resources before wiping the resource catalog
  await prisma.user.updateMany({ data: { ressourceId: null } });
  await prisma.ressource.deleteMany();
  await prisma.profilRessource.deleteMany();
  await prisma.statusConfig.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.appRole.deleteMany();

  // Rôles applicatifs par défaut
  const defaultRoles = [
    {
      code: "Admin",
      label: "Administrateur",
      description: "Accès complet à l'application et à l'administration",
      color: "#dc2626",
      is_system: true,
      chantier_scope: "all",
      pages: DEFAULT_ROLE_PAGES.Admin ?? ALL_PAGE_PATHS,
    },
    {
      code: "Programme_Office",
      label: "Bureau Programme",
      description: "Pilotage programme et gouvernance",
      color: "#2563eb",
      is_system: true,
      chantier_scope: "all",
      pages: DEFAULT_ROLE_PAGES.Programme_Office,
    },
    {
      code: "PMO_Chantier",
      label: "PMO Chantier",
      description: "Pilotage des chantiers assignés",
      color: "#059669",
      is_system: true,
      chantier_scope: "assigned",
      pages: DEFAULT_ROLE_PAGES.PMO_Chantier,
    },
    {
      code: "Workforce_Manager",
      label: "Gestionnaire Ressources",
      description: "Gestion des ressources, profils et capacité",
      color: "#7c3aed",
      is_system: true,
      chantier_scope: "none",
      pages: DEFAULT_ROLE_PAGES.Workforce_Manager,
    },
  ];
  for (const r of defaultRoles) {
    await prisma.appRole.create({
      data: {
        ...r,
        is_active: true,
      },
    });
  }

  // Paramètres par défaut
  await prisma.settings.create({
    data: { id: 1, seuil_relance_jours: 3, seuil_qa_critique_heures: 48 },
  });

  // Bank teams (owners for committee types)
  const equipesData = [
    {
      name: "Bureau Programme",
      description: "Bureau du programme de transformation",
      position: 0,
    },
    {
      name: "Direction Technologie",
      description: "Direction des technologies et SI",
      position: 1,
    },
    {
      name: "Assurance Qualité",
      description: "Équipe assurance qualité",
      position: 2,
    },
    {
      name: "Direction Générale",
      description: "Direction générale",
      position: 3,
    },
    {
      name: "Architecture Entreprise",
      description: "Architecture d'entreprise",
      position: 4,
    },
  ];
  const equipeByName: Record<string, string> = {};
  for (const eq of equipesData) {
    const created = await prisma.equipe.create({
      data: { ...eq, is_active: true },
    });
    equipeByName[eq.name] = created.id;
  }

  // Catalog of committee types (instances) — admin-managed
  const comiteParametres = [
    {
      name: "Comité Programme",
      description: "Instance de pilotage du programme de transformation bancaire",
      frequency: "Bi-mensuel",
      owner: "Bureau Programme",
      short_label: "Comité Programme",
      color: "#2563eb",
      position: 0,
    },
    {
      name: "Comité Technologique restreint (CTR)",
      description: "Comité technologique en formation restreinte pour arbitrages techniques",
      frequency: "Hebdomadaire",
      owner: "Direction Technologie",
      short_label: "CTR",
      color: "#059669",
      position: 1,
    },
    {
      name: "Comité Technologique Plénier (CTP)",
      description: "Comité technologique plénier pour décisions d'architecture et de capacité",
      frequency: "Mensuel",
      owner: "Direction Technologie",
      short_label: "CTP",
      color: "#0d9488",
      position: 2,
    },
    {
      name: "Comité Assurance Qualité",
      description: "Suivi de la qualité, des tests et des critères d'acceptation",
      frequency: "Mensuel",
      owner: "Assurance Qualité",
      short_label: "Comité Assurance Qualité",
      color: "#7c3aed",
      position: 3,
    },
    {
      name: "Conseil",
      description: "Instance de gouvernance stratégique et de validation exécutive",
      frequency: "Trimestriel",
      owner: "Direction Générale",
      short_label: "Conseil",
      color: "#dc2626",
      position: 4,
    },
    {
      name: "Design Authority Board",
      description: "Autorité de design pour les choix d'architecture applicative et data",
      frequency: "Bi-mensuel",
      owner: "Architecture Entreprise",
      short_label: "Design Authority Board",
      color: "#ea580c",
      position: 5,
    },
    {
      name: "Kick-off",
      description: "Séance de lancement d'un chantier ou d'un lot de transformation",
      frequency: "Ad hoc",
      owner: "Bureau Programme",
      short_label: "Kick-off",
      color: "#ca8a04",
      position: 6,
    },
  ];
  for (const cp of comiteParametres) {
    await prisma.comiteParametre.create({
      data: {
        ...cp,
        is_active: true,
        equipeId: equipeByName[cp.owner] ?? null,
      },
    });
  }

  // Default status configurations
  const statusConfigs = [
    // Action
    { type: "Action", label: "A planifier", color: "#d4d4d8", position: 0 },
    { type: "Action", label: "Planifié", color: "#a78bfa", position: 1 },
    { type: "Action", label: "A lancer", color: "#94a3b8", position: 2 },
    { type: "Action", label: "En cours", color: "#3b82f6", position: 3 },
    { type: "Action", label: "Stand-By", color: "#f59e0b", position: 4 },
    { type: "Action", label: "Clôturé", color: "#22c55e", position: 5 },
    { type: "Action", label: "Abandonné", color: "#6b7280", position: 6 },
    { type: "Action", label: "NA", color: "#9ca3af", position: 7 },
    { type: "Action", label: "Doublon", color: "#9ca3af", position: 8 },
    // Risque
    { type: "Risque", label: "Ouvert", color: "#ef4444", position: 0 },
    { type: "Risque", label: "En mitigation", color: "#f59e0b", position: 1 },
    { type: "Risque", label: "Surveillé", color: "#3b82f6", position: 2 },
    { type: "Risque", label: "Planifié", color: "#8b5cf6", position: 3 },
    { type: "Risque", label: "Clos", color: "#22c55e", position: 4 },
    { type: "Risque", label: "Matérialisé", color: "#dc2626", position: 5 },
    // Information
    { type: "Information", label: "Ouvert", color: "#3b82f6", position: 0 },
    { type: "Information", label: "Clôturé", color: "#22c55e", position: 1 },
    // Décision
    { type: "Décision", label: "En attente", color: "#f59e0b", position: 0 },
    { type: "Décision", label: "Validée", color: "#22c55e", position: 1 },
    { type: "Décision", label: "Refusée", color: "#ef4444", position: 2 },
    { type: "Décision", label: "Reportée", color: "#94a3b8", position: 3 },
  ];
  for (const sc of statusConfigs) {
    await prisma.statusConfig.create({ data: sc });
  }

  // RMDs
  const rmdsData = [
    { nom_complet: "Adil Lachhab", domaine: "Intégrations", suppleant: "Youssef Benali" },
    { nom_complet: "Siham Abeis", domaine: "Distribution & communication", suppleant: "Fatima Zahrae Ouali" },
    { nom_complet: "Mohamed Mharek", domaine: "Capacités techniques", suppleant: "Ahmed Tazi" },
    { nom_complet: "Abdelaziz Harchaoui", domaine: "Référentiels", suppleant: "" },
    { nom_complet: "Karim Benjelloun", domaine: "Risques", suppleant: "Nadia Alami" },
    { nom_complet: "Laila Chraibi", domaine: "Conformité", suppleant: "Omar Fassi" },
    { nom_complet: "Hassan Idrissi", domaine: "Crédits", suppleant: "" },
    { nom_complet: "Rachid Bennani", domaine: "Finance, contrôle de gestion et comptabilité", suppleant: "Samira El Amrani" },
  ];

  const createdRmds: Record<string, string> = {};
  for (const r of rmdsData) {
    const rmd = await prisma.rmd.create({ data: r });
    createdRmds[r.nom_complet] = rmd.id;
  }

  // Mapping RMDs to chantier codes
  const chantierRmdMap: Record<string, string[]> = {
    CH_014: ["Adil Lachhab", "Abdelaziz Harchaoui"],
    CH_016: ["Siham Abeis"],
    CH_023: ["Siham Abeis"],
    CH_032: ["Mohamed Mharek"],
    CH_038: ["Mohamed Mharek"],
    CH_043: ["Adil Lachhab", "Siham Abeis"],
    CH_009: ["Karim Benjelloun"],
    CH_010: ["Karim Benjelloun"],
    CH_011: ["Karim Benjelloun"],
    CH_006: ["Laila Chraibi"],
    CH_007: ["Laila Chraibi"],
    CH_012: ["Hassan Idrissi"],
    CH_013: ["Hassan Idrissi"],
    CH_021: ["Rachid Bennani"],
    CH_039: ["Rachid Bennani"],
  };

  // Mapping responsable + statut from Chantiers_Suivi sheet
  const suiviMap: Record<string, { responsable: string; enCours: boolean }> = {
    CH_014: { responsable: "Adil Lachhab / Abdelaziz Harchaoui", enCours: true },
    CH_016: { responsable: "Siham Abeis", enCours: true },
    CH_023: { responsable: "Siham Abeis", enCours: true },
    CH_030: { responsable: "", enCours: true },
    CH_032: { responsable: "Mohamed Mharek", enCours: true },
    CH_038: { responsable: "Mohamed Mharek", enCours: true },
    CH_043: { responsable: "Adil Lachhab", enCours: true },
    CH_045: { responsable: "", enCours: true },
  };

  // Determine statut based on dates and "en cours" flag
  function deriveStatut(code: string, dateDebut: Date, dateFin: Date): string {
    const now = new Date();
    if (dateFin < now) return "Clôturé";
    const suivi = suiviMap[code];
    if (suivi?.enCours) return "Exécution";
    if (dateDebut <= now) return "Cadrage";
    // Future start dates
    const threeMonthsBefore = new Date(dateDebut);
    threeMonthsBefore.setMonth(threeMonthsBefore.getMonth() - 3);
    if (now >= threeMonthsBefore) return "Pré cadrage";
    return "Non démarré";
  }

  // 46 chantiers from Excel "Liste_Chantiers" sheet
  const chantiersData: {
    code: string;
    nom: string;
    domaine: string;
    type_chantier: string;
    priorite: string;
    duree_mois: number;
    date_debut: string;
    date_fin: string;
  }[] = [
    { code: "CH_001", nom: "Fondations techniques et déploiement du DataLake centralisé", domaine: "Cockpit", type_chantier: "Migration / Data clensing", priorite: "Fondations techniques", duree_mois: 12, date_debut: "2026-01-01", date_fin: "2027-01-01" },
    { code: "CH_002", nom: "Rationalisation des développements interne et extension fonctionnelle de HR Access", domaine: "Capital humain", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 9, date_debut: "2028-01-01", date_fin: "2028-10-01" },
    { code: "CH_003", nom: "Consolidation du SI Achat et Logistique au Service de la Performance", domaine: "Achats & logistique", type_chantier: "Progiciel + Sélection", priorite: "Indépendante de EI", duree_mois: 3, date_debut: "2030-01-01", date_fin: "2030-04-01" },
    { code: "CH_004", nom: "Sécurisation et intégration du SI juridique", domaine: "Juridique", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 6, date_debut: "2028-01-01", date_fin: "2028-07-01" },
    { code: "CH_005", nom: "Veille Stratégique Augmentée par la Donnée & l'Automatisation", domaine: "CIE", type_chantier: "Progiciel / Home Dev", priorite: "Indépendante de EI", duree_mois: 6, date_debut: "2030-01-01", date_fin: "2030-07-01" },
    { code: "CH_006", nom: "Mise en place d'une Plateforme de Conformité Intelligente et Résiliente (Smart Compliance)", domaine: "Conformité", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 12, date_debut: "2028-01-01", date_fin: "2029-01-01" },
    { code: "CH_007", nom: "Référentiel Groupe Conformité & Pilotage Réglementaire Centralisé", domaine: "Conformité", type_chantier: "Progiciel / Home Dev", priorite: "Indépendante de EI", duree_mois: 12, date_debut: "2027-01-01", date_fin: "2028-01-01" },
    { code: "CH_008", nom: "Portail unique et intégré de Contrôle Interne et Permanent", domaine: "Contrôle interne & Contrôle permanent", type_chantier: "Progiciel / Home Dev", priorite: "Briques Satellite EI", duree_mois: 16, date_debut: "2026-11-01", date_fin: "2028-03-01" },
    { code: "CH_009", nom: "Modernisation des outils risques crédit", domaine: "Risques", type_chantier: "Progiciel + Sélection", priorite: "Dépendante de EI", duree_mois: 12, date_debut: "2028-01-01", date_fin: "2029-01-01" },
    { code: "CH_010", nom: "Mise en place d'une Plateforme Governance Risk Compliance pour la gestion intégrée des risques, audit et conformité", domaine: "Risques", type_chantier: "Progiciel + Sélection", priorite: "Indépendante de EI", duree_mois: 6, date_debut: "2026-05-01", date_fin: "2026-11-01" },
    { code: "CH_011", nom: "Une Vision Consolidée et Fiable des données Risques Groupe", domaine: "Risques", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 18, date_debut: "2027-05-01", date_fin: "2028-11-01" },
    { code: "CH_012", nom: "Digitalisation de l'octroi et gestion du cycle de vie du crédit", domaine: "Crédits", type_chantier: "Progiciel + Sélection", priorite: "Briques Satellite EI", duree_mois: 12, date_debut: "2027-01-01", date_fin: "2028-01-01" },
    { code: "CH_013", nom: "Optimisation du processus de recouvrement", domaine: "Crédits", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 12, date_debut: "2027-11-01", date_fin: "2028-11-01" },
    { code: "CH_014", nom: "Mise en place des référentiels Client/Tiers/Produit/habilitation/HR Centralisés pour une vision client 360°", domaine: "Référentiels", type_chantier: "Progiciel / Home Dev", priorite: "Fondations techniques", duree_mois: 24, date_debut: "2026-01-01", date_fin: "2028-01-01" },
    { code: "CH_015", nom: "Centralisation et modernisation du référentiel tarifaire bancaire", domaine: "Référentiels", type_chantier: "Progiciel / Home Dev", priorite: "Briques transverses EI", duree_mois: 24, date_debut: "2026-01-01", date_fin: "2028-01-01" },
    { code: "CH_016", nom: "Une plateforme CRM unifiée pour la distribution multicanale", domaine: "Distribution & communication", type_chantier: "Progiciel + Sélection", priorite: "Briques transverses EI", duree_mois: 12, date_debut: "2026-01-01", date_fin: "2027-01-01" },
    { code: "CH_017", nom: "Digitalisation des parcours de souscription aux produits/packages et décommissionnement progressif d'INDIGO", domaine: "Distribution & communication", type_chantier: "Progiciel + Sélection", priorite: "Briques Satellite EI", duree_mois: 12, date_debut: "2028-01-01", date_fin: "2029-01-01" },
    { code: "CH_018", nom: "Centralisation de Business Online vers une expérience client corporate moderne", domaine: "Distribution & communication", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 18, date_debut: "2027-01-01", date_fin: "2028-07-01" },
    { code: "CH_019", nom: "Un Hub Digital BoA pour une Banque 100% Omnicanale", domaine: "Distribution & communication", type_chantier: "Intégration", priorite: "Briques Satellite EI", duree_mois: 9, date_debut: "2028-04-01", date_fin: "2029-01-01" },
    { code: "CH_020", nom: "Connexion du centre de relation client (CRC) au CRM unifié pour un Service Client Réactif et Personnalisé", domaine: "Distribution & communication", type_chantier: "Progiciel + Sélection", priorite: "Briques Satellite EI", duree_mois: 6, date_debut: "2027-01-01", date_fin: "2027-07-01" },
    { code: "CH_021", nom: "Refonte et simplification de l'architecture comptable pour une position en temps réel.", domaine: "Finance, contrôle de gestion et comptabilité", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 18, date_debut: "2027-05-01", date_fin: "2028-11-01" },
    { code: "CH_022", nom: "Centralisation et modernisation du référentiel titres et portefeuille", domaine: "Titres et placements", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 12, date_debut: "2029-01-01", date_fin: "2030-01-01" },
    { code: "CH_023", nom: "Mise en place d'un Core Banking System (CBS) pour la gestion complète des comptes, dépôts, solde, produits et packages", domaine: "Banque du quotidien", type_chantier: "Progiciel + Sélection", priorite: "Briques transverses EI", duree_mois: 24, date_debut: "2026-01-01", date_fin: "2028-01-01" },
    { code: "CH_024", nom: "Portail Agence Unifié & Migration des Applications Legacy", domaine: "Banque du quotidien", type_chantier: "Progiciel + Sélection", priorite: "Briques Satellite EI", duree_mois: 19, date_debut: "2027-06-01", date_fin: "2029-01-01" },
    { code: "CH_025", nom: "Refonte et centralisation des systèmes de paiement et chèques/LCN et mise en place d'un Hub de Paiement ISO 20022", domaine: "Paiements & transaction banking", type_chantier: "Progiciel + Sélection", priorite: "Briques transverses EI", duree_mois: 30, date_debut: "2026-05-01", date_fin: "2028-11-01" },
    { code: "CH_026", nom: "Modernisation des chaînes Trade & Swift et rationalisation du patrimoine SI International", domaine: "CIB - Institutions financières étrangères", type_chantier: "Progiciel / Home Dev", priorite: "Dépendante de EI", duree_mois: 12, date_debut: "2028-01-01", date_fin: "2029-01-01" },
    { code: "CH_027", nom: "Modernisation de la Chaîne de Reporting Métier et Réglementaire", domaine: "Cockpit", type_chantier: "Progiciel + Sélection", priorite: "Dépendante de EI", duree_mois: 12, date_debut: "2026-05-01", date_fin: "2027-05-01" },
    { code: "CH_028", nom: "Une Plateforme Documentaire Unifiée et Intelligente", domaine: "Processus d'entreprise", type_chantier: "Progiciel / Home Dev", priorite: "Briques Satellite EI", duree_mois: 12, date_debut: "2026-05-01", date_fin: "2027-05-01" },
    { code: "CH_029", nom: "Une Solution Workflow et Orchestration des Processus Métier", domaine: "Processus d'entreprise", type_chantier: "Progiciel + Sélection", priorite: "Indépendante de EI", duree_mois: 12, date_debut: "2028-01-01", date_fin: "2029-01-01" },
    { code: "CH_030", nom: "Mise en place d'un Cadre d'Architecture d'Entreprise Transverse", domaine: "Processus d'entreprise", type_chantier: "Progiciel + Sélection", priorite: "Indépendante de EI", duree_mois: 63, date_debut: "2026-01-01", date_fin: "2030-12-31" },
    { code: "CH_031", nom: "Rationalisation et optimisation des outils de performance et supervision", domaine: "Capacités techniques", type_chantier: "Progiciel / Home Dev", priorite: "Indépendante de EI", duree_mois: 6, date_debut: "2029-01-01", date_fin: "2029-07-01" },
    { code: "CH_032", nom: "Mise en Place d'une Plateforme d'Intégration & API Management Centralisée", domaine: "Intégrations", type_chantier: "Progiciel + Sélection", priorite: "Fondations techniques", duree_mois: 9, date_debut: "2026-01-01", date_fin: "2026-10-01" },
    { code: "CH_033", nom: "Evolution des processus ETL et traitements batch", domaine: "Capacités techniques", type_chantier: "Intégration", priorite: "Indépendante de EI", duree_mois: 44, date_debut: "2026-05-01", date_fin: "2030-01-01" },
    { code: "CH_034", nom: "Modernisation et sécurisation des échanges de fichiers", domaine: "Capacités techniques", type_chantier: "Intégration", priorite: "Indépendante de EI", duree_mois: 12, date_debut: "2026-01-01", date_fin: "2027-01-01" },
    { code: "CH_035", nom: "Amélioration continue du pipeline DevSecOps et rationalisation des pratiques de la software factory", domaine: "Capacités techniques", type_chantier: "Progiciel + Sélection", priorite: "Indépendante de EI", duree_mois: 18, date_debut: "2026-01-01", date_fin: "2027-07-01" },
    { code: "CH_036", nom: "Des Services IT Performants et Orientés Client via une plateforme ITSM modernisée", domaine: "Capacités techniques", type_chantier: "Progiciel + Sélection", priorite: "Indépendante de EI", duree_mois: 18, date_debut: "2026-01-01", date_fin: "2027-07-01" },
    { code: "CH_037", nom: "Optimisation de la gestion de portefeuille projets", domaine: "Capacités techniques", type_chantier: "Progiciel + Sélection", priorite: "Indépendante de EI", duree_mois: 9, date_debut: "2026-03-01", date_fin: "2026-12-01" },
    { code: "CH_038", nom: "Cybersécurité : Un Enjeu Stratégique, une Réponse Renforcée", domaine: "Capacités techniques", type_chantier: "Progiciel + Sélection", priorite: "Fondations techniques", duree_mois: 63, date_debut: "2026-01-01", date_fin: "2030-12-31" },
    { code: "CH_039", nom: "Modernisation de la Fiscalité, de la Consolidation Financière et du Pilotage Budgétaire", domaine: "Finance, contrôle de gestion et comptabilité", type_chantier: "Progiciel + Sélection", priorite: "Indépendante de EI", duree_mois: 12, date_debut: "2029-01-01", date_fin: "2030-01-01" },
    { code: "CH_040", nom: "Modernisation et rationnalisation des outils de communication", domaine: "Capacités techniques", type_chantier: "Progiciel / Home Dev", priorite: "Indépendante de EI", duree_mois: 18, date_debut: "2026-01-01", date_fin: "2027-07-01" },
    { code: "CH_041", nom: "Infrastructure IT Résiliente & Scalable pour Accompagner la Transformation", domaine: "Capacités techniques", type_chantier: "Progiciel + Sélection", priorite: "Fondations techniques", duree_mois: 63, date_debut: "2026-01-01", date_fin: "2030-12-31" },
    { code: "CH_042", nom: "Centralisation et Rationalisation du Hub LLM - IA/ML & Big Data", domaine: "Cockpit", type_chantier: "Progiciel / Home Dev", priorite: "Indépendante de EI", duree_mois: 12, date_debut: "2029-01-01", date_fin: "2030-01-01" },
    { code: "CH_043", nom: "Refonte du canal eBanking BMCE Direct pour le retail", domaine: "Distribution & communication", type_chantier: "Progiciel + Sélection", priorite: "Briques transverses EI", duree_mois: 24, date_debut: "2026-07-01", date_fin: "2028-07-01" },
    { code: "CH_044", nom: "Mise en place d'une solution de Enterprise Content Management en remplacement de PIXIS", domaine: "Processus d'entreprise", type_chantier: "Progiciel / Home Dev", priorite: "Briques Satellite EI", duree_mois: 12, date_debut: "2029-01-01", date_fin: "2030-01-01" },
    { code: "CH_045", nom: "Pilotage de la transformation", domaine: "Pilotage & Gestion du changement", type_chantier: "Pilotage Transformation", priorite: "Pilotage Transformation", duree_mois: 63, date_debut: "2026-01-01", date_fin: "2030-12-31" },
    { code: "CH_046", nom: "Conduite du changement", domaine: "Pilotage & Gestion du changement", type_chantier: "Pilotage Transformation", priorite: "Pilotage Transformation", duree_mois: 63, date_debut: "2026-01-01", date_fin: "2030-12-31" },
  ];

  for (const c of chantiersData) {
    const dateDebut = new Date(c.date_debut);
    const dateFin = new Date(c.date_fin);
    const suivi = suiviMap[c.code];
    // Budget: estimate based on duration (random-ish but deterministic)
    const budgetBase = c.duree_mois * 500000 + (parseInt(c.code.replace("CH_", "")) * 100000);
    const rmdNames = chantierRmdMap[c.code] ?? [];
    await prisma.chantier.create({
      data: {
        code: c.code,
        nom: c.nom,
        description: "",
        domaine: c.domaine,
        type_chantier: c.type_chantier,
        priorite: c.priorite,
        duree_mois: c.duree_mois,
        budget: budgetBase,
        directeur: suivi?.responsable || "",
        pmo: "",
        date_debut: dateDebut,
        date_fin: dateFin,
        statut: deriveStatut(c.code, dateDebut, dateFin),
        rmds: rmdNames.length > 0
          ? { create: rmdNames.map((name) => ({ rmdId: createdRmds[name] })) }
          : undefined,
      },
    });
  }

  // Profils Ressource — grouped by type with default TJM
  const profilsData: { nom: string; type_ressource: string; tjm_defaut: number; ordre: number }[] = [
    // Interne
    { nom: "Chef de projet", type_ressource: "Interne", tjm_defaut: 6000, ordre: 1 },
    { nom: "Directeur de projet AMOA", type_ressource: "Interne", tjm_defaut: 8000, ordre: 2 },
    { nom: "Directeur de projet MOE", type_ressource: "Interne", tjm_defaut: 8000, ordre: 3 },
    { nom: "Analyste", type_ressource: "Interne", tjm_defaut: 4000, ordre: 4 },
    { nom: "Architecte d'entreprise", type_ressource: "Interne", tjm_defaut: 7000, ordre: 5 },
    { nom: "Architecte Data", type_ressource: "Interne", tjm_defaut: 7000, ordre: 6 },
    { nom: "Ingénieur développement", type_ressource: "Interne", tjm_defaut: 5000, ordre: 7 },
    { nom: "Ingénieur cyber sécurité", type_ressource: "Interne", tjm_defaut: 6000, ordre: 8 },
    { nom: "Testeur", type_ressource: "Interne", tjm_defaut: 3500, ordre: 9 },
    // Externe
    { nom: "Chef de projet", type_ressource: "Externe", tjm_defaut: 9000, ordre: 1 },
    { nom: "Directeur de projet AMOA", type_ressource: "Externe", tjm_defaut: 12000, ordre: 2 },
    { nom: "Directeur de projet MOE", type_ressource: "Externe", tjm_defaut: 12000, ordre: 3 },
    { nom: "Analyste", type_ressource: "Externe", tjm_defaut: 7000, ordre: 4 },
    { nom: "Architecte d'entreprise", type_ressource: "Externe", tjm_defaut: 11000, ordre: 5 },
    { nom: "Architecte Data", type_ressource: "Externe", tjm_defaut: 11000, ordre: 6 },
    { nom: "Ingénieur développement", type_ressource: "Externe", tjm_defaut: 8000, ordre: 7 },
    { nom: "Ingénieur cyber sécurité", type_ressource: "Externe", tjm_defaut: 9000, ordre: 8 },
    { nom: "Testeur", type_ressource: "Externe", tjm_defaut: 6000, ordre: 9 },
    // Consultant
    { nom: "Chef de projet", type_ressource: "Consultant", tjm_defaut: 13000, ordre: 1 },
    { nom: "Directeur de projet AMOA", type_ressource: "Consultant", tjm_defaut: 18000, ordre: 2 },
    { nom: "Directeur de projet MOE", type_ressource: "Consultant", tjm_defaut: 17000, ordre: 3 },
    { nom: "Analyste", type_ressource: "Consultant", tjm_defaut: 11000, ordre: 4 },
    { nom: "Architecte d'entreprise", type_ressource: "Consultant", tjm_defaut: 16000, ordre: 5 },
    { nom: "Architecte Data", type_ressource: "Consultant", tjm_defaut: 16000, ordre: 6 },
    { nom: "Ingénieur développement", type_ressource: "Consultant", tjm_defaut: 12000, ordre: 7 },
    { nom: "Ingénieur cyber sécurité", type_ressource: "Consultant", tjm_defaut: 14000, ordre: 8 },
    { nom: "Testeur", type_ressource: "Consultant", tjm_defaut: 10000, ordre: 9 },
  ];

  const createdProfils: Record<string, string> = {};
  for (const p of profilsData) {
    const profil = await prisma.profilRessource.create({ data: p });
    createdProfils[`${p.type_ressource}:${p.nom}`] = profil.id;
  }

  // Sample resources (consultants and internal)
  const ressourcesData = [
    { nom_complet: "Fatima Zahra El Idrissi", type: "Consultant", organisation: "McKinsey", tarif_journalier: 15000, capacite_jours_mois: 20, email: "fz.elidrissi@mckinsey.com", profil: "Directeur de projet AMOA" },
    { nom_complet: "Khalid Bennani", type: "Consultant", organisation: "BCG", tarif_journalier: 14000, capacite_jours_mois: 20, email: "k.bennani@bcg.com", profil: "Directeur de projet MOE" },
    { nom_complet: "Ahmed Chraibi", type: "Consultant", organisation: "McKinsey", tarif_journalier: 15000, capacite_jours_mois: 20, email: "a.chraibi@mckinsey.com", profil: "Directeur de projet AMOA" },
    { nom_complet: "Rachid Amrani", type: "Consultant", organisation: "Accenture", tarif_journalier: 12000, capacite_jours_mois: 20, email: "r.amrani@accenture.com", profil: "Chef de projet" },
    { nom_complet: "Zineb Hajji", type: "Interne", organisation: "BMCE", tarif_journalier: 5000, capacite_jours_mois: 20, email: "z.hajji@bmce.ma", profil: "Chef de projet" },
    { nom_complet: "Othmane Cherkaoui", type: "Interne", organisation: "BMCE", tarif_journalier: 6000, capacite_jours_mois: 20, email: "o.cherkaoui@bmce.ma", profil: "Ingénieur cyber sécurité" },
    { nom_complet: "Meryem Belkadi", type: "Consultant", organisation: "Capgemini", tarif_journalier: 11000, capacite_jours_mois: 20, email: "m.belkadi@capgemini.com", profil: "Analyste" },
    { nom_complet: "Sara Tazi", type: "Interne", organisation: "BMCE", tarif_journalier: 4500, capacite_jours_mois: 20, email: "s.tazi@bmce.ma", profil: "Analyste" },
    { nom_complet: "Yassine Boukhris", type: "Consultant", organisation: "Deloitte", tarif_journalier: 13000, capacite_jours_mois: 20, email: "y.boukhris@deloitte.com", profil: "Chef de projet" },
    { nom_complet: "Salma Benjelloun", type: "Externe", organisation: "CGI", tarif_journalier: 9000, capacite_jours_mois: 20, email: "s.benjelloun@cgi.com", profil: "Chef de projet" },
  ];

  const defaultEquipeId =
    equipeByName["Bureau Programme"] ??
    Object.values(equipeByName)[0] ??
    null;

  const createdRessources: Record<string, string> = {};
  for (const res of ressourcesData) {
    const profilId = createdProfils[`${res.type}:${res.profil}`] ?? null;
    const { profil, ...restData } = res;
    // Hierarchical team: interne BMCE → Bureau Programme; others tech/programme defaults
    const equipeHierarchieId =
      res.organisation === "BMCE"
        ? equipeByName["Bureau Programme"] ?? defaultEquipeId
        : equipeByName["Direction Technologie"] ?? defaultEquipeId;
    const created = await prisma.ressource.create({
      data: {
        ...restData,
        actif: true,
        telephone: "",
        email: res.email,
        profilId,
        equipeHierarchieId,
      },
    });
    createdRessources[res.nom_complet] = created.id;
  }

  // Sample team members for "en cours" chantiers
  const equipeMembres: { code: string; equipe: string; role: string; nom: string; charge: number }[] = [
    // CH_014 — Référentiels (Fondations techniques, 24 mois)
    { code: "CH_014", equipe: "AMOA", role: "Directeur AMOA", nom: "Fatima Zahra El Idrissi", charge: 80 },
    { code: "CH_014", equipe: "AMOA", role: "Chef de projet AMOA", nom: "Yassine Boukhris", charge: 100 },
    { code: "CH_014", equipe: "MOE", role: "Directeur MOE", nom: "Khalid Bennani", charge: 60 },
    { code: "CH_014", equipe: "MOE", role: "Chef de projet MOE", nom: "Sara Tazi", charge: 100 },
    { code: "CH_014", equipe: "Sécurité", role: "Représentant RSSI", nom: "Omar Fassi Fihri", charge: 20 },
    { code: "CH_014", equipe: "EI", role: "Chef de projet EI", nom: "Mounia Alaoui", charge: 50 },
    // CH_016 — CRM (12 mois)
    { code: "CH_016", equipe: "AMOA", role: "Directeur AMOA", nom: "Ahmed Chraibi", charge: 60 },
    { code: "CH_016", equipe: "AMOA", role: "Chef de projet AMOA", nom: "Nadia Berrada", charge: 100 },
    { code: "CH_016", equipe: "MOE", role: "Chef de projet MOE", nom: "Mehdi Lahlou", charge: 100 },
    { code: "CH_016", equipe: "EI", role: "Chef de projet EI", nom: "Imane Sekkat", charge: 50 },
    // CH_023 — Core Banking (24 mois)
    { code: "CH_023", equipe: "AMOA", role: "Directeur AMOA", nom: "Rachid Amrani", charge: 80 },
    { code: "CH_023", equipe: "AMOA", role: "Directeur DDG", nom: "Soukaina Mouline", charge: 50 },
    { code: "CH_023", equipe: "AMOA", role: "Chef de projet AMOA", nom: "Hamza El Ouazzani", charge: 100 },
    { code: "CH_023", equipe: "MOE", role: "Directeur MOE", nom: "Salma Benjelloun", charge: 80 },
    { code: "CH_023", equipe: "MOE", role: "Chef de projet MOE", nom: "Amine Kettani", charge: 100 },
    { code: "CH_023", equipe: "Sécurité", role: "Lead Architecte", nom: "Karim Zniber", charge: 30 },
    { code: "CH_023", equipe: "Sécurité", role: "Représentant RSSI", nom: "Leila Bouazza", charge: 20 },
    { code: "CH_023", equipe: "EI", role: "Chef de projet EI", nom: "Tarik Benhima", charge: 50 },
    // CH_032 — Plateforme Intégration (9 mois)
    { code: "CH_032", equipe: "AMOA", role: "Directeur AMOA", nom: "Zineb Hajji", charge: 50 },
    { code: "CH_032", equipe: "AMOA", role: "Chef de projet AMOA", nom: "Younes Filali", charge: 100 },
    { code: "CH_032", equipe: "MOE", role: "Directeur MOE", nom: "Hajar Squalli", charge: 100 },
    { code: "CH_032", equipe: "Sécurité", role: "Lead Architecte", nom: "Said El Mansouri", charge: 30 },
    // CH_038 — Cybersécurité (63 mois)
    { code: "CH_038", equipe: "AMOA", role: "Chef de projet AMOA", nom: "Wafaa Bennis", charge: 100 },
    { code: "CH_038", equipe: "MOE", role: "Directeur MOE", nom: "Othmane Cherkaoui", charge: 40 },
    { code: "CH_038", equipe: "Sécurité", role: "Lead Architecte", nom: "Adil Berrechid", charge: 50 },
    { code: "CH_038", equipe: "Sécurité", role: "Représentant RSSI", nom: "Hind Sefrioui", charge: 30 },
    // CH_043 — eBanking BMCE Direct (24 mois)
    { code: "CH_043", equipe: "AMOA", role: "Directeur AMOA", nom: "Meryem Belkadi", charge: 70 },
    { code: "CH_043", equipe: "AMOA", role: "Chef de projet AMOA", nom: "Badr Ouadghiri", charge: 100 },
    { code: "CH_043", equipe: "MOE", role: "Chef de projet MOE", nom: "Sanaa Diouri", charge: 100 },
    { code: "CH_043", equipe: "EI", role: "Chef de projet EI", nom: "Anas Tahiri", charge: 50 },
  ];

  // Get all chantiers to map codes to IDs
  const allChantiers = await prisma.chantier.findMany({ select: { id: true, code: true } });
  const codeToId: Record<string, string> = {};
  for (const ch of allChantiers) codeToId[ch.code] = ch.id;

  // ── Import budget data from Excel ──────────────────
  const xlsPath = path.resolve(__dirname, "..", "Data", "Budgets Chantiers TSI.xlsx");
  const wb = XLSX.readFile(xlsPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const budgetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  for (const row of budgetRows) {
    const code = String(row["ID Chantier"] ?? "").trim();
    const chantierId = codeToId[code];
    if (!chantierId) continue;

    const budgetJH = Number(row["#1. Projet JH sans contingence"] ?? 0);
    const budgetProjetMAD = Number(row["#1. Projet MAD sans contingence"] ?? 0);
    const conseilEditeursMAD = Number(row["#2. Conseil editeurs MAD sans contingence"] ?? 0);
    const licencesAchatsMAD = Number(row["#3. Licence achat et maintenance MAD sans contingence"] ?? 0);
    const licencesAbonnementsMAD = Number(row["#4. Licences abonnements MAD sans contingence"] ?? 0);
    const coutsInfrasMAD = Number(row["#5. Coût infra MAD sans contingence"] ?? 0);
    const budgetTotalMAD = Number(row[" TOTAL sans contingence "] ?? 0);
    const description = String(row["Description du chantier"] ?? "").replace(/\r\n/g, "\n");

    await prisma.chantier.update({
      where: { id: chantierId },
      data: {
        description,
        budget: budgetTotalMAD,
        budgetJH,
        budgetProjetMAD,
        conseilEditeursMAD,
        licencesAchatsMAD,
        licencesAbonnementsMAD,
        coutsInfrasMAD,
        budgetTotalMAD,
      },
    });
  }
  console.log(`Budget data imported for ${budgetRows.length} chantiers from Excel.`);

  const createdMembres: { id: string; nom: string; chantierId: string; ressourceId: string | null }[] = [];
  for (const m of equipeMembres) {
    const chantierId = codeToId[m.code];
    if (chantierId) {
      const ressourceId = createdRessources[m.nom] ?? null;
      const membre = await prisma.membreEquipe.create({
        data: {
          chantierId,
          equipe: m.equipe,
          role: m.role,
          nom_complet: m.nom,
          charge_pourcentage: m.charge,
          ressourceId,
        },
      });
      createdMembres.push({ id: membre.id, nom: m.nom, chantierId, ressourceId });
    }
  }

  // Sample weekly time entries (SaisieTemps) for linked resources — Jan to Mar 2026
  const membresWithRessource = createdMembres.filter((m) => m.ressourceId);
  for (const m of membresWithRessource) {
    // Generate 10 weeks of data (Jan 5 to Mar 9, 2026 — all Mondays)
    const mondays = [
      "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26",
      "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23",
      "2026-03-02", "2026-03-09",
    ];
    for (const monday of mondays) {
      // Vary actual days: some weeks more, some less (deterministic from name hash)
      const hash = m.nom.length + monday.charCodeAt(8);
      const base = (hash % 5) + 1; // 1-5
      const jours = Math.min(5, Math.max(0.5, base * 0.9));
      await prisma.saisieTemps.create({
        data: {
          ressourceId: m.ressourceId!,
          chantierId: m.chantierId,
          date_lundi: new Date(monday),
          jours_travailles: Math.round(jours * 2) / 2, // round to 0.5
        },
      });
    }
  }

  // Jalons (milestones) for active chantiers
  const jalonTemplates = [
    { phase: "Précadrage", nom: "Lancement pré-cadrage",           ordre: 1, offsetPct: 0 },
    { phase: "Précadrage", nom: "Analyse de l'existant",           ordre: 2, offsetPct: 3 },
    { phase: "Précadrage", nom: "Expression des besoins",          ordre: 3, offsetPct: 5 },
    { phase: "Précadrage", nom: "Go/No-Go cadrage",                ordre: 4, offsetPct: 10 },
    { phase: "Cadrage",    nom: "Validation périmètre",            ordre: 1, offsetPct: 12 },
    { phase: "Cadrage",    nom: "Étude de faisabilité",            ordre: 2, offsetPct: 15 },
    { phase: "Cadrage",    nom: "Cahier des charges validé",       ordre: 3, offsetPct: 18 },
    { phase: "Cadrage",    nom: "Sélection éditeur/solution",      ordre: 4, offsetPct: 20 },
    { phase: "Cadrage",    nom: "Go/No-Go exécution",              ordre: 5, offsetPct: 25 },
    { phase: "Exécution",  nom: "Kick-off projet",                 ordre: 1, offsetPct: 26 },
    { phase: "Exécution",  nom: "Spécifications fonctionnelles",   ordre: 2, offsetPct: 35 },
    { phase: "Exécution",  nom: "Développement / Paramétrage",     ordre: 3, offsetPct: 50 },
    { phase: "Exécution",  nom: "Tests unitaires",                 ordre: 4, offsetPct: 60 },
    { phase: "Exécution",  nom: "Tests d'intégration",             ordre: 5, offsetPct: 65 },
    { phase: "Exécution",  nom: "UAT (Recette utilisateur)",       ordre: 6, offsetPct: 72 },
    { phase: "Exécution",  nom: "Formation utilisateurs",          ordre: 7, offsetPct: 78 },
    { phase: "Exécution",  nom: "Go-Live / Mise en production",    ordre: 8, offsetPct: 85 },
    { phase: "Clôture",    nom: "Hypercare / Stabilisation",       ordre: 1, offsetPct: 88 },
    { phase: "Clôture",    nom: "Transfert de compétences",        ordre: 2, offsetPct: 92 },
    { phase: "Clôture",    nom: "Bilan projet",                    ordre: 3, offsetPct: 96 },
    { phase: "Clôture",    nom: "Clôture formelle",                ordre: 4, offsetPct: 100 },
  ];

  const activeChantierCodes = ["CH_014", "CH_016", "CH_023", "CH_032", "CH_038", "CH_043"];
  let totalJalons = 0;
  for (const code of activeChantierCodes) {
    const chId = codeToId[code];
    if (!chId) continue;
    const ch = await prisma.chantier.findUnique({ where: { id: chId }, select: { date_debut: true, date_fin: true, statut: true } });
    if (!ch) continue;

    const duration = ch.date_fin.getTime() - ch.date_debut.getTime();
    const now = new Date();

    for (const t of jalonTemplates) {
      const dateCible = new Date(ch.date_debut.getTime() + (duration * t.offsetPct) / 100);
      // Determine realistic status based on chantier statut and milestone date
      let statut = "Planifié";
      let dateReelle: Date | null = null;

      if (dateCible < now) {
        if (ch.statut === "Exécution" || ch.statut === "Clôturé") {
          // Past milestones for active chantiers — most are atteint
          if (t.phase === "Précadrage" || t.phase === "Cadrage") {
            statut = "Atteint";
            // date_reelle slightly before or after date_cible for realism
            const drift = (code.charCodeAt(3) + t.ordre) % 7 - 3; // -3 to +3 days
            dateReelle = new Date(dateCible.getTime() + drift * 86400000);
          } else if (t.offsetPct <= 50) {
            statut = "Atteint";
            dateReelle = new Date(dateCible.getTime() + ((t.ordre % 3) * 86400000));
          } else {
            // Some recent milestones are "En cours" or "Reporté"
            statut = t.ordre % 4 === 0 ? "Reporté" : "En cours";
          }
        } else if (ch.statut === "Cadrage") {
          if (t.phase === "Précadrage") {
            statut = "Atteint";
            dateReelle = new Date(dateCible.getTime() + 86400000);
          } else if (t.phase === "Cadrage" && t.offsetPct <= 18) {
            statut = "En cours";
          }
        }
      }

      await prisma.jalon.create({
        data: {
          chantierId: chId,
          phase: t.phase,
          nom: t.nom,
          ordre: t.ordre,
          date_cible: dateCible,
          date_reelle: dateReelle,
          statut,
        },
      });
      totalJalons++;
    }
  }

  // ── RAID entries ──────────────────────────────────────────────────────
  const raidEntries: {
    type: string;
    intitule: string;
    description: string;
    categorie: string;
    chantierCode: string;
    domaine: string;
    probabilite?: number;
    impact?: number;
    strategie?: string;
    mitigation?: string;
    responsable: string;
    statut: string;
    date_identification: string;
    date_echeance?: string;
    date_revision?: string;
    commentaires?: string;
  }[] = [
    // ── ACTIONS ──────────────────────────────────────
    // CH_014 — Référentiels
    { type: "Action", intitule: "Définir le modèle de données client unifié", description: "Établir le MCD du référentiel client cible incluant personnes physiques et morales", categorie: "Technique", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Fatima Zahra El Idrissi", statut: "Clôturé", date_identification: "2026-01-15", date_echeance: "2026-02-28" },
    { type: "Action", intitule: "Cartographier les flux d'alimentation existants", description: "Identifier tous les systèmes sources alimentant les référentiels actuels", categorie: "Analyse", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Yassine Boukhris", statut: "Clôturé", date_identification: "2026-01-20", date_echeance: "2026-03-15" },
    { type: "Action", intitule: "Mettre en place l'environnement de dev référentiels", description: "Provisionner les serveurs et configurer CI/CD pour le module référentiels", categorie: "Technique", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Khalid Bennani", statut: "En cours", date_identification: "2026-02-01", date_echeance: "2026-03-30" },
    { type: "Action", intitule: "Valider les règles de déduplication client", description: "Définir et valider avec le métier les règles de matching/merge pour la déduplication", categorie: "Métier", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Sara Tazi", statut: "En cours", date_identification: "2026-02-10", date_echeance: "2026-04-15" },
    { type: "Action", intitule: "Migrer les données produits depuis le legacy", description: "ETL de migration du référentiel produit de l'ancien système vers la nouvelle plateforme", categorie: "Data", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Yassine Boukhris", statut: "Planifié", date_identification: "2026-03-01", date_echeance: "2026-06-30" },
    { type: "Action", intitule: "Former les équipes métier au nouveau référentiel", description: "Sessions de formation pour les utilisateurs clés des agences et du siège", categorie: "Conduite du changement", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Fatima Zahra El Idrissi", statut: "A planifier", date_identification: "2026-03-05", date_echeance: "2026-08-30" },

    // CH_016 — CRM
    { type: "Action", intitule: "Finaliser le cahier des charges CRM", description: "Rédiger les spécifications fonctionnelles détaillées du CRM cible", categorie: "Métier", chantierCode: "CH_016", domaine: "Distribution & communication", responsable: "Ahmed Chraibi", statut: "Clôturé", date_identification: "2026-01-10", date_echeance: "2026-02-15" },
    { type: "Action", intitule: "Sélectionner l'éditeur CRM", description: "Évaluer les réponses aux RFP et shortlister les 3 éditeurs finalistes", categorie: "Achats", chantierCode: "CH_016", domaine: "Distribution & communication", responsable: "Ahmed Chraibi", statut: "Clôturé", date_identification: "2026-01-15", date_echeance: "2026-03-01" },
    { type: "Action", intitule: "Configurer le module gestion des leads", description: "Paramétrer le workflow de qualification et distribution des leads commerciaux", categorie: "Technique", chantierCode: "CH_016", domaine: "Distribution & communication", responsable: "Meryem Belkadi", statut: "En cours", date_identification: "2026-02-20", date_echeance: "2026-04-10" },
    { type: "Action", intitule: "Intégrer le CRM avec le référentiel client", description: "Développer les connecteurs API entre CRM et référentiel client CH_014", categorie: "Technique", chantierCode: "CH_016", domaine: "Distribution & communication", responsable: "Khalid Bennani", statut: "A lancer", date_identification: "2026-03-01", date_echeance: "2026-05-15" },
    { type: "Action", intitule: "Tester le parcours de souscription en ligne", description: "Recette fonctionnelle du parcours client digital de souscription", categorie: "Qualité", chantierCode: "CH_016", domaine: "Distribution & communication", responsable: "Sara Tazi", statut: "A planifier", date_identification: "2026-03-10", date_echeance: "2026-07-30" },

    // CH_023 — Core Banking
    { type: "Action", intitule: "Définir l'architecture CBS cible", description: "Documenter l'architecture technique du Core Banking System incluant les couches applicatives", categorie: "Architecture", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Rachid Amrani", statut: "Clôturé", date_identification: "2026-01-05", date_echeance: "2026-02-20" },
    { type: "Action", intitule: "Préparer l'environnement de POC CBS", description: "Installer et configurer l'environnement de proof-of-concept pour le CBS retenu", categorie: "Technique", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Salma Benjelloun", statut: "Clôturé", date_identification: "2026-01-20", date_echeance: "2026-03-10" },
    { type: "Action", intitule: "Mapper les produits bancaires existants", description: "Cartographier les 200+ produits existants et les mapper au modèle CBS cible", categorie: "Métier", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Rachid Amrani", statut: "En cours", date_identification: "2026-02-15", date_echeance: "2026-04-30" },
    { type: "Action", intitule: "Développer les connecteurs monétique", description: "Intégration entre le CBS et les systèmes de paiement par carte", categorie: "Technique", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Salma Benjelloun", statut: "Planifié", date_identification: "2026-03-01", date_echeance: "2026-07-15" },
    { type: "Action", intitule: "Planifier la stratégie de migration des comptes", description: "Définir le plan de migration par vagues des comptes clients vers le nouveau CBS", categorie: "Stratégie", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Rachid Amrani", statut: "Stand-By", date_identification: "2026-02-25", date_echeance: "2026-05-30" },

    // CH_032 — Plateforme Intégration
    { type: "Action", intitule: "Installer la plateforme API Management", description: "Déployer et configurer la solution API gateway en environnement de production", categorie: "Technique", chantierCode: "CH_032", domaine: "Intégrations", responsable: "Zineb Hajji", statut: "En cours", date_identification: "2026-01-10", date_echeance: "2026-03-20" },
    { type: "Action", intitule: "Définir les standards API de la banque", description: "Rédiger le guide de normes REST/OpenAPI pour toutes les équipes de développement", categorie: "Architecture", chantierCode: "CH_032", domaine: "Intégrations", responsable: "Zineb Hajji", statut: "Clôturé", date_identification: "2026-01-05", date_echeance: "2026-02-10" },
    { type: "Action", intitule: "Migrer les 20 premières APIs legacy", description: "Refactorer et migrer les 20 APIs les plus critiques vers la nouvelle plateforme", categorie: "Technique", chantierCode: "CH_032", domaine: "Intégrations", responsable: "Othmane Cherkaoui", statut: "En cours", date_identification: "2026-02-15", date_echeance: "2026-04-30" },
    { type: "Action", intitule: "Mettre en place le monitoring API", description: "Configurer les dashboards de supervision et alerting pour les APIs", categorie: "Opérations", chantierCode: "CH_032", domaine: "Intégrations", responsable: "Othmane Cherkaoui", statut: "A planifier", date_identification: "2026-03-01", date_echeance: "2026-05-15" },

    // CH_038 — Cybersécurité
    { type: "Action", intitule: "Auditer la posture sécurité actuelle", description: "Réaliser un audit complet de la posture cybersécurité incluant tests de pénétration", categorie: "Sécurité", chantierCode: "CH_038", domaine: "Capacités techniques", responsable: "Othmane Cherkaoui", statut: "Clôturé", date_identification: "2026-01-05", date_echeance: "2026-02-28" },
    { type: "Action", intitule: "Déployer le SIEM centralisé", description: "Installer et configurer la solution SIEM pour la corrélation des événements sécurité", categorie: "Technique", chantierCode: "CH_038", domaine: "Capacités techniques", responsable: "Othmane Cherkaoui", statut: "En cours", date_identification: "2026-02-01", date_echeance: "2026-04-15" },
    { type: "Action", intitule: "Former les équipes au phishing", description: "Campagne de sensibilisation et formation anti-phishing pour tous les collaborateurs", categorie: "Conduite du changement", chantierCode: "CH_038", domaine: "Capacités techniques", responsable: "Zineb Hajji", statut: "Planifié", date_identification: "2026-03-01", date_echeance: "2026-06-30" },
    { type: "Action", intitule: "Implémenter le MFA sur les applications critiques", description: "Déployer l'authentification multi-facteurs sur les 15 applications les plus sensibles", categorie: "Sécurité", chantierCode: "CH_038", domaine: "Capacités techniques", responsable: "Othmane Cherkaoui", statut: "A lancer", date_identification: "2026-02-20", date_echeance: "2026-05-30" },

    // CH_043 — eBanking
    { type: "Action", intitule: "Benchmark des solutions eBanking", description: "Étude comparative des 5 principales solutions eBanking retail du marché", categorie: "Achats", chantierCode: "CH_043", domaine: "Distribution & communication", responsable: "Meryem Belkadi", statut: "Clôturé", date_identification: "2026-07-10", date_echeance: "2026-08-30" },
    { type: "Action", intitule: "Prototyper le nouveau parcours client mobile", description: "Créer un prototype haute fidélité du parcours mobile de consultation et virements", categorie: "UX", chantierCode: "CH_043", domaine: "Distribution & communication", responsable: "Meryem Belkadi", statut: "En cours", date_identification: "2026-08-15", date_echeance: "2026-10-30" },
    { type: "Action", intitule: "Sécuriser le canal eBanking (3D Secure v2)", description: "Implémenter 3D Secure v2 et le protocole d'authentification forte SCA", categorie: "Sécurité", chantierCode: "CH_043", domaine: "Distribution & communication", responsable: "Othmane Cherkaoui", statut: "A planifier", date_identification: "2026-09-01", date_echeance: "2027-01-15" },

    // Additional overdue actions for dashboard realism
    { type: "Action", intitule: "Livrer le rapport d'impact RGPD", description: "Finaliser l'analyse d'impact sur la protection des données pour le nouveau référentiel", categorie: "Conformité", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Sara Tazi", statut: "En cours", date_identification: "2026-01-25", date_echeance: "2026-02-28", commentaires: "Retard dû à la complexité de l'analyse des flux de données personnelles" },
    { type: "Action", intitule: "Obtenir la validation BAM pour le CBS", description: "Soumettre le dossier réglementaire à Bank Al-Maghrib pour validation du nouveau CBS", categorie: "Réglementaire", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Rachid Amrani", statut: "En cours", date_identification: "2026-02-01", date_echeance: "2026-03-01", commentaires: "En attente de retour de BAM" },
    { type: "Action", intitule: "Finaliser le contrat éditeur API gateway", description: "Négocier et signer le contrat de licence avec l'éditeur sélectionné", categorie: "Achats", chantierCode: "CH_032", domaine: "Intégrations", responsable: "Zineb Hajji", statut: "Stand-By", date_identification: "2026-01-15", date_echeance: "2026-02-15", commentaires: "Négociation tarifaire en cours avec les achats groupe" },

    // ── RISQUES ──────────────────────────────────────
    // Variété de probabilité × impact pour la matrice 5×5
    { type: "Risque", intitule: "Retard fournisseur CBS", description: "L'éditeur CBS pourrait ne pas respecter les délais de livraison des modules de base", categorie: "Fournisseur", chantierCode: "CH_023", domaine: "Banque du quotidien", probabilite: 4, impact: 5, strategie: "Atténuer", mitigation: "Clauses pénales au contrat + plan B avec solution alternative", responsable: "Rachid Amrani", statut: "Ouvert", date_identification: "2026-01-15", date_revision: "2026-03-15" },
    { type: "Risque", intitule: "Résistance au changement des agences", description: "Les équipes en agence pourraient résister à l'adoption du nouveau CRM", categorie: "Organisationnel", chantierCode: "CH_016", domaine: "Distribution & communication", probabilite: 3, impact: 4, strategie: "Atténuer", mitigation: "Plan de conduite du changement renforcé avec ambassadeurs terrain", responsable: "Ahmed Chraibi", statut: "En mitigation", date_identification: "2026-01-20", date_revision: "2026-03-10" },
    { type: "Risque", intitule: "Fuite de données lors de la migration", description: "Risque de perte ou corruption de données pendant la migration des référentiels", categorie: "Sécurité", chantierCode: "CH_014", domaine: "Référentiels", probabilite: 2, impact: 5, strategie: "Éviter", mitigation: "Double run en parallèle pendant 3 mois + contrôles de cohérence automatisés", responsable: "Khalid Bennani", statut: "Surveillé", date_identification: "2026-02-01", date_revision: "2026-03-01" },
    { type: "Risque", intitule: "Indisponibilité de la plateforme d'intégration", description: "Risque d'indisponibilité de la plateforme API en production impactant les services bancaires", categorie: "Technique", chantierCode: "CH_032", domaine: "Intégrations", probabilite: 3, impact: 5, strategie: "Atténuer", mitigation: "Architecture HA active-active + failover automatique < 30s", responsable: "Zineb Hajji", statut: "Ouvert", date_identification: "2026-02-10", date_revision: "2026-04-10" },
    { type: "Risque", intitule: "Cyberattaque pendant la transformation", description: "La période de transformation augmente la surface d'attaque de la banque", categorie: "Sécurité", chantierCode: "CH_038", domaine: "Capacités techniques", probabilite: 3, impact: 5, strategie: "Atténuer", mitigation: "SOC renforcé 24/7 + exercices red team trimestriels", responsable: "Othmane Cherkaoui", statut: "En mitigation", date_identification: "2026-01-05", date_revision: "2026-03-05" },
    { type: "Risque", intitule: "Dépassement budgétaire CBS", description: "Le budget du Core Banking pourrait dépasser l'enveloppe initiale de 30%", categorie: "Financier", chantierCode: "CH_023", domaine: "Banque du quotidien", probabilite: 4, impact: 4, strategie: "Atténuer", mitigation: "Revue budgétaire mensuelle + réserve de contingence de 15%", responsable: "Rachid Amrani", statut: "Surveillé", date_identification: "2026-02-15", date_revision: "2026-03-15" },
    { type: "Risque", intitule: "Incompatibilité des données legacy", description: "Les données legacy pourraient ne pas être compatibles avec le nouveau modèle de données", categorie: "Data", chantierCode: "CH_014", domaine: "Référentiels", probabilite: 3, impact: 3, strategie: "Atténuer", mitigation: "Phase de data cleansing préalable + règles de transformation ETL", responsable: "Yassine Boukhris", statut: "Ouvert", date_identification: "2026-02-20", date_revision: "2026-04-20" },
    { type: "Risque", intitule: "Pénurie de compétences CBS Temenos", description: "Difficulté à recruter des profils expérimentés sur la technologie CBS retenue", categorie: "Ressources", chantierCode: "CH_023", domaine: "Banque du quotidien", probabilite: 4, impact: 3, strategie: "Atténuer", mitigation: "Partenariat avec intégrateur certifié + programme de montée en compétence interne", responsable: "Salma Benjelloun", statut: "Ouvert", date_identification: "2026-01-25", date_revision: "2026-03-25" },
    { type: "Risque", intitule: "Conformité réglementaire du canal eBanking", description: "Les exigences réglementaires BAM sur les canaux digitaux pourraient évoluer", categorie: "Réglementaire", chantierCode: "CH_043", domaine: "Distribution & communication", probabilite: 2, impact: 4, strategie: "Surveiller", mitigation: "Veille réglementaire continue + architecture modulaire pour adaptation rapide", responsable: "Meryem Belkadi", statut: "Surveillé", date_identification: "2026-08-01", date_revision: "2026-10-01" },
    { type: "Risque", intitule: "Performance dégradée en pic de charge", description: "La plateforme d'intégration pourrait ne pas supporter les pics de charge en fin de mois", categorie: "Technique", chantierCode: "CH_032", domaine: "Intégrations", probabilite: 3, impact: 4, strategie: "Atténuer", mitigation: "Tests de charge réguliers + auto-scaling cloud", responsable: "Othmane Cherkaoui", statut: "Planifié", date_identification: "2026-03-01", date_revision: "2026-05-01" },
    { type: "Risque", intitule: "Dépendance inter-chantiers non maîtrisée", description: "Les interdépendances entre CH_014, CH_016 et CH_023 pourraient créer des blocages", categorie: "Programme", chantierCode: "CH_014", domaine: "Référentiels", probabilite: 4, impact: 4, strategie: "Atténuer", mitigation: "Comité d'arbitrage inter-chantiers hebdomadaire + matrice RACI partagée", responsable: "Fatima Zahra El Idrissi", statut: "En mitigation", date_identification: "2026-01-10", date_revision: "2026-03-10" },
    { type: "Risque", intitule: "Obsolescence technologique rapide", description: "Les choix technologiques actuels pourraient devenir obsolètes avant la fin du programme", categorie: "Technique", chantierCode: "CH_038", domaine: "Capacités techniques", probabilite: 2, impact: 3, strategie: "Accepter", mitigation: "Architecture modulaire et découplée + veille technologique", responsable: "Othmane Cherkaoui", statut: "Surveillé", date_identification: "2026-02-05", date_revision: "2026-05-05" },
    // Closed risks for burndown
    { type: "Risque", intitule: "Retard livraison serveurs", description: "Retard potentiel sur la livraison des serveurs de production", categorie: "Fournisseur", chantierCode: "CH_032", domaine: "Intégrations", probabilite: 3, impact: 3, strategie: "Atténuer", mitigation: "Commande anticipée validée", responsable: "Zineb Hajji", statut: "Clos", date_identification: "2026-01-10", date_revision: "2026-02-20" },
    { type: "Risque", intitule: "Conflit de versions middleware", description: "Incompatibilité entre les versions de middleware utilisées par différentes équipes", categorie: "Technique", chantierCode: "CH_032", domaine: "Intégrations", probabilite: 2, impact: 2, strategie: "Éviter", mitigation: "Standardisation des versions via conteneurisation", responsable: "Othmane Cherkaoui", statut: "Clos", date_identification: "2026-01-15", date_revision: "2026-02-15" },
    { type: "Risque", intitule: "Indisponibilité du sponsor métier", description: "Le directeur commercial sponsor du CRM pourrait être indisponible pour les validations", categorie: "Organisationnel", chantierCode: "CH_016", domaine: "Distribution & communication", probabilite: 2, impact: 3, strategie: "Atténuer", mitigation: "Délégation de pouvoir formalisée au N-1", responsable: "Ahmed Chraibi", statut: "Clos", date_identification: "2026-01-20", date_revision: "2026-02-28" },
    // Materialized risk
    { type: "Risque", intitule: "Départ de l'architecte principal CBS", description: "L'architecte principal du projet CBS a démissionné", categorie: "Ressources", chantierCode: "CH_023", domaine: "Banque du quotidien", probabilite: 5, impact: 4, strategie: "Atténuer", mitigation: "Recrutement express via cabinet spécialisé + transfert de connaissances en urgence", responsable: "Rachid Amrani", statut: "Matérialisé", date_identification: "2026-03-01", date_revision: "2026-03-10", commentaires: "Impact sur le planning de 3 semaines. Remplacement en cours." },

    // ── DÉCISIONS ──────────────────────────────────────
    { type: "Décision", intitule: "Choix de Temenos T24 comme CBS", description: "Sélection de Temenos T24 comme Core Banking System suite à l'évaluation RFP", categorie: "Architecture", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Rachid Amrani", statut: "Validée", date_identification: "2026-02-15", commentaires: "Décision validée en comité de programme du 15/02" },
    { type: "Décision", intitule: "Approche Big Bang vs Progressive pour migration", description: "Choix entre migration Big Bang ou progressive par lots pour le référentiel client", categorie: "Stratégie", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Fatima Zahra El Idrissi", statut: "Validée", date_identification: "2026-01-30", commentaires: "Migration progressive retenue — par région puis par segment client" },
    { type: "Décision", intitule: "Sélection Salesforce comme CRM", description: "Choix de Salesforce Financial Services Cloud comme plateforme CRM unifiée", categorie: "Architecture", chantierCode: "CH_016", domaine: "Distribution & communication", responsable: "Ahmed Chraibi", statut: "Validée", date_identification: "2026-02-28", commentaires: "Validé en CTR #3. Contrat en cours de finalisation." },
    { type: "Décision", intitule: "Architecture microservices pour la plateforme d'intégration", description: "Adopter une architecture microservices avec API Gateway Kong", categorie: "Architecture", chantierCode: "CH_032", domaine: "Intégrations", responsable: "Zineb Hajji", statut: "Validée", date_identification: "2026-01-20" },
    { type: "Décision", intitule: "Budget additionnel pour le renforcement SOC", description: "Demande de budget supplémentaire de 2M MAD pour le SOC 24/7", categorie: "Budget", chantierCode: "CH_038", domaine: "Capacités techniques", responsable: "Othmane Cherkaoui", statut: "En attente", date_identification: "2026-03-05", commentaires: "En attente de validation par le comité de direction" },
    { type: "Décision", intitule: "Externalisation des tests de pénétration", description: "Confier les pentests à un prestataire externe certifié CREST", categorie: "Sécurité", chantierCode: "CH_038", domaine: "Capacités techniques", responsable: "Othmane Cherkaoui", statut: "Validée", date_identification: "2026-02-10" },
    { type: "Décision", intitule: "Report du Go-Live eBanking au T2 2027", description: "Reporter la mise en production du nouveau eBanking de T1 à T2 2027", categorie: "Planning", chantierCode: "CH_043", domaine: "Distribution & communication", responsable: "Meryem Belkadi", statut: "Reportée", date_identification: "2026-09-15", commentaires: "Reportée au prochain comité de programme pour arbitrage" },
    { type: "Décision", intitule: "Stratégie de test automatisé", description: "Mettre en place une stratégie de test automatisé avec Selenium et JMeter", categorie: "Qualité", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Salma Benjelloun", statut: "En attente", date_identification: "2026-03-10", commentaires: "En cours d'évaluation par l'équipe MOE" },
    { type: "Décision", intitule: "Choix du cloud provider pour les environnements", description: "Sélectionner Azure comme cloud provider pour les environnements hors-prod", categorie: "Infrastructure", chantierCode: "CH_032", domaine: "Intégrations", responsable: "Zineb Hajji", statut: "Refusée", date_identification: "2026-02-20", commentaires: "Refusée par la DSSI — maintien on-premise pour raisons réglementaires BAM" },

    // ── INFORMATIONS ──────────────────────────────────
    { type: "Information", intitule: "Nouvelle circulaire BAM sur les données clients", description: "Bank Al-Maghrib a publié une nouvelle circulaire sur la gouvernance des données clients (Circ. 5/W/2026)", categorie: "Réglementaire", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Fatima Zahra El Idrissi", statut: "Ouvert", date_identification: "2026-02-15" },
    { type: "Information", intitule: "Maintenance datacenter prévue en avril", description: "Le datacenter principal sera en maintenance le weekend du 18-19 avril. Impact potentiel sur les environnements de dev.", categorie: "Infrastructure", chantierCode: "CH_032", domaine: "Intégrations", responsable: "Othmane Cherkaoui", statut: "Ouvert", date_identification: "2026-03-01" },
    { type: "Information", intitule: "Temenos a publié la release R26", description: "La release R26 de Temenos inclut des améliorations de performance et de nouvelles APIs", categorie: "Éditeur", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Salma Benjelloun", statut: "Ouvert", date_identification: "2026-03-05" },
    { type: "Information", intitule: "Convention AUSIM — Présentation transformation SI", description: "La transformation SI sera présentée à la convention annuelle de l'AUSIM en mai 2026", categorie: "Communication", chantierCode: "CH_038", domaine: "Capacités techniques", responsable: "Zineb Hajji", statut: "Ouvert", date_identification: "2026-02-20" },
    { type: "Information", intitule: "Fin de support Oracle Forms 12c", description: "Oracle a annoncé la fin de support étendu de Forms 12c pour décembre 2027", categorie: "Technique", chantierCode: "CH_023", domaine: "Banque du quotidien", responsable: "Rachid Amrani", statut: "Ouvert", date_identification: "2026-01-10" },
    { type: "Information", intitule: "Accord-cadre Capgemini renouvelé", description: "L'accord-cadre avec Capgemini a été renouvelé pour 3 ans avec des conditions tarifaires améliorées", categorie: "Achats", chantierCode: "CH_016", domaine: "Distribution & communication", responsable: "Ahmed Chraibi", statut: "Clôturé", date_identification: "2026-02-01" },
    { type: "Information", intitule: "Migration réussie du POC référentiel produit", description: "Le POC de migration du référentiel produit a été réalisé avec succès — 98.5% de données migrées sans erreur", categorie: "Technique", chantierCode: "CH_014", domaine: "Référentiels", responsable: "Yassine Boukhris", statut: "Clôturé", date_identification: "2026-03-01" },
    { type: "Information", intitule: "Résultats audit sécurité Q1", description: "L'audit sécurité Q1 révèle 3 vulnérabilités critiques corrigées et 12 mineures en cours", categorie: "Sécurité", chantierCode: "CH_038", domaine: "Capacités techniques", responsable: "Othmane Cherkaoui", statut: "Ouvert", date_identification: "2026-03-10" },
  ];

  let totalRaid = 0;
  for (const r of raidEntries) {
    const chantierId = codeToId[r.chantierCode] ?? null;
    const ressourceId = createdRessources[r.responsable] ?? null;
    await prisma.raid.create({
      data: {
        type: r.type,
        intitule: r.intitule,
        description: r.description,
        categorie: r.categorie,
        chantierId,
        domaine: r.domaine,
        probabilite: r.probabilite ?? null,
        impact: r.impact ?? null,
        strategie: r.strategie ?? "",
        mitigation: r.mitigation ?? "",
        responsable: r.responsable,
        responsableRessourceId: ressourceId,
        statut: r.statut,
        date_identification: r.date_identification ? new Date(r.date_identification) : null,
        date_echeance: r.date_echeance ? new Date(r.date_echeance) : null,
        date_revision: r.date_revision ? new Date(r.date_revision) : null,
        commentaires: r.commentaires ?? "",
      },
    });
    totalRaid++;
  }

  // ── Adhérences (Dependencies) ─────────────────────────────────────────
  const adherencesData: {
    code: string;
    sourceCode: string;
    dependantCode: string | null; // null = transverse
    dependantLabel: string;
    type: string;
    domaine: string;
    description: string;
    criticite: string;
    statut: string;
    date_identification: string;
    date_resolution_prevue: string;
    responsable: string;
    contrat_interface: string;
    commentaires: string;
  }[] = [
    // BLOQUANTE — Infrastructure
    { code: "ADH-001", sourceCode: "CH_041", dependantCode: "CH_023", dependantLabel: "", type: "Technique", domaine: "Infrastructure", description: "Environnements serveurs et stockage requis pour CBS", criticite: "BLOQUANTE", statut: "En cours", date_identification: "2026-01-15", date_resolution_prevue: "2026-06-30", responsable: "Lead Infra", contrat_interface: "CI-041-023", commentaires: "Lot 1 prioritaire" },
    { code: "ADH-002", sourceCode: "CH_041", dependantCode: "CH_016", dependantLabel: "", type: "Technique", domaine: "Infrastructure", description: "Environnements cloud pour Salesforce", criticite: "BLOQUANTE", statut: "En cours", date_identification: "2026-01-15", date_resolution_prevue: "2026-03-31", responsable: "Lead Infra", contrat_interface: "CI-041-016", commentaires: "" },
    { code: "ADH-003", sourceCode: "CH_041", dependantCode: "CH_025", dependantLabel: "", type: "Technique", domaine: "Infrastructure", description: "Infrastructure haute disponibilité paiements", criticite: "BLOQUANTE", statut: "Planifié", date_identification: "2026-01-15", date_resolution_prevue: "2026-05-31", responsable: "Lead Infra", contrat_interface: "CI-041-025", commentaires: "" },
    // BLOQUANTE — Cybersécurité
    { code: "ADH-004", sourceCode: "CH_038", dependantCode: "CH_023", dependantLabel: "", type: "Technique", domaine: "Sécurité", description: "IAM/SSO pour authentification CBS", criticite: "BLOQUANTE", statut: "En cours", date_identification: "2026-01-15", date_resolution_prevue: "2026-08-31", responsable: "Lead RSSI", contrat_interface: "CI-038-023", commentaires: "Lot IAM/IGA" },
    { code: "ADH-005", sourceCode: "CH_038", dependantCode: "CH_016", dependantLabel: "", type: "Technique", domaine: "Sécurité", description: "SSO et MFA pour accès CRM", criticite: "BLOQUANTE", statut: "En cours", date_identification: "2026-01-15", date_resolution_prevue: "2026-07-31", responsable: "Lead RSSI", contrat_interface: "CI-038-016", commentaires: "" },
    { code: "ADH-006", sourceCode: "CH_038", dependantCode: "CH_043", dependantLabel: "", type: "Technique", domaine: "Sécurité", description: "Authentification forte clients digitaux", criticite: "BLOQUANTE", statut: "Planifié", date_identification: "2026-01-15", date_resolution_prevue: "2026-08-31", responsable: "Lead RSSI", contrat_interface: "CI-038-043", commentaires: "" },
    // BLOQUANTE — API Management
    { code: "ADH-007", sourceCode: "CH_032", dependantCode: "CH_023", dependantLabel: "", type: "Technique", domaine: "Intégration", description: "Gateway API pour exposition services CBS", criticite: "BLOQUANTE", statut: "En cours", date_identification: "2026-01-15", date_resolution_prevue: "2026-09-30", responsable: "Lead Archi", contrat_interface: "CI-032-023", commentaires: "" },
    { code: "ADH-008", sourceCode: "CH_032", dependantCode: "CH_016", dependantLabel: "", type: "Technique", domaine: "Intégration", description: "APIs client 360 pour CRM", criticite: "BLOQUANTE", statut: "En cours", date_identification: "2026-01-15", date_resolution_prevue: "2026-09-30", responsable: "Lead Archi", contrat_interface: "CI-032-016", commentaires: "" },
    { code: "ADH-009", sourceCode: "CH_032", dependantCode: "CH_025", dependantLabel: "", type: "Technique", domaine: "Intégration", description: "APIs paiement temps réel", criticite: "BLOQUANTE", statut: "Planifié", date_identification: "2026-01-15", date_resolution_prevue: "2026-09-30", responsable: "Lead Archi", contrat_interface: "CI-032-025", commentaires: "" },
    { code: "ADH-010", sourceCode: "CH_032", dependantCode: "CH_043", dependantLabel: "", type: "Technique", domaine: "Intégration", description: "APIs services bancaires pour eBanking", criticite: "BLOQUANTE", statut: "Planifié", date_identification: "2026-01-15", date_resolution_prevue: "2026-09-30", responsable: "Lead Archi", contrat_interface: "CI-032-043", commentaires: "" },
    // FORTE — Référentiels
    { code: "ADH-011", sourceCode: "CH_014", dependantCode: "CH_016", dependantLabel: "", type: "Fonctionnelle", domaine: "Données", description: "Golden Record Client pour vue 360°", criticite: "FORTE", statut: "En cours", date_identification: "2026-02-01", date_resolution_prevue: "2026-10-31", responsable: "Resp. Réf.", contrat_interface: "CI-014-016", commentaires: "" },
    { code: "ADH-012", sourceCode: "CH_014", dependantCode: "CH_023", dependantLabel: "", type: "Fonctionnelle", domaine: "Données", description: "Référentiel Produits pour CBS", criticite: "FORTE", statut: "En cours", date_identification: "2026-02-01", date_resolution_prevue: "2026-12-31", responsable: "Resp. Réf.", contrat_interface: "CI-014-023", commentaires: "" },
    { code: "ADH-013", sourceCode: "CH_014", dependantCode: "CH_025", dependantLabel: "", type: "Fonctionnelle", domaine: "Données", description: "Référentiel Tiers pour paiements", criticite: "FORTE", statut: "Planifié", date_identification: "2026-02-01", date_resolution_prevue: "2027-06-30", responsable: "Resp. Réf.", contrat_interface: "CI-014-025", commentaires: "" },
    { code: "ADH-014", sourceCode: "CH_014", dependantCode: "CH_027", dependantLabel: "", type: "Données", domaine: "Données", description: "Données référentielles pour reporting", criticite: "FORTE", statut: "Planifié", date_identification: "2026-02-01", date_resolution_prevue: "2027-03-31", responsable: "Resp. Réf.", contrat_interface: "CI-014-027", commentaires: "" },
    // FORTE — DataLake
    { code: "ADH-015", sourceCode: "CH_001", dependantCode: "CH_027", dependantLabel: "", type: "Données", domaine: "Données", description: "Données analytiques pour reporting", criticite: "FORTE", statut: "Planifié", date_identification: "2026-01-15", date_resolution_prevue: "2026-12-31", responsable: "Lead Data", contrat_interface: "CI-001-027", commentaires: "" },
    { code: "ADH-016", sourceCode: "CH_001", dependantCode: "CH_008", dependantLabel: "", type: "Données", domaine: "Données", description: "Données de contrôle et audit", criticite: "FORTE", statut: "Planifié", date_identification: "2026-01-15", date_resolution_prevue: "2027-03-31", responsable: "Lead Data", contrat_interface: "CI-001-008", commentaires: "" },
    { code: "ADH-017", sourceCode: "CH_001", dependantCode: "CH_010", dependantLabel: "", type: "Données", domaine: "Données", description: "Données risques et conformité", criticite: "FORTE", statut: "Planifié", date_identification: "2026-01-15", date_resolution_prevue: "2027-06-30", responsable: "Lead Data", contrat_interface: "CI-001-010", commentaires: "" },
    // FORTE — CBS
    { code: "ADH-018", sourceCode: "CH_023", dependantCode: "CH_025", dependantLabel: "", type: "Fonctionnelle", domaine: "Métier", description: "APIs comptes pour initiation paiements", criticite: "FORTE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2027-12-31", responsable: "Dir. CBS", contrat_interface: "CI-023-025", commentaires: "" },
    { code: "ADH-019", sourceCode: "CH_023", dependantCode: "CH_043", dependantLabel: "", type: "Fonctionnelle", domaine: "Métier", description: "Services bancaires pour canaux digitaux", criticite: "FORTE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2028-03-31", responsable: "Dir. CBS", contrat_interface: "CI-023-043", commentaires: "" },
    { code: "ADH-020", sourceCode: "CH_023", dependantCode: "CH_015", dependantLabel: "", type: "Fonctionnelle", domaine: "Métier", description: "Intégration tarification produits CBS", criticite: "FORTE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2028-03-31", responsable: "Dir. CBS", contrat_interface: "CI-023-015", commentaires: "" },
    { code: "ADH-021", sourceCode: "CH_023", dependantCode: "CH_027", dependantLabel: "", type: "Données", domaine: "Données", description: "Données comptables et subledger", criticite: "FORTE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2027-09-30", responsable: "Dir. CBS", contrat_interface: "CI-023-027", commentaires: "" },
    // MODÉRÉE
    { code: "ADH-022", sourceCode: "CH_016", dependantCode: "CH_043", dependantLabel: "", type: "Fonctionnelle", domaine: "Métier", description: "Vision client partagée omnicanal", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2028-06-30", responsable: "Dir. CRM", contrat_interface: "CI-016-043", commentaires: "" },
    { code: "ADH-023", sourceCode: "CH_016", dependantCode: "CH_028", dependantLabel: "", type: "Technique", domaine: "Intégration", description: "GED intégrée au CRM", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2027-03-31", responsable: "Dir. CRM", contrat_interface: "CI-016-028", commentaires: "" },
    { code: "ADH-024", sourceCode: "CH_028", dependantCode: "CH_023", dependantLabel: "", type: "Technique", domaine: "Intégration", description: "Documents liés aux opérations CBS", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2027-06-30", responsable: "Dir. GED", contrat_interface: "CI-028-023", commentaires: "" },
    { code: "ADH-025", sourceCode: "CH_028", dependantCode: "CH_043", dependantLabel: "", type: "Technique", domaine: "Intégration", description: "Signature électronique eBanking", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2028-06-30", responsable: "Dir. GED", contrat_interface: "CI-028-043", commentaires: "" },
    // Transverse
    { code: "ADH-026", sourceCode: "CH_035", dependantCode: null, dependantLabel: "Tous chantiers applicatifs", type: "Technique", domaine: "Outillage", description: "CI/CD pour déploiements", criticite: "MODÉRÉE", statut: "En cours", date_identification: "2026-03-01", date_resolution_prevue: "2027-09-30", responsable: "Lead DevOps", contrat_interface: "N/A", commentaires: "Transverse" },
    { code: "ADH-027", sourceCode: "CH_036", dependantCode: null, dependantLabel: "Tous chantiers", type: "Technique", domaine: "Support", description: "Gestion incidents et demandes", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-06-01", date_resolution_prevue: "2027-12-31", responsable: "Lead ITSM", contrat_interface: "N/A", commentaires: "Transverse" },
    { code: "ADH-028", sourceCode: "CH_015", dependantCode: "CH_016", dependantLabel: "", type: "Fonctionnelle", domaine: "Métier", description: "Tarifs pour devis et simulations", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-07-01", date_resolution_prevue: "2028-06-30", responsable: "Resp. Tarif", contrat_interface: "CI-015-016", commentaires: "" },
    { code: "ADH-029", sourceCode: "CH_015", dependantCode: "CH_043", dependantLabel: "", type: "Fonctionnelle", domaine: "Métier", description: "Tarifs affichés sur canaux digitaux", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-07-01", date_resolution_prevue: "2028-09-30", responsable: "Resp. Tarif", contrat_interface: "CI-015-043", commentaires: "" },
    { code: "ADH-030", sourceCode: "CH_033", dependantCode: "CH_001", dependantLabel: "", type: "Technique", domaine: "Données", description: "Alimentation DataLake", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2029-12-31", responsable: "Lead ETL", contrat_interface: "CI-033-001", commentaires: "" },
    { code: "ADH-031", sourceCode: "CH_033", dependantCode: "CH_027", dependantLabel: "", type: "Technique", domaine: "Données", description: "Traitements pour reporting", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-04-01", date_resolution_prevue: "2027-09-30", responsable: "Lead ETL", contrat_interface: "CI-033-027", commentaires: "" },
    { code: "ADH-032", sourceCode: "CH_034", dependantCode: "CH_025", dependantLabel: "", type: "Technique", domaine: "Intégration", description: "Échanges partenaires paiements", criticite: "MODÉRÉE", statut: "Planifié", date_identification: "2026-05-01", date_resolution_prevue: "2027-05-31", responsable: "Lead Échanges", contrat_interface: "CI-034-025", commentaires: "" },
    // FAIBLE
    { code: "ADH-033", sourceCode: "CH_040", dependantCode: null, dependantLabel: "Tous chantiers", type: "Ressources", domaine: "Collaboration", description: "Teams/Sharepoint pour collaboration projet", criticite: "FAIBLE", statut: "En cours", date_identification: "2026-04-01", date_resolution_prevue: "2027-10-31", responsable: "Lead Comm.", contrat_interface: "N/A", commentaires: "" },
    { code: "ADH-034", sourceCode: "CH_037", dependantCode: null, dependantLabel: "Tous chantiers", type: "Ressources", domaine: "Pilotage", description: "Outil de suivi programme", criticite: "FAIBLE", statut: "En cours", date_identification: "2026-03-01", date_resolution_prevue: "2026-12-31", responsable: "PMO Programme", contrat_interface: "N/A", commentaires: "Cockpit" },
    { code: "ADH-035", sourceCode: "CH_030", dependantCode: null, dependantLabel: "Tous chantiers", type: "Technique", domaine: "Architecture", description: "Cartographie et urbanisation", criticite: "FAIBLE", statut: "En cours", date_identification: "2026-01-15", date_resolution_prevue: "2030-12-31", responsable: "Lead Archi", contrat_interface: "N/A", commentaires: "Continu" },
    { code: "ADH-036", sourceCode: "CH_008", dependantCode: "CH_027", dependantLabel: "", type: "Fonctionnelle", domaine: "Contrôle", description: "Données contrôle pour reporting", criticite: "FAIBLE", statut: "Planifié", date_identification: "2027-01-01", date_resolution_prevue: "2028-03-31", responsable: "Dir. Contrôle", contrat_interface: "CI-008-027", commentaires: "" },
    { code: "ADH-037", sourceCode: "CH_010", dependantCode: "CH_027", dependantLabel: "", type: "Fonctionnelle", domaine: "Risques", description: "Données risques pour reporting", criticite: "FAIBLE", statut: "Planifié", date_identification: "2027-03-01", date_resolution_prevue: "2027-12-31", responsable: "Dir. GRC", contrat_interface: "CI-010-027", commentaires: "" },
  ];

  let totalAdherences = 0;
  for (const a of adherencesData) {
    const sourceId = codeToId[a.sourceCode];
    if (!sourceId) continue;
    const dependantId = a.dependantCode ? (codeToId[a.dependantCode] ?? null) : null;
    await prisma.adherence.create({
      data: {
        code: a.code,
        chantierSourceId: sourceId,
        chantierDependantId: dependantId,
        chantierDependantLabel: a.dependantLabel,
        type: a.type,
        domaine: a.domaine,
        description: a.description,
        criticite: a.criticite,
        statut: a.statut,
        date_identification: new Date(a.date_identification),
        date_resolution_prevue: new Date(a.date_resolution_prevue),
        responsable: a.responsable,
        contrat_interface: a.contrat_interface,
        commentaires: a.commentaires,
      },
    });
    totalAdherences++;
  }

  // ── Consultation Questions (Backlog Q&A) ──────────

  const consultationQuestionsData = [
    { chantierCode: "CH_001", dossier_ref: "DCE-EI-001", question: "Quelle est la stratégie de migration des données historiques du core banking actuel ?", categorie: "Technique", priorite: "Critique", statut: "Ouverte", remontee_par: "Équipe Métier", affectee_a: "M. Bennani", echeance: "2026-04-01" },
    { chantierCode: "CH_001", dossier_ref: "DCE-EI-001", question: "Le prestataire peut-il garantir une disponibilité 99.99% pendant la phase de migration ?", categorie: "Technique", priorite: "Haute", statut: "En cours", remontee_par: "DSI", affectee_a: "M. El Fassi", echeance: "2026-03-25" },
    { chantierCode: "CH_001", dossier_ref: "DCE-EI-001", question: "Quelles sont les clauses de réversibilité en cas de changement de prestataire ?", categorie: "Juridique", priorite: "Haute", statut: "Résolue", remontee_par: "Direction Juridique", affectee_a: "Mme Alaoui", resolution: "Les clauses de réversibilité ont été intégrées à l'annexe 7 du contrat cadre avec une période de transition de 12 mois." },
    { chantierCode: "CH_002", dossier_ref: "DCE-RH-001", question: "Le module de gestion des talents supporte-t-il la réglementation marocaine du travail ?", categorie: "Fonctionnelle", priorite: "Critique", statut: "Ouverte", remontee_par: "DRH", affectee_a: "M. Tazi", echeance: "2026-03-20" },
    { chantierCode: "CH_002", dossier_ref: "DCE-RH-001", question: "Quel est le modèle de licensing proposé (par utilisateur, par module) ?", categorie: "Commerciale", priorite: "Moyenne", statut: "En cours", remontee_par: "Direction Achats", affectee_a: "Mme Chraibi" },
    { chantierCode: "CH_003", dossier_ref: "DCE-RISK-001", question: "Comment la solution gère-t-elle le calcul du ratio de solvabilité Bâle III/IV ?", categorie: "Fonctionnelle", priorite: "Critique", statut: "Ouverte", remontee_par: "Direction des Risques", affectee_a: "M. Berrada", echeance: "2026-04-15" },
    { chantierCode: "CH_003", dossier_ref: "DCE-RISK-001", question: "La solution permet-elle l'intégration avec les systèmes de reporting réglementaire BAM ?", categorie: "Technique", priorite: "Haute", statut: "Ouverte", remontee_par: "Conformité", affectee_a: "M. Berrada", echeance: "2026-04-10" },
    { chantierCode: "CH_004", dossier_ref: "DCE-FIN-001", question: "Le progiciel comptable supporte-t-il les normes IFRS 9 et IFRS 17 ?", categorie: "Fonctionnelle", priorite: "Haute", statut: "Résolue", remontee_par: "Direction Financière", affectee_a: "M. Amrani", resolution: "Confirmé par l'éditeur. Support natif IFRS 9. IFRS 17 via module additionnel prévu Q3 2026." },
    { chantierCode: "CH_005", dossier_ref: "DCE-SEC-001", question: "Quelles certifications de sécurité le prestataire détient-il (ISO 27001, SOC 2) ?", categorie: "Technique", priorite: "Haute", statut: "En cours", remontee_par: "RSSI", affectee_a: "M. Lahlou", echeance: "2026-03-30" },
    { chantierCode: "CH_005", dossier_ref: "DCE-SEC-001", question: "La solution est-elle conforme aux exigences de Bank Al-Maghrib en matière de cybersécurité ?", categorie: "Juridique", priorite: "Critique", statut: "Ouverte", remontee_par: "RSSI", affectee_a: "M. Lahlou", echeance: "2026-03-28" },
    { chantierCode: "CH_010", dossier_ref: "DCE-CRM-001", question: "Le CRM supporte-t-il le multi-canal (agence, mobile, web, call center) ?", categorie: "Fonctionnelle", priorite: "Moyenne", statut: "Résolue", remontee_par: "Direction Commerciale", affectee_a: "Mme Naciri", resolution: "Oui, le CRM offre une vue 360° client unifiée sur tous les canaux. Démonstration validée." },
    { chantierCode: "CH_010", dossier_ref: "DCE-CRM-001", question: "Quel est le délai d'implémentation estimé pour le module de scoring client ?", categorie: "Commerciale", priorite: "Basse", statut: "En cours", remontee_par: "Direction Commerciale", affectee_a: "Mme Naciri" },
    { chantierCode: "CH_015", dossier_ref: "DCE-PAY-001", question: "La solution de paiement est-elle certifiée PCI-DSS niveau 1 ?", categorie: "Technique", priorite: "Critique", statut: "En cours", remontee_par: "Monétique", affectee_a: "M. Hajji", echeance: "2026-04-05" },
    { chantierCode: "CH_020", dossier_ref: "DCE-MOB-001", question: "L'application mobile supporte-t-elle la biométrie (empreinte + reconnaissance faciale) ?", categorie: "Fonctionnelle", priorite: "Moyenne", statut: "Ouverte", remontee_par: "Digital Banking", affectee_a: "Mme Idrissi", echeance: "2026-04-20" },
    { chantierCode: "CH_020", dossier_ref: "DCE-MOB-001", question: "Quelle est la taille maximale de la base utilisateurs supportée sans dégradation ?", categorie: "Technique", priorite: "Haute", statut: "Abandonnée", remontee_par: "DSI", affectee_a: "M. El Fassi" },
    { chantierCode: "CH_025", dossier_ref: "DCE-DATA-001", question: "Le data warehouse supporte-t-il le traitement temps réel (streaming) ?", categorie: "Technique", priorite: "Haute", statut: "Ouverte", remontee_par: "Data Office", affectee_a: "M. Bouazza", echeance: "2026-04-12" },
    { chantierCode: "CH_030", dossier_ref: "DCE-PROC-001", question: "Le moteur BPM proposé est-il compatible avec les standards BPMN 2.0 ?", categorie: "Technique", priorite: "Moyenne", statut: "Résolue", remontee_par: "Organisation", affectee_a: "M. Kettani", resolution: "Confirmé compatible BPMN 2.0. Documentation technique fournie." },
    { chantierCode: "CH_016", dossier_ref: "DCE-CRM-002", question: "Salesforce Financial Services Cloud étant hébergé en mode SaaS sur des datacenters hors Maroc, comment garantir la conformité aux exigences de Bank Al-Maghrib (circulaire 4/W/2021) sur la localisation et la souveraineté des données bancaires clients ? Quelles mesures de chiffrement, de résidence des données et de droit d'audit sont prévues ?", categorie: "Juridique", priorite: "Critique", statut: "Ouverte", remontee_par: "Direction Conformité & RSSI", affectee_a: "M. Lahlou", echeance: "2026-04-15" },
    { chantierCode: "CH_016", dossier_ref: "DCE-CRM-002", question: "Quel est le coût total (licensing + implémentation + run) de la couche iPaaS (MuleSoft / autre) nécessaire pour les intégrations API entre Salesforce et les systèmes legacy (core banking, référentiel client, moteur de tarification) ? Combien de connecteurs API sont estimés et quel est le modèle de facturation (par appel, par connecteur, forfait) ?", categorie: "Commerciale", priorite: "Haute", statut: "En cours", remontee_par: "Direction Achats & DSI", affectee_a: "Mme Chraibi", echeance: "2026-04-20" },
    { chantierCode: "CH_041", dossier_ref: "DCE-INFRA-001", question: "Le prestataire propose-t-il un modèle hybrid cloud compatible avec les contraintes BAM sur la localisation des données ?", categorie: "Juridique", priorite: "Critique", statut: "Ouverte", remontee_par: "DSI Infrastructure", affectee_a: "M. Senhaji", echeance: "2026-04-08" },
  ];

  let totalQuestions = 0;
  for (const q of consultationQuestionsData) {
    const cId = codeToId[q.chantierCode];
    if (!cId) continue;
    await prisma.consultationQuestion.create({
      data: {
        chantierId: cId,
        dossier_ref: q.dossier_ref,
        question: q.question,
        categorie: q.categorie,
        priorite: q.priorite,
        statut: q.statut,
        remontee_par: q.remontee_par,
        affectee_a: q.affectee_a,
        echeance: q.echeance ? new Date(q.echeance) : null,
        resolution: q.resolution ?? "",
      },
    });
    totalQuestions++;
  }

  // Default admin (idempotent). Override password with SEED_ADMIN_PASSWORD.
  const adminPassword =
    process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe1!";
  const password_hash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      role: "Admin",
      is_active: true,
      // Do not overwrite an existing password on reseed
    },
    create: {
      username: "admin",
      password_hash,
      role: "Admin",
      must_change_pwd: true,
      is_active: true,
      dashboard_type: "complete",
    },
  });

  console.log(
    `Seed terminé : ${profilsData.length} profils, 46 chantiers, 8 RMDs, ${createdMembres.length} membres équipe, ${ressourcesData.length} ressources, ${membresWithRessource.length * 10} saisies temps, ${totalJalons} jalons, ${totalRaid} RAID, ${totalAdherences} adhérences, ${totalQuestions} questions consultation, admin user ready.`
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
