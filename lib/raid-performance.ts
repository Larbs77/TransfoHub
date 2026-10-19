import {
  formatRaidCalendarDate,
  isRaidClosed,
  raidCalendarDay,
} from "@/lib/raid-labels";

/**
 * Performance des actions RAID (équipe fonctionnelle = chantier propriétaire).
 *
 * Population : Action, non supprimée, hors Doublon et NA.
 * Tenue : échéance initiale dans la fenêtre, Clôturé avec fin ≤ cette échéance.
 *   Une action encore ouverte dont le jour d'échéance n'est pas terminé n'entre pas.
 *   Abandonné = non tenu, compté à part.
 * Prise en charge : premier statut hors « A planifier », « Planifié », « A lancer ».
 * Cycle : cette prise en charge → date de fin, pour les Clôturé de la fenêtre.
 *   Sans trace dans le journal, la médiane ignore la fiche (jamais 0 jour).
 * Stock échu : ouvertes datées, en retard à la date de fin.
 *   Fenêtre qui se termine aujourd'hui : même instant que le registre.
 *   Fenêtre passée : fin de journée déjà écoulée.
 * Glissement : échéance actualisée postérieure à l'initiale, parmi les dues.
 *   L'écran l'intitule « Échéances reportées ». C'est une photographie actuelle.
 * Affichage : l'écart de stock échu et l'écart d'échéances reportées avec la
 *   période précédente ne sont pas montrés. Le calcul de ces deux valeurs reste.
 */

export const RAID_PERF_NONE = "__none__";
export const RAID_PERF_MIN_DUE = 5;

export type PerfGroupSortKey =
  | "label"
  | "due"
  | "tenue"
  | "prise"
  | "cycle"
  | "stock"
  | "glide"
  | "abandon";

/**
 * Le stock échu et les échéances reportées gardent leur valeur courante.
 * Leur variation avec la période précédente n'est pas affichée : les dates
 * actualisées d'aujourd'hui ne reconstituent pas la période passée.
 */
export function perfCardHistory(
  key: "tenue" | "prise" | "cycle" | "stock" | "glide"
): "delta" | "unavailable" {
  return key === "stock" || key === "glide" ? "unavailable" : "delta";
}

function perfGroupSortValue(
  row: PerfGroup,
  key: PerfGroupSortKey
): number | string | null {
  switch (key) {
    case "label":
      return row.label;
    case "due":
      return row.due;
    case "tenue":
      return row.tenuePct;
    case "prise":
      return row.priseMedian;
    case "cycle":
      return row.cycleMedian;
    case "stock":
      return row.stockPct;
    case "glide":
      return row.glidePct;
    case "abandon":
      return row.abandon;
  }
}

/** « Non rattaché » reste dernier, quel que soit le sens ou la colonne. */
export function orderPerfGroups(
  rows: PerfGroup[],
  sort: { key: PerfGroupSortKey; dir: "asc" | "desc" } | null
): PerfGroup[] {
  if (!sort) return rows;
  const copy = [...rows];
  copy.sort((a, b) => {
    if (a.id === RAID_PERF_NONE && b.id !== RAID_PERF_NONE) return 1;
    if (b.id === RAID_PERF_NONE && a.id !== RAID_PERF_NONE) return -1;
    const av = perfGroupSortValue(a, sort.key);
    const bv = perfGroupSortValue(b, sort.key);
    if (av == null && bv == null) return a.label.localeCompare(b.label, "fr");
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp = 0;
    if (typeof av === "string" && typeof bv === "string") {
      cmp = av.localeCompare(bv, "fr");
    } else {
      cmp = Number(av) - Number(bv);
    }
    if (cmp === 0) return a.label.localeCompare(b.label, "fr");
    return sort.dir === "asc" ? cmp : -cmp;
  });
  return copy;
}

const WAITING = new Set(["A planifier", "Planifié", "A lancer"]);
const EXCLUDED = new Set(["Doublon", "NA"]);

export type PerfPreset = "30" | "90" | "quarter" | "365" | "custom";

/** Point de départ de la médiane de prise en charge. Le défaut reste la création. */
export type MedianOrigin = "creation" | "identification";

export function parseMedianOrigin(raw?: string): MedianOrigin {
  return raw === "identification" ? "identification" : "creation";
}

export function withMedianOrigin(search: string, origin: MedianOrigin): string {
  if (origin !== "identification") return search;
  return search ? `${search}&origine=identification` : "origine=identification";
}

/** Départ du cycle. Le défaut reste la sortie de salle d'attente. */
export type CycleStart = "prise" | "identification";

export function parseCycleStart(raw?: string): CycleStart {
  return raw === "identification" ? "identification" : "prise";
}

export function withCycleStart(search: string, start: CycleStart): string {
  if (start !== "identification") return search;
  return search ? `${search}&cycle=identification` : "cycle=identification";
}

export function withPerfSearch(
  search: string,
  origin: MedianOrigin,
  cycleStart: CycleStart
): string {
  return withCycleStart(withMedianOrigin(search, origin), cycleStart);
}

export type PerfWindow = {
  preset: PerfPreset;
  startDay: string;
  endDay: string;
  prevStartDay: string;
  prevEndDay: string;
  label: string;
  compareLabel: string;
  /** La date de fin est le jour UTC de `now` : le stock suit l'horloge du registre. */
  liveStock: boolean;
  search: string;
};

export type PerfInput = {
  id: string;
  code: string;
  intitule: string;
  chantierId: string | null;
  teamLabel: string;
  teamCode: string;
  responsableId: string;
  responsable: string;
  statut: string;
  createdDay: string;
  identificationDay: string | null;
  initiale: string | null;
  actualisee: string | null;
  closeDay: string | null;
  priseDay: string | null;
  lastMoveDay: string | null;
};

export type RawPerfRaid = {
  id: string;
  code: string;
  intitule: string;
  chantierId: string | null;
  teamLabel: string;
  teamCode: string;
  responsableId: string | null;
  responsable: string;
  statut: string;
  createdAt: Date | string;
  dateIdentification?: Date | string | null;
  initiale: Date | string | null;
  actualisee: Date | string | null;
  dateFinReelle: Date | string | null;
};

export type RawPerfLog = {
  raidId: string;
  newValue: string;
  createdAt: Date | string;
};

export type PerfStats = {
  due: number;
  held: number;
  tenuePct: number | null;
  abandon: number;
  missed: number;
  unmeasured: number;
  glide: number;
  glidePct: number | null;
  priseMedian: number | null;
  priseN: number;
  /** Mode identification : sorties sans date d'identification, hors médiane. */
  priseExcludedMissing: number;
  /** Mode identification : identification postérieure à la prise en charge. */
  priseExcludedInverted: number;
  cycleMedian: number | null;
  cycleP90: number | null;
  cycleN: number;
  /** Clôtures de la période sans le départ retenu (prise ou identification). */
  cycleExcludedNoStart: number;
  /** Mode identification : identification postérieure à la clôture. */
  cycleExcludedInverted: number;
  blindPrise: number;
  blindClose: number;
  stockOpen: number;
  stockOverdue: number;
  stockPct: number | null;
};

export type Tone = "good" | "bad" | "mid" | "muted";

export type PerfTones = {
  tenue: Tone;
  prise: Tone;
  cycle: Tone;
  stock: Tone;
  glide: Tone;
};

export type PerfGroup = PerfStats & {
  id: string;
  label: string;
  code: string;
  tones: PerfTones;
};

export type PerfTrendPoint = {
  label: string;
  opened: number;
  closedOnTime: number;
  tenue: number | null;
  benchmark: number | null;
};

export type PerfActionFlag =
  | "due"
  | "held"
  | "missed"
  | "abandon"
  | "unmeasured"
  | "stock";

export type PerfActionRow = {
  id: string;
  code: string;
  intitule: string;
  responsable: string;
  statut: string;
  initiale: string | null;
  actualisee: string | null;
  closeDay: string | null;
  delayDays: number | null;
  ageDays: number;
  lastMoveDay: string | null;
  flags: PerfActionFlag[];
};

export type PerfScreen = {
  basePath: string;
  backHref: string;
  backLabel: string;
  heading: string;
  kicker: string;
};

export type PerfColorMedian = {
  tenue: number | null;
  prise: number | null;
  cycle: number | null;
  stock: number | null;
  glide: number | null;
};

export type PerfEvidenceRow = {
  id: string;
  code: string;
  intitule: string;
  teamLabel: string;
  responsable: string;
  statut: string;
  dates: { label: string; value: string }[];
  calcul: string;
};

export type PerfCardKey = "tenue" | "prise" | "cycle" | "stock" | "glide";

export type PerfEvidence = Record<PerfCardKey, PerfEvidenceRow[]>;

export type PriseOriginSnapshot = {
  median: number | null;
  n: number;
  excludedMissing: number;
  excludedInverted: number;
};

export type CycleStartSnapshot = {
  median: number | null;
  p90: number | null;
  n: number;
  excludedNoStart: number;
  excludedInverted: number;
};

export type RaidPerformancePayload = {
  window: PerfWindow;
  medianOrigin: MedianOrigin;
  /** Les deux origines, sur la même population que les cartes. */
  priseOrigins: Record<MedianOrigin, PriseOriginSnapshot>;
  cycleStart: CycleStart;
  /** Les deux départs du cycle, sur la même population que les cartes. */
  cycleStarts: Record<CycleStart, CycleStartSnapshot>;
  evidence: PerfEvidence;
  programme: PerfStats;
  previous: PerfStats;
  /** Médianes des équipes d'au moins 5 dues : base du vert, du rouge et du neutre. */
  colorMedian: PerfColorMedian;
  teams: PerfGroup[];
  trend: PerfTrendPoint[];
  trendMode: "programme" | "equipe";
  screen: PerfScreen;
  detail: null | {
    team: PerfGroup;
    previous: PerfStats;
    responsables: PerfGroup[];
    actions: PerfActionRow[];
  };
};

export function canSeeRaidPerformance(role: string): boolean {
  return role === "Admin" || role === "Programme_Office";
}

export function daySpan(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function inRange(day: string | null, start: string, end: string): boolean {
  return !!day && day >= start && day <= end;
}

function isRealDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === value;
}

function showDay(day: string): string {
  return formatRaidCalendarDate(`${day}T00:00:00.000Z`);
}

function emptyStats(): PerfStats {
  return {
    due: 0,
    held: 0,
    tenuePct: null,
    abandon: 0,
    missed: 0,
    unmeasured: 0,
    glide: 0,
    glidePct: null,
    priseMedian: null,
    priseN: 0,
    priseExcludedMissing: 0,
    priseExcludedInverted: 0,
    cycleMedian: null,
    cycleP90: null,
    cycleN: 0,
    cycleExcludedNoStart: 0,
    cycleExcludedInverted: 0,
    blindPrise: 0,
    blindClose: 0,
    stockOpen: 0,
    stockOverdue: 0,
    stockPct: null,
  };
}

function percent(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 100);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function p90(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.9) - 1)
  );
  return sorted[idx];
}

function endOfDayMs(day: string): number {
  return Date.parse(`${day}T23:59:59.999Z`);
}

/** Instant « la journée de fin est-elle écoulée ? ». */
function asOfInstant(endDay: string, live: boolean, now: Date): number {
  if (live) return now.getTime();
  return endOfDayMs(endDay) + 1;
}

function effectiveDay(action: PerfInput): string | null {
  return action.actualisee ?? action.initiale;
}

function isOpenAt(action: PerfInput, endDay: string, live: boolean): boolean {
  if (action.createdDay > endDay) return false;
  if (live) return !isRaidClosed(action.statut);
  if (isRaidClosed(action.statut) && !action.closeDay) return false;
  if (action.closeDay && action.closeDay <= endDay) return false;
  return true;
}

type DueClass = {
  held: boolean;
  abandon: boolean;
  missed: boolean;
  unmeasured: boolean;
};

/** null = pas encore dans la population de tenue. */
function classifyDue(
  action: PerfInput,
  start: string,
  end: string,
  asOfMs: number
): DueClass | null {
  if (!action.initiale || !inRange(action.initiale, start, end)) return null;
  const open = !isRaidClosed(action.statut);
  const dueDayFinished = endOfDayMs(action.initiale) < asOfMs;
  if (open && !dueDayFinished) return null;
  const unmeasured = action.statut === "Clôturé" && !action.closeDay;
  const held =
    action.statut === "Clôturé" &&
    !!action.closeDay &&
    action.closeDay <= action.initiale;
  const abandon = action.statut === "Abandonné";
  const missed = !held && !abandon && !unmeasured;
  return { held, abandon, missed, unmeasured };
}

function measurePrise(
  action: PerfInput,
  start: string,
  end: string,
  origin: MedianOrigin
): { days: number } | "out" | "missing" | "inverted" {
  if (!action.priseDay || !inRange(action.priseDay, start, end)) return "out";
  const originDay = origin === "creation" ? action.createdDay : action.identificationDay;
  if (!originDay) return "missing";
  if (origin === "identification" && originDay > action.priseDay) return "inverted";
  return { days: Math.max(0, daySpan(originDay, action.priseDay)) };
}

function priseSnapshot(
  actions: PerfInput[],
  start: string,
  end: string,
  origin: MedianOrigin
): PriseOriginSnapshot {
  const delays: number[] = [];
  let excludedMissing = 0;
  let excludedInverted = 0;
  for (const action of actions) {
    if (EXCLUDED.has(action.statut)) continue;
    const measured = measurePrise(action, start, end, origin);
    if (measured === "missing") excludedMissing += 1;
    else if (measured === "inverted") excludedInverted += 1;
    else if (measured !== "out") delays.push(measured.days);
  }
  return {
    median: median(delays),
    n: delays.length,
    excludedMissing,
    excludedInverted,
  };
}

function measureCycle(
  action: PerfInput,
  start: string,
  end: string,
  cycleStart: CycleStart
): { days: number } | "out" | "missing" | "inverted" {
  if (action.statut !== "Clôturé" || !action.closeDay || !inRange(action.closeDay, start, end)) {
    return "out";
  }
  if (cycleStart === "prise") {
    if (!action.priseDay) return "missing";
    return { days: Math.max(0, daySpan(action.priseDay, action.closeDay)) };
  }
  if (!action.identificationDay) return "missing";
  if (action.identificationDay > action.closeDay) return "inverted";
  return { days: daySpan(action.identificationDay, action.closeDay) };
}

function cycleSnapshot(
  actions: PerfInput[],
  start: string,
  end: string,
  cycleStart: CycleStart
): CycleStartSnapshot {
  const delays: number[] = [];
  let excludedNoStart = 0;
  let excludedInverted = 0;
  for (const action of actions) {
    if (EXCLUDED.has(action.statut)) continue;
    const measured = measureCycle(action, start, end, cycleStart);
    if (measured === "missing") excludedNoStart += 1;
    else if (measured === "inverted") excludedInverted += 1;
    else if (measured !== "out") delays.push(measured.days);
  }
  return {
    median: median(delays),
    p90: p90(delays),
    n: delays.length,
    excludedNoStart,
    excludedInverted,
  };
}

function statsOf(
  actions: PerfInput[],
  start: string,
  end: string,
  asOfMs: number,
  live: boolean,
  origin: MedianOrigin,
  cycleStart: CycleStart = "prise"
): PerfStats {
  const stats = emptyStats();
  const priseDelays: number[] = [];
  const cycleDelays: number[] = [];

  for (const action of actions) {
    if (EXCLUDED.has(action.statut)) continue;
    const due = classifyDue(action, start, end, asOfMs);
    if (due) {
      stats.due += 1;
      if (due.held) stats.held += 1;
      else if (due.abandon) stats.abandon += 1;
      else if (due.unmeasured) stats.unmeasured += 1;
      else stats.missed += 1;
      if (
        action.actualisee &&
        action.initiale &&
        action.actualisee > action.initiale
      ) {
        stats.glide += 1;
      }
      if (due.unmeasured) stats.blindClose += 1;
    }

    const measuredPrise = measurePrise(action, start, end, origin);
    if (measuredPrise === "missing") stats.priseExcludedMissing += 1;
    else if (measuredPrise === "inverted") stats.priseExcludedInverted += 1;
    else if (measuredPrise !== "out") priseDelays.push(measuredPrise.days);
    const measuredCycle = measureCycle(action, start, end, cycleStart);
    if (measuredCycle === "missing") stats.cycleExcludedNoStart += 1;
    else if (measuredCycle === "inverted") stats.cycleExcludedInverted += 1;
    else if (measuredCycle !== "out") cycleDelays.push(measuredCycle.days);

    const seen =
      inRange(action.createdDay, start, end) ||
      inRange(action.initiale, start, end) ||
      inRange(action.closeDay, start, end);
    if (seen && !WAITING.has(action.statut) && !action.priseDay) {
      stats.blindPrise += 1;
    }

    if (isOpenAt(action, end, live)) {
      const eff = effectiveDay(action);
      if (eff) {
        stats.stockOpen += 1;
        if (endOfDayMs(eff) < asOfMs) stats.stockOverdue += 1;
      }
    }
  }

  stats.tenuePct = percent(stats.held, stats.due);
  stats.glidePct = percent(stats.glide, stats.due);
  stats.priseMedian = median(priseDelays);
  stats.priseN = priseDelays.length;
  stats.cycleMedian = median(cycleDelays);
  stats.cycleP90 = p90(cycleDelays);
  stats.cycleN = cycleDelays.length;
  stats.stockPct = percent(stats.stockOverdue, stats.stockOpen);
  return stats;
}

function tone(
  value: number | null,
  mid: number | null,
  colorable: boolean,
  lowerBetter: boolean
): Tone {
  if (!colorable || value == null) return "muted";
  if (mid == null || value === mid) return "mid";
  const better = lowerBetter ? value < mid : value > mid;
  return better ? "good" : "bad";
}

function tonesFor(
  stats: PerfStats,
  medians: {
    tenue: number | null;
    prise: number | null;
    cycle: number | null;
    stock: number | null;
    glide: number | null;
  }
): PerfTones {
  const colorable = stats.due >= RAID_PERF_MIN_DUE;
  return {
    tenue: tone(stats.tenuePct, medians.tenue, colorable, false),
    prise: tone(stats.priseMedian, medians.prise, colorable, true),
    cycle: tone(stats.cycleMedian, medians.cycle, colorable, true),
    stock: tone(stats.stockPct, medians.stock, colorable, true),
    glide: tone(stats.glidePct, medians.glide, colorable, true),
  };
}

const MUTED: PerfTones = {
  tenue: "muted",
  prise: "muted",
  cycle: "muted",
  stock: "muted",
  glide: "muted",
};

function utcMonday(day: string): string {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  return addDays(day, delta);
}

function monthEnd(day: string): string {
  const [y, m] = day.split("-").map(Number);
  const next =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
}

function buckets(
  start: string,
  end: string
): { start: string; end: string; label: string }[] {
  const span = daySpan(start, end) + 1;
  const out: { start: string; end: string; label: string }[] = [];
  if (span > 120) {
    let cursor = `${start.slice(0, 7)}-01`;
    while (cursor <= end) {
      const bucketEnd = monthEnd(cursor);
      const from = cursor < start ? start : cursor;
      const to = bucketEnd > end ? end : bucketEnd;
      if (from <= to) {
        out.push({ start: from, end: to, label: `${from.slice(5, 7)}/${from.slice(0, 4)}` });
      }
      cursor = addDays(bucketEnd, 1);
    }
    return out;
  }
  let monday = utcMonday(start);
  while (monday <= end) {
    const from = monday < start ? start : monday;
    const weekEnd = addDays(monday, 6);
    const to = weekEnd > end ? end : weekEnd;
    if (from <= to) {
      out.push({
        start: from,
        end: to,
        label: showDay(from).slice(0, 5),
      });
    }
    monday = addDays(monday, 7);
  }
  return out;
}

function tenuePctOf(
  actions: PerfInput[],
  start: string,
  end: string,
  asOfMs: number
): number | null {
  let due = 0;
  let held = 0;
  for (const action of actions) {
    const row = classifyDue(action, start, end, asOfMs);
    if (!row) continue;
    due += 1;
    if (row.held) held += 1;
  }
  return percent(held, due);
}

function buildTrend(
  primary: PerfInput[],
  benchmark: PerfInput[] | null,
  start: string,
  end: string,
  asOfMs: number
): PerfTrendPoint[] {
  return buckets(start, end).map((bucket) => {
    let opened = 0;
    let closedOnTime = 0;
    for (const action of primary) {
      if (EXCLUDED.has(action.statut)) continue;
      if (inRange(action.createdDay, bucket.start, bucket.end)) opened += 1;
      if (
        action.statut === "Clôturé" &&
        action.closeDay &&
        action.initiale &&
        inRange(action.closeDay, bucket.start, bucket.end) &&
        action.closeDay <= action.initiale
      ) {
        closedOnTime += 1;
      }
    }
    return {
      label: bucket.label,
      opened,
      closedOnTime,
      tenue: tenuePctOf(primary, bucket.start, bucket.end, asOfMs),
      benchmark: benchmark
        ? tenuePctOf(benchmark, bucket.start, bucket.end, asOfMs)
        : null,
    };
  });
}

function groupActions(actions: PerfInput[]): Map<string, PerfInput[]> {
  const map = new Map<string, PerfInput[]>();
  for (const action of actions) {
    if (EXCLUDED.has(action.statut)) continue;
    const id = action.chantierId ?? RAID_PERF_NONE;
    const list = map.get(id);
    if (list) list.push(action);
    else map.set(id, [action]);
  }
  return map;
}

function hasSignal(stats: PerfStats): boolean {
  return (
    stats.due > 0 ||
    stats.stockOpen > 0 ||
    stats.priseN > 0 ||
    stats.cycleN > 0
  );
}

function toActionRows(
  actions: PerfInput[],
  start: string,
  end: string,
  endDay: string,
  asOfMs: number,
  live: boolean
): PerfActionRow[] {
  const rows: PerfActionRow[] = [];
  for (const action of actions) {
    if (EXCLUDED.has(action.statut)) continue;
    const due = classifyDue(action, start, end, asOfMs);
    const eff = effectiveDay(action);
    const stock =
      isOpenAt(action, endDay, live) &&
      !!eff &&
      endOfDayMs(eff) < asOfMs;
    if (!due && !stock) continue;
    const flags: PerfActionFlag[] = [];
    if (due) flags.push("due");
    if (due?.held) flags.push("held");
    if (due?.missed) flags.push("missed");
    if (due?.abandon) flags.push("abandon");
    if (due?.unmeasured) flags.push("unmeasured");
    if (stock) flags.push("stock");

    let delayDays: number | null = null;
    if (
      action.statut === "Clôturé" &&
      action.closeDay &&
      action.initiale &&
      action.closeDay > action.initiale
    ) {
      delayDays = daySpan(action.initiale, action.closeDay);
    } else if (stock && eff) {
      delayDays = Math.max(1, daySpan(eff, endDay));
    }
    const ageEnd =
      action.closeDay && action.closeDay <= endDay ? action.closeDay : endDay;
    rows.push({
      id: action.id,
      code: action.code,
      intitule: action.intitule,
      responsable: action.responsable,
      statut: action.statut,
      initiale: action.initiale,
      actualisee: action.actualisee,
      closeDay: action.closeDay,
      delayDays,
      ageDays: Math.max(0, daySpan(action.createdDay, ageEnd)),
      lastMoveDay: action.lastMoveDay,
      flags,
    });
  }
  rows.sort((a, b) => {
    const ad = a.delayDays ?? -1;
    const bd = b.delayDays ?? -1;
    if (bd !== ad) return bd - ad;
    return a.code.localeCompare(b.code, "fr");
  });
  return rows;
}

function windowBetween(
  start: string,
  end: string,
  preset: PerfPreset,
  today: string
): PerfWindow {
  let from = start;
  let to = end > today ? today : end;
  if (from > to) {
    to = today;
    from = addDays(today, -89);
    preset = "90";
  }
  const inclusive = daySpan(from, to) + 1;
  const prevEnd = addDays(from, -1);
  const prevStart = addDays(prevEnd, -(inclusive - 1));
  const search =
    preset === "custom"
      ? `preset=custom&from=${from}&to=${to}`
      : `preset=${preset}`;
  return {
    preset,
    startDay: from,
    endDay: to,
    prevStartDay: prevStart,
    prevEndDay: prevEnd,
    label: `${showDay(from)} – ${showDay(to)}`,
    compareLabel: `${showDay(prevStart)} – ${showDay(prevEnd)}`,
    liveStock: to === today,
    search,
  };
}

export function resolvePerfWindow(
  now: Date,
  presetRaw?: string,
  from?: string,
  to?: string
): PerfWindow {
  const today = raidCalendarDay(now) ?? new Date().toISOString().slice(0, 10);
  const preset = presetRaw ?? "90";
  if (preset === "30") return windowBetween(addDays(today, -29), today, "30", today);
  if (preset === "365") {
    return windowBetween(addDays(today, -364), today, "365", today);
  }
  if (preset === "quarter") {
    const [y, m] = today.split("-").map(Number);
    const qMonth = Math.floor((m - 1) / 3) * 3 + 1;
    const start = `${y}-${String(qMonth).padStart(2, "0")}-01`;
    return windowBetween(start, today, "quarter", today);
  }
  if (preset === "custom" && isRealDay(from) && isRealDay(to) && from <= to) {
    return windowBetween(from, to, "custom", today);
  }
  return windowBetween(addDays(today, -89), today, "90", today);
}

export function toPerfInputs(
  rows: RawPerfRaid[],
  logs: RawPerfLog[]
): PerfInput[] {
  const byRaid = new Map<string, RawPerfLog[]>();
  for (const log of logs) {
    if (!log.raidId) continue;
    const list = byRaid.get(log.raidId);
    if (list) list.push(log);
    else byRaid.set(log.raidId, [log]);
  }
  const prise = new Map<string, string>();
  const close = new Map<string, string>();
  for (const [id, list] of byRaid) {
    list.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    for (const log of list) {
      const next = log.newValue.trim();
      const day = raidCalendarDay(log.createdAt);
      if (!day || !next) continue;
      if (!prise.has(id) && !WAITING.has(next)) prise.set(id, day);
      if (next === "Clôturé") close.set(id, day);
    }
  }

  const out: PerfInput[] = [];
  for (const row of rows) {
    const statut = row.statut.trim();
    if (EXCLUDED.has(statut)) continue;
    const createdDay = raidCalendarDay(row.createdAt);
    if (!createdDay) continue;
    const fin = raidCalendarDay(row.dateFinReelle);
    const closeDay = fin ?? (statut === "Clôturé" ? close.get(row.id) ?? null : null);
    out.push({
      id: row.id,
      code: row.code,
      intitule: row.intitule,
      chantierId: row.chantierId,
      teamLabel: row.teamLabel,
      teamCode: row.teamCode,
      responsableId:
        row.responsableId || `name:${row.responsable.trim() || "none"}`,
      responsable: row.responsable.trim() || "Non assigné",
      statut,
      createdDay,
      identificationDay: raidCalendarDay(row.dateIdentification),
      initiale: raidCalendarDay(row.initiale),
      actualisee: raidCalendarDay(row.actualisee),
      closeDay,
      priseDay: prise.get(row.id) ?? null,
      lastMoveDay: null,
    });
  }
  return out;
}

function evidenceRow(
  action: PerfInput,
  dates: { label: string; value: string }[],
  calcul: string
): PerfEvidenceRow {
  return {
    id: action.id,
    code: action.code,
    intitule: action.intitule,
    teamLabel: action.teamLabel,
    responsable: action.responsable,
    statut: action.statut,
    dates,
    calcul,
  };
}

function dayLabel(day: string | null): string {
  return day ? showDay(day) : "—";
}

function buildEvidence(
  actions: PerfInput[],
  start: string,
  end: string,
  asOfMs: number,
  live: boolean,
  origin: MedianOrigin,
  cycleStart: CycleStart = "prise"
): PerfEvidence {
  const tenue: PerfEvidenceRow[] = [];
  const prise: PerfEvidenceRow[] = [];
  const cycle: PerfEvidenceRow[] = [];
  const stock: PerfEvidenceRow[] = [];
  const glide: PerfEvidenceRow[] = [];
  for (const action of actions) {
    if (EXCLUDED.has(action.statut)) continue;
    const due = classifyDue(action, start, end, asOfMs);
    if (due) {
      const tenueCalcul = due.held
        ? "Tenue"
        : due.abandon
          ? "Abandonnée"
          : due.unmeasured
            ? "Sans date de fin"
            : "Autre écart";
      tenue.push(
        evidenceRow(
          action,
          [
            { label: "Échéance initiale", value: dayLabel(action.initiale) },
            { label: "Clôture", value: dayLabel(action.closeDay) },
          ],
          tenueCalcul
        )
      );
      const reported =
        !!action.actualisee && !!action.initiale && action.actualisee > action.initiale;
      glide.push(
        evidenceRow(
          action,
          [
            { label: "Échéance initiale", value: dayLabel(action.initiale) },
            { label: "Échéance actualisée", value: dayLabel(action.actualisee) },
          ],
          reported ? "Reportée" : "Non reportée"
        )
      );
    }
    const measured = measurePrise(action, start, end, origin);
    if (typeof measured === "object") {
      prise.push(
        evidenceRow(
          action,
          [
            {
              label: origin === "creation" ? "Date de création" : "Date d'identification",
              value: dayLabel(origin === "creation" ? action.createdDay : action.identificationDay),
            },
            { label: "Prise en charge", value: dayLabel(action.priseDay) },
          ],
          `${measured.days} j`
        )
      );
    }
    const measuredCycle = measureCycle(action, start, end, cycleStart);
    if (typeof measuredCycle === "object") {
      cycle.push(
        evidenceRow(
          action,
          [
            cycleStart === "prise"
              ? { label: "Prise en charge", value: dayLabel(action.priseDay) }
              : {
                  label: "Date d'identification",
                  value: dayLabel(action.identificationDay),
                },
            { label: "Clôture", value: dayLabel(action.closeDay) },
          ],
          `${measuredCycle.days} j`
        )
      );
    }
    if (isOpenAt(action, end, live)) {
      const eff = effectiveDay(action);
      if (eff && endOfDayMs(eff) < asOfMs) {
        stock.push(
          evidenceRow(
            action,
            [
              { label: "Échéance initiale", value: dayLabel(action.initiale) },
              { label: "Échéance actualisée", value: dayLabel(action.actualisee) },
              {
                label: "Échéance retenue",
                value: dayLabel(eff),
              },
            ],
            action.actualisee ? "En retard · échéance actualisée" : "En retard · échéance initiale"
          )
        );
      }
    }
  }
  const byCode = (a: PerfEvidenceRow, b: PerfEvidenceRow) =>
    a.code.localeCompare(b.code, "fr");
  tenue.sort(byCode);
  prise.sort(byCode);
  cycle.sort(byCode);
  stock.sort(byCode);
  glide.sort(byCode);
  return { tenue, prise, cycle, stock, glide };
}

export function buildRaidPerformance(
  inputs: PerfInput[],
  window: PerfWindow,
  now: Date,
  focus: { id: string; label: string; code: string } | null,
  screen: PerfScreen,
  origin: MedianOrigin = "creation",
  cycleStart: CycleStart = "prise"
): RaidPerformancePayload {
  const live = window.liveStock;
  const asOfMs = asOfInstant(window.endDay, live, now);
  const prevAsOf = asOfInstant(window.prevEndDay, false, now);
  const groups = groupActions(inputs);
  if (focus && !groups.has(focus.id)) groups.set(focus.id, []);

  const drafted: PerfGroup[] = [];
  for (const [id, list] of groups) {
    const sample = list[0];
    const label =
      id === RAID_PERF_NONE
        ? "Non rattaché"
        : sample?.teamLabel || focus?.label || "Équipe";
    const code =
      id === RAID_PERF_NONE ? "" : sample?.teamCode || focus?.code || "";
    drafted.push({
      id,
      label,
      code,
      ...statsOf(list, window.startDay, window.endDay, asOfMs, live, origin, cycleStart),
      tones: MUTED,
    });
  }

  const colorable = drafted.filter((team) => team.due >= RAID_PERF_MIN_DUE);
  const medians = {
    tenue: median(
      colorable.flatMap((team) =>
        team.tenuePct == null ? [] : [team.tenuePct]
      )
    ),
    prise: median(
      colorable.flatMap((team) =>
        team.priseMedian == null ? [] : [team.priseMedian]
      )
    ),
    cycle: median(
      colorable.flatMap((team) =>
        team.cycleMedian == null ? [] : [team.cycleMedian]
      )
    ),
    stock: median(
      colorable.flatMap((team) =>
        team.stockPct == null ? [] : [team.stockPct]
      )
    ),
    glide: median(
      colorable.flatMap((team) =>
        team.glidePct == null ? [] : [team.glidePct]
      )
    ),
  };
  for (const team of drafted) team.tones = tonesFor(team, medians);

  drafted.sort((a, b) => {
    if (a.id === RAID_PERF_NONE) return 1;
    if (b.id === RAID_PERF_NONE) return -1;
    const ar = a.tenuePct ?? -1;
    const br = b.tenuePct ?? -1;
    if (br !== ar) return br - ar;
    return a.label.localeCompare(b.label, "fr");
  });

  const focusList = focus ? groups.get(focus.id) ?? [] : null;
  const trend = buildTrend(
    focusList ?? inputs,
    focus ? inputs : null,
    window.startDay,
    window.endDay,
    asOfMs
  );

  let detail: RaidPerformancePayload["detail"] = null;
  if (focus && focusList) {
    const team =
      drafted.find((row) => row.id === focus.id) ?? {
        id: focus.id,
        label: focus.label,
        code: focus.code,
        ...emptyStats(),
        tones: MUTED,
      };
    const byPerson = new Map<string, PerfInput[]>();
    for (const action of focusList) {
      const list = byPerson.get(action.responsableId);
      if (list) list.push(action);
      else byPerson.set(action.responsableId, [action]);
    }
    const responsables: PerfGroup[] = [];
    for (const [id, list] of byPerson) {
      const stats = statsOf(
        list,
        window.startDay,
        window.endDay,
        asOfMs,
        live,
        origin,
        cycleStart
      );
      if (!hasSignal(stats)) continue;
      responsables.push({
        id,
        label: list[0]?.responsable || "Non assigné",
        code: "",
        ...stats,
        tones: tonesFor(stats, medians),
      });
    }
    responsables.sort((a, b) => {
      const ar = a.tenuePct ?? -1;
      const br = b.tenuePct ?? -1;
      if (br !== ar) return br - ar;
      return a.label.localeCompare(b.label, "fr");
    });
    detail = {
      team,
      previous: statsOf(
        focusList,
        window.prevStartDay,
        window.prevEndDay,
        prevAsOf,
        false,
        origin,
        cycleStart
      ),
      responsables,
      actions: toActionRows(
        focusList,
        window.startDay,
        window.endDay,
        window.endDay,
        asOfMs,
        live
      ),
    };
  }

  const population = focus ? (groups.get(focus.id) ?? []) : inputs;
  return {
    window,
    medianOrigin: origin,
    priseOrigins: {
      creation: priseSnapshot(population, window.startDay, window.endDay, "creation"),
      identification: priseSnapshot(
        population,
        window.startDay,
        window.endDay,
        "identification"
      ),
    },
    cycleStart,
    cycleStarts: {
      prise: cycleSnapshot(population, window.startDay, window.endDay, "prise"),
      identification: cycleSnapshot(
        population,
        window.startDay,
        window.endDay,
        "identification"
      ),
    },
    evidence: buildEvidence(
      population,
      window.startDay,
      window.endDay,
      asOfMs,
      live,
      origin,
      cycleStart
    ),
    programme: statsOf(
      inputs,
      window.startDay,
      window.endDay,
      asOfMs,
      live,
      origin,
      cycleStart
    ),
    previous: statsOf(
      inputs,
      window.prevStartDay,
      window.prevEndDay,
      prevAsOf,
      false,
      origin,
      cycleStart
    ),
    colorMedian: medians,
    teams: drafted,
    trend,
    trendMode: focus ? "equipe" : "programme",
    screen,
    detail,
  };
}
