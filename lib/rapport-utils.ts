import { differenceInDays, isWithinInterval } from "date-fns";
import { scoreCriticite } from "./utils-pmo";

export type Meteo = "vert" | "orange" | "rouge";

export const PHASES_ORDER = ["Précadrage", "Cadrage", "Exécution", "Clôture"] as const;

// ─── Météo ────────────────────────────────────────────────────────────────────

export function computeMeteo(
  chantier: { avancement: number; date_debut: Date; date_fin: Date },
  jalons: { statut: string; date_cible: Date }[],
  raids: { type: string; statut: string; probabilite: number | null; impact: number | null }[]
): Meteo {
  const now = new Date();

  const jalonsEnRetard = jalons.filter(
    (j) => new Date(j.date_cible) < now && !["Atteint", "Annulé"].includes(j.statut)
  ).length;

  const risquesCritiques = raids.filter(
    (r) =>
      r.type === "Risque" &&
      !["Clos", "Matérialisé"].includes(r.statut) &&
      r.probabilite != null &&
      r.impact != null &&
      scoreCriticite(r.impact!, r.probabilite!) >= 15
  ).length;

  const debut = new Date(chantier.date_debut);
  const fin = new Date(chantier.date_fin);
  const totalDays = Math.max(1, differenceInDays(fin, debut));
  const elapsedDays = Math.max(0, differenceInDays(now, debut));
  const expectedPct = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  const gap = expectedPct - chantier.avancement;

  let score = 0;
  if (jalonsEnRetard >= 3) score += 2;
  else if (jalonsEnRetard >= 1) score += 1;

  if (risquesCritiques >= 3) score += 2;
  else if (risquesCritiques >= 1) score += 1;

  if (gap >= 20) score += 2;
  else if (gap >= 10) score += 1;

  if (score <= 1) return "vert";
  if (score <= 3) return "orange";
  return "rouge";
}

// ─── Active Phase ──────────────────────────────────────────────────────────────

export function getActivePhase(jalons: { phase: string; statut: string }[]): string {
  // Phase with any "En cours" jalon
  for (const phase of PHASES_ORDER) {
    if (jalons.some((j) => j.phase === phase && j.statut === "En cours")) return phase;
  }
  // Last phase that has non-completed jalons
  for (const phase of [...PHASES_ORDER].reverse()) {
    if (jalons.some((j) => j.phase === phase && !["Annulé"].includes(j.statut))) {
      if (jalons.some((j) => j.phase === phase && !["Atteint", "Annulé"].includes(j.statut)))
        return phase;
    }
  }
  // First phase with any jalon
  for (const phase of PHASES_ORDER) {
    if (jalons.some((j) => j.phase === phase)) return phase;
  }
  return "Exécution";
}

// ─── Labels ────────────────────────────────────────────────────────────────────

export function getProbabiliteLabel(p: number | null): string {
  if (p == null) return "—";
  if (p <= 1) return "Faible";
  if (p <= 2) return "Modéré";
  if (p <= 3) return "Élevé";
  return "Très élevé";
}

export function getImpactLabel(i: number | null): string {
  if (i == null) return "—";
  if (i <= 1) return "Faible";
  if (i <= 2) return "Modéré";
  if (i <= 3) return "Fort";
  if (i <= 4) return "Très fort";
  return "Critique";
}

export function getProbabiliteColor(p: number | null): string {
  if (p == null) return "#6b7280";
  if (p <= 2) return "#22c55e";
  if (p <= 3) return "#f59e0b";
  return "#ef4444";
}

export function getImpactColor(i: number | null): string {
  if (i == null) return "#6b7280";
  if (i <= 2) return "#22c55e";
  if (i <= 3) return "#f59e0b";
  return "#ef4444";
}

// ─── Team helpers ─────────────────────────────────────────────────────────────

type MembreNameSource = {
  is_directeur?: boolean;
  role: string;
  nom_complet?: string;
  ressource?: { nom_complet: string } | null;
};

function membreDisplayName(m: MembreNameSource): string {
  return m.ressource?.nom_complet?.trim() || m.nom_complet?.trim() || "—";
}

export function getDirecteur(
  chantier: { directeur: string },
  membres: MembreNameSource[]
): string {
  if (chantier.directeur) return chantier.directeur;
  const dc = membres.find((m) => m.is_directeur);
  return dc ? membreDisplayName(dc) : "—";
}

export function getSuppleant(
  chantier: { pmo: string },
  membres: MembreNameSource[]
): string {
  if (chantier.pmo) return chantier.pmo;
  const supp = membres.find(
    (m) => m.role.toLowerCase().includes("supp") || m.role.toLowerCase().includes("pmo")
  );
  return supp ? membreDisplayName(supp) : "—";
}

// ─── Jalon phase stats ────────────────────────────────────────────────────────

export function getPhaseStats(jalons: { phase: string; statut: string }[], phase: string) {
  const phaseJalons = jalons.filter((j) => j.phase === phase);
  const atteints = phaseJalons.filter((j) => j.statut === "Atteint").length;
  return { total: phaseJalons.length, atteints };
}
