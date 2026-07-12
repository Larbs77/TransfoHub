/**
 * Fallback labels/colors when DB parameters are not loaded (e.g. legacy clients).
 * Canonical catalog lives in ComiteParametre (admin → Paramètres comités).
 */
export const INSTANCE_LABELS: Record<string, string> = {
  "Comité Programme": "Comité Programme",
  "Comité Technologique restreint (CTR)": "CTR",
  "Comité Technologique Plénier (CTP)": "CTP",
  "Comité Assurance Qualité": "Comité Assurance Qualité",
  "Conseil": "Conseil",
  "Design Authority Board": "Design Authority Board",
  "Kick-off": "Kick-off",
};

export const INSTANCE_COLORS: Record<string, string> = {
  "Comité Programme": "#2563eb",
  "Comité Technologique restreint (CTR)": "#059669",
  "Comité Technologique Plénier (CTP)": "#0d9488",
  "Comité Assurance Qualité": "#7c3aed",
  "Conseil": "#dc2626",
  "Design Authority Board": "#ea580c",
  "Kick-off": "#ca8a04",
};

/** Serializable row for UI (selects, tabs, admin). */
export type ComiteParametreOption = {
  id: string;
  name: string;
  description: string;
  frequency: string;
  owner: string;
  equipeId?: string | null;
  short_label: string;
  color: string;
  position: number;
  is_active: boolean;
};

/** Team option for owner selects. */
export type EquipeOption = {
  id: string;
  name: string;
  description?: string;
  position?: number;
  is_active: boolean;
};

export function displayLabelForInstance(
  name: string,
  params?: ComiteParametreOption[] | null
): string {
  const fromDb = params?.find((p) => p.name === name);
  if (fromDb) {
    return fromDb.short_label.trim() || fromDb.name;
  }
  return INSTANCE_LABELS[name] ?? name;
}

export function colorForInstance(
  name: string,
  params?: ComiteParametreOption[] | null
): string {
  const fromDb = params?.find((p) => p.name === name);
  if (fromDb?.color) return fromDb.color;
  return INSTANCE_COLORS[name] ?? "#6b7280";
}

/** Ordered instance names: active params first, then any orphan names from data. */
export function orderedInstanceNames(
  params: ComiteParametreOption[] | null | undefined,
  dataNames: string[]
): string[] {
  const active = (params ?? [])
    .filter((p) => p.is_active)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
    .map((p) => p.name);
  const seen = new Set(active);
  const orphans = [...new Set(dataNames)].filter((n) => !seen.has(n)).sort();
  if (active.length === 0 && orphans.length === 0) {
    return Object.keys(INSTANCE_LABELS);
  }
  return [...active, ...orphans];
}

export const STATUT_COMITE_LABELS: Record<string, string> = {
  "A planifier": "A planifier",
  "Planifié": "Planifié",
  "A confirmer": "A confirmer",
  "Reporté": "Reporté",
};

export const STATUT_COMITE_COLORS: Record<string, string> = {
  "A planifier": "#6b7280",
  "Planifié": "#2563eb",
  "A confirmer": "#ea580c",
  "Reporté": "#dc2626",
};
