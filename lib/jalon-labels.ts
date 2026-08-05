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

/**
 * Statuts « clos » : l'élément n'est plus en retard (jalon / workstream / activité).
 * Comparaison normalisée (casse, accents basiques).
 */
export function isPlanningClosedStatut(statut: string | null | undefined): boolean {
  const s = (statut ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return (
    s === "atteint" ||
    s === "annule" ||
    s === "termine" ||
    s === "clos" ||
    s === "cloture" ||
    s === "cloturee" ||
    s === "fait" ||
    s === "realise" ||
    s === "realisee"
  );
}

/** @deprecated prefer isPlanningClosedStatut — conservé pour imports éventuels */
export const PLANNING_CLOSED_STATUTS = new Set(["Atteint", "Annulé"]);

function toDate(v: Date | string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Jours de retard **courant** (élément encore ouvert et échéance dépassée).
 * null si : pas de date, statut clos, date de fin réelle renseignée, ou échéance future.
 */
export function planningRetardDays(
  due: Date | string | null | undefined,
  statut: string,
  now: Date = new Date(),
  opts?: { dateReelle?: Date | string | null }
): number | null {
  // Terminé / clos → jamais « en retard » (même si la date cible est passée)
  if (isPlanningClosedStatut(statut)) return null;
  if (toDate(opts?.dateReelle) != null) return null;

  const d = toDate(due);
  if (!d) return null;
  if (d >= now) return null;

  const days = calendarDaysBetween(d, now);
  return days > 0 ? days : null;
}

export function isPlanningEnRetard(
  due: Date | string | null | undefined,
  statut: string,
  now: Date = new Date(),
  opts?: { dateReelle?: Date | string | null }
): boolean {
  return planningRetardDays(due, statut, now, opts) != null;
}

/** YYYY-MM-DD local (stable for form / DB payload). */
export function toYmdLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Résout la date réelle de finalisation :
 * - statut ≠ Atteint → toujours null (on vide la date réelle)
 * - statut Atteint + date fournie → date fournie
 * - statut Atteint sans date → conserve l'existante ou aujourd'hui
 */
export function resolvePlanningDateReelle(opts: {
  statut: string;
  dateReelle?: string | null;
  previousDateReelle?: Date | string | null;
}): string | null {
  const s = (opts.statut ?? "").trim();
  // Quitter Atteint (ou tout autre statut non Atteint) → écraser / vider la date réelle
  if (s !== "Atteint") {
    return null;
  }

  const explicit =
    opts.dateReelle && String(opts.dateReelle).trim()
      ? String(opts.dateReelle).trim().slice(0, 10)
      : null;
  if (explicit) return explicit;

  const prev = toDate(opts.previousDateReelle);
  if (prev) {
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
  }
  return toYmdLocal();
}

/**
 * Écart de clôture (jours) : date_reelle − date_fin planifiée.
 * null si pas de couple de dates utilisable.
 * + = livré après la fin planifiée ; − = avant.
 */
export function planningClotureEcartDays(
  dateFinPlanifiee: Date | string | null | undefined,
  dateReelle: Date | string | null | undefined
): number | null {
  const fin = toDate(dateFinPlanifiee);
  const reelle = toDate(dateReelle);
  if (!fin || !reelle) return null;
  return calendarDaysBetween(fin, reelle);
}

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
