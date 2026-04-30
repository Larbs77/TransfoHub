export const PHASES = ["Précadrage", "Cadrage", "Exécution", "Clôture"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_COLORS: Record<string, string> = {
  "Précadrage": "#4a6d78",
  "Cadrage":    "#0b889e",
  "Exécution":  "#0cb71a",
  "Clôture":    "#0508da",
};

export const STATUT_JALON_LABELS: Record<string, string> = {
  "Planifié":  "Planifié",
  "En cours":  "En cours",
  "Atteint":   "Atteint",
  "Reporté":   "Reporté",
  "Annulé":    "Annulé",
};

export const STATUT_JALON_COLORS: Record<string, string> = {
  "Planifié":  "#94a3b8",
  "En cours":  "#3b82f6",
  "Atteint":   "#22c55e",
  "Reporté":   "#f59e0b",
  "Annulé":    "#6b7280",
};

export const STATUT_JALON_LIST = Object.keys(STATUT_JALON_LABELS);

// Template milestones per phase — offsetPct positions milestone as % of chantier duration
export const JALON_TEMPLATES: { phase: string; nom: string; ordre: number; offsetPct: number }[] = [
  // Précadrage (0-10%)
  { phase: "Précadrage", nom: "Lancement pré-cadrage",           ordre: 1, offsetPct: 0 },
  { phase: "Précadrage", nom: "Analyse de l'existant",           ordre: 2, offsetPct: 3 },
  { phase: "Précadrage", nom: "Expression des besoins",          ordre: 3, offsetPct: 5 },
  { phase: "Précadrage", nom: "Go/No-Go cadrage",                ordre: 4, offsetPct: 10 },
  // Cadrage (10-25%)
  { phase: "Cadrage",    nom: "Validation périmètre",            ordre: 1, offsetPct: 12 },
  { phase: "Cadrage",    nom: "Étude de faisabilité",            ordre: 2, offsetPct: 15 },
  { phase: "Cadrage",    nom: "Cahier des charges validé",       ordre: 3, offsetPct: 18 },
  { phase: "Cadrage",    nom: "Sélection éditeur/solution",      ordre: 4, offsetPct: 20 },
  { phase: "Cadrage",    nom: "Go/No-Go exécution",              ordre: 5, offsetPct: 25 },
  // Exécution (25-85%)
  { phase: "Exécution",  nom: "Kick-off projet",                 ordre: 1, offsetPct: 26 },
  { phase: "Exécution",  nom: "Spécifications fonctionnelles",   ordre: 2, offsetPct: 35 },
  { phase: "Exécution",  nom: "Développement / Paramétrage",     ordre: 3, offsetPct: 50 },
  { phase: "Exécution",  nom: "Tests unitaires",                 ordre: 4, offsetPct: 60 },
  { phase: "Exécution",  nom: "Tests d'intégration",             ordre: 5, offsetPct: 65 },
  { phase: "Exécution",  nom: "UAT (Recette utilisateur)",       ordre: 6, offsetPct: 72 },
  { phase: "Exécution",  nom: "Formation utilisateurs",          ordre: 7, offsetPct: 78 },
  { phase: "Exécution",  nom: "Go-Live / Mise en production",    ordre: 8, offsetPct: 85 },
  // Clôture (85-100%)
  { phase: "Clôture",    nom: "Hypercare / Stabilisation",       ordre: 1, offsetPct: 88 },
  { phase: "Clôture",    nom: "Transfert de compétences",        ordre: 2, offsetPct: 92 },
  { phase: "Clôture",    nom: "Bilan projet",                    ordre: 3, offsetPct: 96 },
  { phase: "Clôture",    nom: "Clôture formelle",                ordre: 4, offsetPct: 100 },
];

/** Calculate date_cible from offsetPct and chantier date range */
export function calculateDateCible(
  dateDebut: Date,
  dateFin: Date,
  offsetPct: number
): Date {
  const duration = dateFin.getTime() - dateDebut.getTime();
  return new Date(dateDebut.getTime() + (duration * offsetPct) / 100);
}
