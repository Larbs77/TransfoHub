// ── Adherence Type ──────────────────────────────────
export const ADHERENCE_TYPES = ["Technique", "Fonctionnelle", "Données", "Ressources"] as const;

export const ADHERENCE_TYPE_COLORS: Record<string, string> = {
  Technique: "#3b82f6",
  Fonctionnelle: "#8b5cf6",
  Données: "#f59e0b",
  Ressources: "#10b981",
};

// ── Adherence Status ────────────────────────────────
export const ADHERENCE_STATUTS = ["Planifié", "En cours", "Résolu", "Bloqué"] as const;

export const ADHERENCE_STATUT_COLORS: Record<string, string> = {
  "Planifié": "#94a3b8",
  "En cours": "#3b82f6",
  "Résolu": "#22c55e",
  "Bloqué": "#ef4444",
};

// ── Adherence Criticité ─────────────────────────────
export const ADHERENCE_CRITICITES = ["BLOQUANTE", "FORTE", "MODÉRÉE", "FAIBLE"] as const;

export const ADHERENCE_CRITICITE_COLORS: Record<string, string> = {
  BLOQUANTE: "#dc2626",
  FORTE: "#f97316",
  "MODÉRÉE": "#f59e0b",
  FAIBLE: "#22c55e",
};

// ── Adherence Domaine ───────────────────────────────
export const ADHERENCE_DOMAINES = [
  "Infrastructure",
  "Sécurité",
  "Intégration",
  "Données",
  "Métier",
  "Contrôle",
  "Risques",
  "Architecture",
  "Collaboration",
  "Pilotage",
  "Outillage",
  "Support",
] as const;
