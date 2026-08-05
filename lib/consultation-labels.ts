// ── Catégorie ──────────────────────────────────────
export const QA_CATEGORIES = ["Technique", "Fonctionnelle", "Juridique", "Commerciale", "Générale"] as const;

export const QA_CATEGORIE_COLORS: Record<string, string> = {
  Technique: "#3b82f6",
  Fonctionnelle: "#8b5cf6",
  Juridique: "#f59e0b",
  Commerciale: "#10b981",
  "Générale": "#94a3b8",
};

// ── Priorité ───────────────────────────────────────
export const QA_PRIORITES = ["Critique", "Haute", "Moyenne", "Basse"] as const;

export const QA_PRIORITE_COLORS: Record<string, string> = {
  Critique: "#dc2626",
  Haute: "#f97316",
  Moyenne: "#f59e0b",
  Basse: "#22c55e",
};

// ── Statut ─────────────────────────────────────────
export const QA_STATUTS = ["Ouverte", "En cours", "Résolue", "Abandonnée"] as const;

export const QA_STATUT_COLORS: Record<string, string> = {
  Ouverte: "#3b82f6",
  "En cours": "#f59e0b",
  "Résolue": "#22c55e",
  "Abandonnée": "#94a3b8",
};

/**
 * Question overdue: based on **échéance actualisée** (fallback: échéance initiale),
 * still open (not Résolue / Abandonnée).
 */
export function isQuestionEnRetard(
  echeanceActualisee: Date | string | null | undefined,
  statut: string,
  now: Date = new Date(),
  /** fallback if actualisée empty (legacy rows) */
  echeanceInitiale?: Date | string | null
): boolean {
  const s = (statut || "").trim();
  if (s === "Résolue" || s === "Abandonnée") return false;
  const raw = echeanceActualisee ?? echeanceInitiale;
  if (!raw) return false;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  const endOfDueDay = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    23,
    59,
    59,
    999
  );
  return endOfDueDay.getTime() < now.getTime();
}

export function isQaClosedStatus(statut: string): boolean {
  const s = (statut || "").trim();
  return s === "Résolue" || s === "Abandonnée";
}
