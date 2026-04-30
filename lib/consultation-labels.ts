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
