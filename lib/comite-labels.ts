import { isComiteNiveauOperationnel } from "@/lib/comite-niveau";

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
  /** gouvernance | operationnel */
  niveau?: string;
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

export type ComiteSeanceRef = {
  id?: string;
  instance: string;
  numero: number;
  date?: Date | string | null;
  chantierId?: string | null;
  chantier?: { id?: string; code?: string; nom?: string } | null;
};

/** JJ/MM/AAAA — date de séance, sans heure. */
export function formatComiteDate(
  raw: Date | string | null | undefined
): string {
  if (raw == null || raw === "") return "";
  if (typeof raw === "string") {
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Libellé séance : `CTR #12 — 17/09/2026`.
 * Avec chantier opérationnel : `Weekly #12 — 17/09/2026 · CH_023`.
 */
export function formatComiteSeanceLabel(
  co: ComiteSeanceRef,
  params?: ComiteParametreOption[] | null,
  opts?: { withChantier?: boolean }
): string {
  const type = displayLabelForInstance(co.instance, params);
  const date = formatComiteDate(co.date);
  const base = date
    ? `${type} #${co.numero} — ${date}`
    : `${type} #${co.numero}`;
  if (!opts?.withChantier) return base;
  const code = co.chantier?.code?.trim();
  return code ? `${base} · ${code}` : base;
}

export function isComiteTypeOperationnel(
  instance: string,
  params?: ComiteParametreOption[] | null,
  seances?: ComiteSeanceRef[]
): boolean {
  const param = params?.find((p) => p.name === instance);
  if (param) return isComiteNiveauOperationnel(param.niveau);
  return !!seances?.some((s) => !!(s.chantierId || s.chantier?.id));
}

export type ComiteChantierGroup = {
  id: string;
  code: string;
  nom: string;
  seances: ComiteSeanceRef[];
};

export type ComiteTypeGroup = {
  instance: string;
  label: string;
  operationnel: boolean;
  seances: ComiteSeanceRef[];
  chantiers: ComiteChantierGroup[];
};

function seanceTime(s: ComiteSeanceRef): number {
  if (s.date == null || s.date === "") return 0;
  const t = (s.date instanceof Date ? s.date : new Date(s.date)).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sortSeances(list: ComiteSeanceRef[]): ComiteSeanceRef[] {
  return [...list].sort((a, b) => {
    const dt = seanceTime(b) - seanceTime(a);
    if (dt !== 0) return dt;
    return b.numero - a.numero;
  });
}

/** Groupes du sélecteur RAID : types présents dans la liste déjà filtrée par droits. */
export function groupComitesForPicker(
  seances: ComiteSeanceRef[],
  params?: ComiteParametreOption[] | null
): ComiteTypeGroup[] {
  const byInstance = new Map<string, ComiteSeanceRef[]>();
  for (const s of seances) {
    const list = byInstance.get(s.instance) ?? [];
    list.push(s);
    byInstance.set(s.instance, list);
  }
  const names = orderedInstanceNames(params, [...byInstance.keys()]);
  const groups: ComiteTypeGroup[] = [];
  for (const instance of names) {
    const raw = byInstance.get(instance);
    if (!raw?.length) continue;
    const list = sortSeances(raw);
    const operationnel = isComiteTypeOperationnel(instance, params, list);
    const chantierMap = new Map<string, ComiteChantierGroup>();
    const sansChantier: ComiteSeanceRef[] = [];
    for (const s of list) {
      const id = (s.chantierId || s.chantier?.id || "").trim();
      if (!operationnel || !id) {
        if (operationnel) sansChantier.push(s);
        continue;
      }
      const existing = chantierMap.get(id);
      if (existing) {
        existing.seances.push(s);
        continue;
      }
      chantierMap.set(id, {
        id,
        code: s.chantier?.code?.trim() || id,
        nom: s.chantier?.nom?.trim() || "",
        seances: [s],
      });
    }
    const chantiers = [...chantierMap.values()].sort((a, b) =>
      a.code.localeCompare(b.code, "fr")
    );
    if (sansChantier.length) {
      chantiers.push({
        id: "__sans_chantier__",
        code: "Sans chantier",
        nom: "",
        seances: sansChantier,
      });
    }
    groups.push({
      instance,
      label: displayLabelForInstance(instance, params),
      operationnel,
      seances: list,
      chantiers,
    });
  }
  return groups;
}

/** Palier chantier seulement s'il y a plusieurs chantiers pour ce type opérationnel. */
export function comiteTypeNeedsChantierPane(group: ComiteTypeGroup): boolean {
  return group.operationnel && group.chantiers.length > 1;
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
