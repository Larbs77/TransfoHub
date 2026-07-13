// ── Types RAID ─────────────────────────────────────────
export const RAID_TYPES = ["Action", "Risque", "Information", "Décision"] as const;

/** Terminal / closed statuses across RAID types (no further collaboration expected). */
export const RAID_CLOSED_STATUTS = new Set([
  "Clôturé",
  "Clos",
  "Abandonné",
  "NA",
  "Doublon",
  "Validée",
  "Refusée",
  "Matérialisé",
]);

export function isRaidClosed(statut: string): boolean {
  return RAID_CLOSED_STATUTS.has(statut);
}

/**
 * Leadership roles on a chantier team that may move RAID cards on Kanban
 * even when not the personal assignee (RAID linked to that chantier).
 */
export const KANBAN_LEADERSHIP_ROLES = [
  "Directeur de chantier",
  "Directeur de chantier - suppléant",
  "PMO",
] as const;

export function isKanbanLeadershipRole(
  role: string,
  is_directeur?: boolean
): boolean {
  if (is_directeur) return true;
  const r = (role || "").trim();
  if (!r) return false;
  if (
    (KANBAN_LEADERSHIP_ROLES as readonly string[]).some(
      (x) => x.toLowerCase() === r.toLowerCase()
    )
  ) {
    return true;
  }
  if (/directeur\s+de\s+chantier/i.test(r)) return true;
  if (/suppl[eé]ant/i.test(r) && /directeur|chantier/i.test(r)) return true;
  if (/^pmo(\s|$|[-_])/i.test(r) || r.toLowerCase() === "pmo") return true;
  return false;
}

/** Pure client-side check for Kanban drag (no Prisma). */
export function canMoveRaidKanbanClient(
  item: {
    responsableRessourceId: string | null;
    chantierId: string | null;
    equipeId?: string | null;
  },
  ctx: {
    ressourceId: string | null;
    isProgramme: boolean;
    leadershipChantierIds: string[];
    institutionalEquipeId?: string | null;
  }
): boolean {
  if (ctx.isProgramme) return true;
  if (
    ctx.ressourceId &&
    item.responsableRessourceId &&
    item.responsableRessourceId === ctx.ressourceId
  ) {
    return true;
  }
  // Same institutional team as the RAID assignment (off-chantier assignees)
  if (
    ctx.institutionalEquipeId &&
    item.equipeId &&
    item.equipeId === ctx.institutionalEquipeId
  ) {
    return true;
  }
  if (
    item.chantierId &&
    ctx.leadershipChantierIds.includes(item.chantierId)
  ) {
    return true;
  }
  return false;
}

export const RAID_TYPE_LABELS: Record<string, string> = {
  Action: "Action",
  Risque: "Risque",
  Information: "Information",
  Décision: "Décision",
};

export const RAID_TYPE_COLORS: Record<string, string> = {
  Action: "#2563eb",
  Risque: "#dc2626",
  Information: "#059669",
  Décision: "#7c3aed",
};

// ── Statuts par type ──────────────────────────────────
export const STATUT_ACTION_LIST = [
  "A planifier",
  "Planifié",
  "A lancer",
  "En cours",
  "Stand-By",
  "Clôturé",
  "Abandonné",
  "NA",
  "Doublon",
] as const;

export const STATUT_RISQUE_LIST = [
  "Ouvert",
  "En mitigation",
  "Surveillé",
  "Planifié",
  "Clos",
  "Matérialisé",
] as const;

export const STATUT_INFORMATION_LIST = [
  "Ouvert",
  "Clôturé",
] as const;

export const STATUT_DECISION_LIST = [
  "En attente",
  "Validée",
  "Refusée",
  "Reportée",
] as const;

export const STATUT_ACTION_COLORS: Record<string, string> = {
  "A planifier": "#d4d4d8",
  "Planifié": "#a78bfa",
  "A lancer": "#94a3b8",
  "En cours": "#3b82f6",
  "Stand-By": "#f59e0b",
  "Clôturé": "#22c55e",
  "Abandonné": "#6b7280",
  "NA": "#9ca3af",
  "Doublon": "#9ca3af",
};

export const STATUT_RISQUE_COLORS: Record<string, string> = {
  "Ouvert": "#ef4444",
  "En mitigation": "#f59e0b",
  "Surveillé": "#3b82f6",
  "Planifié": "#8b5cf6",
  "Clos": "#22c55e",
  "Matérialisé": "#dc2626",
};

export const STATUT_INFORMATION_COLORS: Record<string, string> = {
  "Ouvert": "#3b82f6",
  "Clôturé": "#22c55e",
};

export const STATUT_DECISION_COLORS: Record<string, string> = {
  "En attente": "#f59e0b",
  "Validée": "#22c55e",
  "Refusée": "#ef4444",
  "Reportée": "#94a3b8",
};

// Statut ordering for Action (used in table sort)
export const STATUT_ACTION_ORDER: Record<string, number> = Object.fromEntries(
  STATUT_ACTION_LIST.map((s, i) => [s, i])
);

export function getStatutsForType(type: string): readonly string[] {
  switch (type) {
    case "Action": return STATUT_ACTION_LIST;
    case "Risque": return STATUT_RISQUE_LIST;
    case "Information": return STATUT_INFORMATION_LIST;
    case "Décision": return STATUT_DECISION_LIST;
    default: return STATUT_ACTION_LIST;
  }
}

export function getStatutColor(type: string, statut: string): string {
  switch (type) {
    case "Action": return STATUT_ACTION_COLORS[statut] ?? "#6b7280";
    case "Risque": return STATUT_RISQUE_COLORS[statut] ?? "#6b7280";
    case "Information": return STATUT_INFORMATION_COLORS[statut] ?? "#6b7280";
    case "Décision": return STATUT_DECISION_COLORS[statut] ?? "#6b7280";
    default: return "#6b7280";
  }
}

// ── Catégories ────────────────────────────────────────
export const CATEGORIE_LIST = [
  "Budget",
  "Fournisseur",
  "Opérationnel",
  "Planning",
  "Ressources",
  "Stratégique",
  "Technique",
] as const;

// ── Domaines ──────────────────────────────────────────
export const DOMAINE_LIST = [
  "Agence",
  "Monétique",
  "Chèques & LCN",
  "Virements domestiques & prélèvements",
  "Référentiel & TDC",
  "Produits et tarification",
  "Bancassurance",
  "Transferts internationaux & dotations",
  "Engagement",
  "Crédit",
  "Migration",
  "Infrastructure",
  "BSS",
  "Architecture et sécurité",
  "Programme Office",
] as const;

// ── Stratégies (Risque) ──────────────────────────────
export const STRATEGIE_LIST = [
  "Éviter",
  "Transférer",
  "Atténuer",
  "Accepter",
] as const;

// ── Probabilité / Impact ─────────────────────────────
export const PROBABILITE_LABELS: Record<number, string> = {
  1: "Rare",
  2: "Peu probable",
  3: "Possible",
  4: "Probable",
  5: "Quasi-certain",
};

export const IMPACT_LABELS: Record<number, string> = {
  1: "Négligeable",
  2: "Mineur",
  3: "Modéré",
  4: "Majeur",
  5: "Critique",
};

// ── Criticité (score = probabilité × impact) ─────────
export const CRITICITE_LABELS: Record<string, string> = {
  Négligeable: "Négligeable",
  Mineur: "Mineur",
  Modéré: "Modéré",
  Majeur: "Majeur",
  Critique: "Critique",
};

export const CRITICITE_COLORS: Record<string, string> = {
  Négligeable: "#22c55e",
  Mineur: "#84cc16",
  Modéré: "#f59e0b",
  Majeur: "#f97316",
  Critique: "#dc2626",
};

export function getCriticiteLabel(score: number): string {
  if (score <= 3) return "Négligeable";
  if (score <= 6) return "Mineur";
  if (score <= 10) return "Modéré";
  if (score <= 15) return "Majeur";
  return "Critique";
}

// ── Dynamic Status Helpers (from DB StatusConfig) ────

export type StatusConfigItem = {
  id: string;
  type: string;
  label: string;
  color: string;
  position: number;
};

export function getStatutsFromConfig(type: string, configs: StatusConfigItem[]): string[] {
  return configs
    .filter((c) => c.type === type)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.label);
}

export function getStatutColorFromConfig(type: string, statut: string, configs: StatusConfigItem[]): string {
  const found = configs.find((c) => c.type === type && c.label === statut);
  return found?.color ?? getStatutColor(type, statut);
}

export function getStatutOrderFromConfig(type: string, configs: StatusConfigItem[]): Record<string, number> {
  return Object.fromEntries(
    configs.filter((c) => c.type === type).map((c) => [c.label, c.position])
  );
}
