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

export const STATUT_ACTION_DOUBLON = "Doublon";

export function isActionDoublon(statut: string | null | undefined): boolean {
  return (statut ?? "").trim() === STATUT_ACTION_DOUBLON;
}

/** Action still in flight (filtre « Actives » / KPI actives). */
export function isActionActive(statut: string): boolean {
  return statut !== "Clôturé" && statut !== "Abandonné" && statut !== "Doublon";
}

export type RaidVisibilityFilter = "active" | "doublon" | "deleted" | "all";

/** Liste RAID : Actives (défaut) / Doublons / Supprimées / Toutes. */
export function matchesRaidVisibility(
  raid: { deletedAt?: Date | string | null; statut: string },
  visibility: RaidVisibilityFilter
): boolean {
  const deleted = !!raid.deletedAt;
  const doublon = isActionDoublon(raid.statut);
  if (visibility === "all") return true;
  if (visibility === "deleted") return deleted;
  if (visibility === "doublon") return !deleted && doublon;
  return !deleted && !doublon;
}

const RISQUE_LIEN_INTITULE_MAX = 265;

/** Code + intitulé tronqué (265 car.) pour la liste « risque lié ». */
export function formatRisqueLienLabel(
  code: string | null | undefined,
  intitule: string | null | undefined
): string {
  const c = (code ?? "").trim() || "—";
  const t = (intitule ?? "").trim();
  if (!t) return c;
  const libelle =
    t.length > RISQUE_LIEN_INTITULE_MAX
      ? `${t.slice(0, RISQUE_LIEN_INTITULE_MAX)}..`
      : t;
  return `${c} — ${libelle}`;
}

export function risqueAActionsLieesOuvertes(
  actions: Array<{ statut: string }> | null | undefined
): boolean {
  if (!actions?.length) return false;
  return actions.some((a) => !isRaidClosed(a.statut));
}

/**
 * Échéance de pilotage RAID : **actualisée** en priorité, sinon initiale (legacy).
 */
export function raidEffectiveEcheance(
  dateEcheanceActualisee: Date | string | null | undefined,
  dateEcheanceInitiale?: Date | string | null
): Date | null {
  const raw = dateEcheanceActualisee ?? dateEcheanceInitiale;
  if (raw == null || raw === "") return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function endOfDay(d: Date): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    23,
    59,
    59,
    999
  );
}

/**
 * En retard : échéance effective dépassée (fin de journée), statut non terminal.
 */
export function isRaidOverdue(
  statut: string,
  dateEcheanceActualisee: Date | string | null | undefined,
  dateEcheanceInitiale?: Date | string | null,
  now: Date = new Date()
): boolean {
  if (isRaidClosed(statut)) return false;
  const d = raidEffectiveEcheance(dateEcheanceActualisee, dateEcheanceInitiale);
  if (!d) return false;
  return endOfDay(d).getTime() < now.getTime();
}

/**
 * Échéance **initiale** dépassée (engagement d'origine) — hors statuts terminaux.
 * Sert à démarquer les écarts vs la date d'engagement, indépendamment de l'actualisée.
 */
export function isRaidInitialEcheancePast(
  statut: string,
  dateEcheanceInitiale: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (isRaidClosed(statut)) return false;
  if (dateEcheanceInitiale == null || dateEcheanceInitiale === "") return false;
  const d =
    dateEcheanceInitiale instanceof Date
      ? dateEcheanceInitiale
      : new Date(dateEcheanceInitiale);
  if (Number.isNaN(d.getTime())) return false;
  return endOfDay(d).getTime() < now.getTime();
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

/** True when the session resource is the RAID responsable. */
export function isRaidAssignee(
  ressourceId: string | null | undefined,
  responsableRessourceId: string | null | undefined
): boolean {
  return !!(
    ressourceId &&
    responsableRessourceId &&
    ressourceId === responsableRessourceId
  );
}

/**
 * Pure client-side check for full RAID form edit (table « Modifier »).
 * Mirrors canEditRaidForm server rules.
 */
export function canEditRaidFormClient(
  item: {
    chantierId: string | null;
    responsableRessourceId?: string | null;
  },
  ctx: {
    chantierScopeAll: boolean;
    leadershipChantierIds: string[];
    /** Current user's linked resource (assignee check). */
    ressourceId?: string | null;
  }
): boolean {
  if (ctx.chantierScopeAll) return true;
  if (
    ctx.ressourceId &&
    item.responsableRessourceId &&
    item.responsableRessourceId === ctx.ressourceId
  ) {
    return true;
  }
  if (!item.chantierId) return false;
  return ctx.leadershipChantierIds.includes(item.chantierId);
}

/** Pure client-side check for Kanban drag (no Prisma). */
export function canMoveRaidKanbanClient(
  item: {
    responsableRessourceId: string | null;
    chantierId: string | null;
    equipeId?: string | null;
    categorie?: string | null;
  },
  ctx: {
    ressourceId: string | null;
    isProgramme: boolean;
    leadershipChantierIds: string[];
    institutionalEquipeId?: string | null;
    /** Institutional team special category grants. */
    specialCategories?: string[];
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
  // Special institutional access by category
  const cat = (item.categorie ?? "").trim();
  if (
    cat &&
    ctx.specialCategories?.length &&
    ctx.specialCategories.includes(cat)
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

/** Actions still unplanned (or discarded) may exist without a due date. */
export const ACTION_STATUTS_SANS_ECHEANCE = [
  "A planifier",
  "Abandonné",
  "NA",
  "Doublon",
] as const;

export function actionRequiresEcheance(statut: string): boolean {
  return !(ACTION_STATUTS_SANS_ECHEANCE as readonly string[]).includes(statut);
}

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

// ── Catégories / Domaines (fallback if DB catalog empty) ──
// Canonical source of truth is RaidFieldOption (Paramètres). These lists are
// used only as offline/seed fallbacks.
export const CATEGORIE_LIST = [
  "Budget",
  "Fournisseur",
  "Opérationnel",
  "Planning",
  "Ressources",
  "Stratégique",
  "Technique",
] as const;

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

export const RAID_FIELD_KINDS = ["categorie", "domaine"] as const;
export type RaidFieldKind = (typeof RAID_FIELD_KINDS)[number];

export type RaidFieldOptionItem = {
  id: string;
  kind: string;
  label: string;
  color: string;
  position: number;
};

export function getLabelsForKind(
  kind: RaidFieldKind,
  options: RaidFieldOptionItem[] | undefined | null
): string[] {
  if (options?.length) {
    const labels = options
      .filter((o) => o.kind === kind)
      .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "fr"))
      .map((o) => o.label);
    if (labels.length) return labels;
  }
  return kind === "categorie" ? [...CATEGORIE_LIST] : [...DOMAINE_LIST];
}

export function getColorForFieldLabel(
  kind: RaidFieldKind,
  label: string,
  options: RaidFieldOptionItem[] | undefined | null
): string {
  const found = options?.find((o) => o.kind === kind && o.label === label);
  return found?.color ?? "#6b7280";
}

/** Merge catalog labels with values present on rows (legacy free-text). */
export function mergeFieldLabelsWithData(
  catalog: string[],
  values: Array<string | null | undefined>
): string[] {
  const set = new Set(catalog);
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t) set.add(t);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
}

// ── Stratégies (Risque) ──────────────────────────────
export const STRATEGIE_LIST = [
  "Éviter",
  "Transférer",
  "Atténuer",
  "Accepter",
] as const;

// ── Probabilité / Impact (échelle programme 1–3) ─────
/** Probabilité : adjectifs féminins. 1 Faible, 2 Moyenne, 3 Élevée. */
export const PROBABILITE_LABELS: Record<number, string> = {
  1: "Faible",
  2: "Moyenne",
  3: "Élevée",
};

/** Impact : adjectifs masculins. 1 Faible, 2 Moyen, 3 Élevé. */
export const IMPACT_LABELS: Record<number, string> = {
  1: "Faible",
  2: "Moyen",
  3: "Élevé",
};

export const PROBABILITE_SCALE = [1, 2, 3] as const;
export const IMPACT_SCALE = [1, 2, 3] as const;

export const NIVEAU_RISQUE_VALUES = ["Faible", "Modéré", "Élevé"] as const;
export type NiveauRisque = (typeof NIVEAU_RISQUE_VALUES)[number];

/** Axe Y de la matrice dashboard (bas → haut). */
export const NIVEAU_RISQUE_ORDER = ["Faible", "Modéré", "Élevé"] as const;

export const NIVEAU_MAITRISE_VALUES = ["Élevé", "Modéré", "Faible"] as const;
export type NiveauMaitrise = (typeof NIVEAU_MAITRISE_VALUES)[number];

/** Axe X de la matrice dashboard (gauche → droite), comme le cadre programme. */
export const NIVEAU_MAITRISE_ORDER = ["Élevé", "Modéré", "Faible"] as const;

export const CRITICITE_VALUES = [
  "Faible",
  "Modérée",
  "Majeure",
  "Critique",
] as const;
export type CriticiteLabel = (typeof CRITICITE_VALUES)[number];

/**
 * Niveau de risque = Probabilité × Impact (avant traitement).
 * Index [probabilite 1–3][impact 1–3].
 */
const NIVEAU_RISQUE_MATRIX: NiveauRisque[][] = [
  ["Faible", "Faible", "Modéré"],
  ["Faible", "Modéré", "Élevé"],
  ["Modéré", "Élevé", "Élevé"],
];

export function isNiveauMaitrise(value: string | null | undefined): value is NiveauMaitrise {
  return (
    value === "Élevé" || value === "Modéré" || value === "Faible"
  );
}

function isProbabiliteOuImpactSaisi(value: number | null | undefined): boolean {
  return value != null && value >= 1 && value <= 3;
}

/**
 * Probabilité, Impact et maîtrise sont obligatoires à la création et à la
 * modification d'un risque. Retourne un message d'erreur, ou null si OK.
 */
export function raidRisqueSaisieError(data: {
  type?: string | null;
  probabilite?: number | null;
  impact?: number | null;
  niveau_maitrise?: string | null;
}): string | null {
  if (data.type !== "Risque") return null;
  const missing: string[] = [];
  if (!isProbabiliteOuImpactSaisi(data.probabilite)) missing.push("Probabilité");
  if (!isProbabiliteOuImpactSaisi(data.impact)) missing.push("Impact");
  if (!isNiveauMaitrise(data.niveau_maitrise?.trim())) {
    missing.push("Niveau de maîtrise");
  }
  if (!missing.length) return null;
  if (missing.length === 1) {
    return `${missing[0]} est obligatoire pour un risque.`;
  }
  const last = missing.pop();
  return `${missing.join(", ")} et ${last} sont obligatoires pour un risque.`;
}

export function assertRaidRisqueSaisie(data: {
  type?: string | null;
  probabilite?: number | null;
  impact?: number | null;
  niveau_maitrise?: string | null;
}): void {
  const message = raidRisqueSaisieError(data);
  if (message) throw new Error(message);
}

export function getNiveauRisque(
  probabilite: number | null | undefined,
  impact: number | null | undefined
): NiveauRisque | null {
  if (
    probabilite == null ||
    impact == null ||
    probabilite < 1 ||
    probabilite > 3 ||
    impact < 1 ||
    impact > 3
  ) {
    return null;
  }
  return NIVEAU_RISQUE_MATRIX[probabilite - 1][impact - 1];
}

const CRITICITE_MATRIX: Record<
  NiveauRisque,
  Record<NiveauMaitrise, CriticiteLabel>
> = {
  Élevé: { Élevé: "Modérée", Modéré: "Majeure", Faible: "Critique" },
  Modéré: { Élevé: "Modérée", Modéré: "Modérée", Faible: "Majeure" },
  Faible: { Élevé: "Faible", Modéré: "Modérée", Faible: "Modérée" },
};

export function getCriticiteResiduelle(
  niveauRisque: NiveauRisque | null | undefined,
  maitrise: string | null | undefined
): CriticiteLabel | null {
  if (!niveauRisque || !isNiveauMaitrise(maitrise)) return null;
  return CRITICITE_MATRIX[niveauRisque][maitrise];
}

export function evaluateRaidRisque(r: {
  probabilite?: number | null;
  impact?: number | null;
  niveau_maitrise?: string | null;
}): { niveauRisque: NiveauRisque | null; criticite: CriticiteLabel | null } {
  const niveauRisque = getNiveauRisque(r.probabilite, r.impact);
  return {
    niveauRisque,
    criticite: getCriticiteResiduelle(niveauRisque, r.niveau_maitrise),
  };
}

/** Majeure ou Critique — suivi programme / KPI « Risques critiques ». */
export function isRisqueAttention(r: {
  probabilite?: number | null;
  impact?: number | null;
  niveau_maitrise?: string | null;
}): boolean {
  const c = evaluateRaidRisque(r).criticite;
  return c === "Majeure" || c === "Critique";
}

export function isRisqueCritique(r: {
  probabilite?: number | null;
  impact?: number | null;
  niveau_maitrise?: string | null;
}): boolean {
  return evaluateRaidRisque(r).criticite === "Critique";
}

export function criticiteRank(label: CriticiteLabel | null | undefined): number {
  if (!label) return 0;
  const i = CRITICITE_VALUES.indexOf(label);
  return i + 1;
}

/** Libellés français des champs RAID pour le journal d'audit. */
export const RAID_AUDIT_FIELD_LABELS: Record<string, string> = {
  type: "Type",
  intitule: "Intitulé",
  description: "Description",
  categorie: "Catégorie",
  chantierId: "Chantier",
  domaine: "Domaine",
  probabilite: "Probabilité",
  impact: "Impact",
  strategie: "Stratégie",
  mitigation: "Mitigation",
  responsable: "Responsable",
  responsableRessourceId: "Responsable",
  equipeId: "Équipe",
  statut: "Statut",
  date_identification: "Date d'identification",
  date_revision: "Date de révision",
  date_echeance: "Échéance initiale",
  date_echeance_actualisee: "Échéance actualisée",
  date_fin_reelle: "Fin réelle",
  commentaires: "Commentaires",
  comiteId: "Comité",
  comment: "Commentaire",
  niveau_maitrise: "Niveau de maîtrise",
  risqueLieId: "Risque lié",
};

// ── Criticité résiduelle (risque × maîtrise) — couleurs du cadre programme ─
export const CRITICITE_LABELS: Record<string, string> = {
  Faible: "Faible",
  Modérée: "Modérée",
  Majeure: "Majeure",
  Critique: "Critique",
};

export const CRITICITE_COLORS: Record<string, string> = {
  Faible: "#B3E5FC",
  Modérée: "#FFE0B2",
  Majeure: "#F8BBD0",
  Critique: "#EF9A9A",
};

/** Texte sur pastels du cadre (pas de blanc). */
export const CRITICITE_FG = "#1e293b";

export function getCriticiteLabel(
  probabilite: number | null | undefined,
  impact: number | null | undefined,
  maitrise?: string | null
): CriticiteLabel | null {
  return evaluateRaidRisque({
    probabilite,
    impact,
    niveau_maitrise: maitrise,
  }).criticite;
}

export function emptyRisqueMaitriseMatrix(): number[][] {
  return Array.from({ length: 3 }, () => Array(3).fill(0));
}

export function incrementRisqueMaitriseMatrix(
  matrix: number[][],
  niveauRisque: NiveauRisque,
  maitrise: NiveauMaitrise
) {
  const ri = NIVEAU_RISQUE_ORDER.indexOf(niveauRisque);
  const ci = NIVEAU_MAITRISE_ORDER.indexOf(maitrise);
  if (ri >= 0 && ci >= 0) matrix[ri][ci]++;
}

export function cellCriticite(
  risqueIndex: number,
  maitriseIndex: number
): CriticiteLabel {
  const risque = NIVEAU_RISQUE_ORDER[risqueIndex];
  const maitrise = NIVEAU_MAITRISE_ORDER[maitriseIndex];
  return CRITICITE_MATRIX[risque][maitrise];
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
