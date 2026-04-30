// ── Type de Ressource ────────────────────────────────
export const RESSOURCE_TYPE_LABELS: Record<string, string> = {
  Interne: "Interne",
  Externe: "Externe",
  Consultant: "Consultant",
};

export const RESSOURCE_TYPE_COLORS: Record<string, string> = {
  Interne: "#2563eb",
  Externe: "#059669",
  Consultant: "#7c3aed",
};

// ── Statut actif/inactif ─────────────────────────────
export const RESSOURCE_ACTIF_LABELS: Record<string, string> = {
  true: "Actif",
  false: "Inactif",
};

export const RESSOURCE_ACTIF_COLORS: Record<string, string> = {
  true: "#22c55e",
  false: "#6b7280",
};
