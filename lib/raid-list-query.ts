/** Query string for RAID list filters — back-navigation and shareable URLs. */

export type RaidListView = "table" | "kanban" | "calendrier" | "calendrier-type";
export type RaidListDeleted = "active" | "doublon" | "deleted" | "all";
export type RaidListScope = "mine" | "all";

export type RaidListQuery = {
  q: string;
  cat: string[];
  dom: string[];
  prob: string[];
  impact: string[];
  risque: string[];
  maitrise: string[];
  statut: string[];
  chantier: string[];
  comite: string[];
  overdue: boolean;
  critical: boolean;
  deleted: RaidListDeleted;
  page: number;
  size: number;
  sort: string;
  dir: "asc" | "desc";
  scope: RaidListScope;
  view: RaidListView;
  ttype: string;
};

const SORT_FIELDS = new Set([
  "intitule",
  "statut",
  "categorie",
  "responsable",
  "date_identification",
  "date_echeance",
  "criticite",
]);

function csv(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key);
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function setCsv(p: URLSearchParams, key: string, values: string[]) {
  if (!values.length) p.delete(key);
  else p.set(key, values.join(","));
}

function encodeStatut(values: string[]): string[] {
  return values.map((s) =>
    s === "__active__" ? "active" : s === "__open__" ? "open" : s
  );
}

function decodeStatut(values: string[]): string[] {
  return values.map((s) =>
    s === "active" ? "__active__" : s === "open" ? "__open__" : s
  );
}

export function parseRaidListQuery(sp: URLSearchParams): RaidListQuery {
  const sizeRaw = sp.get("size");
  const size =
    sizeRaw === "all" || sizeRaw === "0"
      ? 0
      : Math.max(0, Number(sizeRaw) || 10);
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const sort = sp.get("sort") ?? "";
  const dir = sp.get("dir") === "desc" ? "desc" : "asc";
  const deletedRaw = sp.get("deleted");
  const deleted: RaidListDeleted =
    deletedRaw === "deleted" ||
    deletedRaw === "all" ||
    deletedRaw === "doublon"
      ? deletedRaw
      : "active";
  const viewRaw = sp.get("view");
  const view: RaidListView =
    viewRaw === "kanban" ||
    viewRaw === "calendrier" ||
    viewRaw === "calendrier-type"
      ? viewRaw
      : "table";
  const scope: RaidListScope = sp.get("scope") === "all" ? "all" : "mine";

  return {
    q: sp.get("q") ?? "",
    cat: csv(sp, "cat"),
    dom: csv(sp, "dom"),
    prob: csv(sp, "prob"),
    impact: csv(sp, "impact"),
    risque: csv(sp, "risque"),
    maitrise: csv(sp, "maitrise"),
    statut: decodeStatut(csv(sp, "statut")),
    chantier: csv(sp, "chantier"),
    comite: csv(sp, "comite"),
    overdue: sp.get("overdue") === "true",
    critical: sp.get("critical") === "true",
    deleted,
    page,
    size,
    sort: SORT_FIELDS.has(sort) ? sort : "",
    dir,
    scope,
    view,
    ttype: sp.get("ttype") ?? "",
  };
}

export function serializeRaidListQuery(q: Partial<RaidListQuery>): string {
  const p = new URLSearchParams();
  if (q.q?.trim()) p.set("q", q.q.trim());
  setCsv(p, "cat", q.cat ?? []);
  setCsv(p, "dom", q.dom ?? []);
  setCsv(p, "prob", q.prob ?? []);
  setCsv(p, "impact", q.impact ?? []);
  setCsv(p, "risque", q.risque ?? []);
  setCsv(p, "maitrise", q.maitrise ?? []);
  setCsv(p, "statut", encodeStatut(q.statut ?? []));
  setCsv(p, "chantier", q.chantier ?? []);
  setCsv(p, "comite", q.comite ?? []);
  if (q.overdue) p.set("overdue", "true");
  if (q.critical) p.set("critical", "true");
  if (q.deleted && q.deleted !== "active") p.set("deleted", q.deleted);
  if (q.page && q.page > 1) p.set("page", String(q.page));
  if (q.size === 0) p.set("size", "all");
  else if (q.size && q.size !== 10) p.set("size", String(q.size));
  if (q.sort) p.set("sort", q.sort);
  if (q.sort && q.dir === "desc") p.set("dir", "desc");
  if (q.scope === "all") p.set("scope", "all");
  if (q.view && q.view !== "table") p.set("view", q.view);
  if (q.ttype) p.set("ttype", q.ttype);
  return p.toString();
}

export function isRaidRegisterPath(pathname: string): boolean {
  return (
    pathname === "/raid" ||
    pathname === "/raid/risques" ||
    pathname === "/raid/actions" ||
    pathname === "/raid/informations" ||
    pathname === "/raid/decisions"
  );
}

export const RAID_LIST_RETURN_KEY = "th:raidListUrl";

export function raidListPathForType(type: string): string {
  if (type === "Risque") return "/raid/risques";
  if (type === "Action") return "/raid/actions";
  if (type === "Information") return "/raid/informations";
  if (type === "Décision") return "/raid/decisions";
  return "/raid";
}

export function readRaidListReturnUrl(fallbackType?: string): string {
  try {
    const saved = sessionStorage.getItem(RAID_LIST_RETURN_KEY);
    if (
      saved &&
      saved.startsWith("/raid") &&
      !/^\/raid\/[0-9a-f-]{8,}/i.test(saved)
    ) {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return raidListPathForType(fallbackType ?? "");
}
