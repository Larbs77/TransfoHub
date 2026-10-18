import { formatRaidCalendarDate, isRaidClosed, raidCalendarDay } from "@/lib/raid-labels";
import { RAID_PERF_NONE, addDays, daySpan } from "@/lib/raid-performance";

/**
 * Prévisions des engagements (expérimental).
 *
 * Une observation au jour J n'utilise que le journal de statut connu à J.
 * L'échéance actualisée, la date de fin déclarée, updatedAt, l'équipe et le
 * responsable ne sont pas des variables : ils ne se rejouent pas de façon fiable.
 *
 * Probabilité : fréquence de tenue du groupe comparable (prise en charge,
 * âge, délai restant). Aucun chiffre n'est publié si le contrôle chronologique
 * ne bat pas le taux historique global.
 */

export const FORECAST_HORIZONS = [30, 60, 90] as const;
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

/** Groupe trop petit : une fiche de plus déplace le taux de plus de dix points. */
export const FORECAST_MIN_CELL = 8;
/** En dessous, aucun contrôle chronologique n'est tenté. */
export const FORECAST_MIN_USABLE = 20;
/** Apprentissage et contrôle récent : 40 + 20. */
export const FORECAST_MIN_TRAIN = 40;
export const FORECAST_MIN_TEST = 20;
/** Dès la moitié, l'historique journalisé n'est plus majoritaire. */
export const FORECAST_MAX_JOURNAL_GAP = 0.5;
/** Écart minimal de tenue observée entre la moitié basse et la moitié haute. */
export const FORECAST_MIN_RANK_GAP = 0.1;
/**
 * Au-delà, le pourcentage affiché ne dit plus la fréquence observée
 * sur le bloc récent.
 */
export const FORECAST_MAX_CALIBRATION_GAP = 0.15;
/**
 * Seuil provisoire, non optimisé : une tenue estimée affichée sous 50 %
 * est comptée comme risque élevé. Ce n'est pas un seuil appris.
 */
export const FORECAST_HIGH_RISK_BELOW = 50;

const WAITING = new Set(["A planifier", "Planifié", "A lancer"]);
const EXCLUDED = new Set(["Doublon", "NA"]);

export type ForecastRaid = {
  id: string;
  code: string;
  intitule: string;
  chantierId: string | null;
  teamLabel: string;
  responsable: string;
  statut: string;
  createdAt: Date | string;
  initiale: Date | string | null;
  deletedAt?: Date | string | null;
};

export type ForecastAudit = {
  raidId: string;
  oldValue: string;
  newValue: string;
  createdAt: Date | string;
};

export type ForecastReliability = "validated" | "validating" | "insufficient";

export type ForecastTrainingRow = {
  id: string;
  initiale: string;
  held: boolean;
  prise: PriseState;
  age: string;
  days: string;
};

export type ForecastRow = {
  id: string;
  code: string;
  intitule: string;
  teamLabel: string;
  responsable: string;
  statut: string;
  initiale: string;
  daysLeft: number;
  /** Pourcentage entier, absent quand le groupe comparable est trop petit ou le modèle retenu. */
  probability: number | null;
  factors: string | null;
};

export type RaidForecastPayload = {
  horizon: ForecastHorizon;
  teamId: string | null;
  teams: { id: string; label: string }[];
  calculatedOn: string;
  reliability: ForecastReliability;
  showProbabilities: boolean;
  tenuePct: number | null;
  eligible: number;
  scored: number;
  highRisk: number | null;
  volumes: Record<ForecastHorizon, number>;
  overdue: number;
  undated: number;
  terminalInHorizon: number;
  history: {
    usable: number;
    unmeasured: number;
    unmeasuredPct: number | null;
    trainN: number;
    testN: number;
    scoredTest: number;
    trainFrom: string | null;
    trainTo: string | null;
    testFrom: string | null;
    testTo: string | null;
    brier: number | null;
    baselineBrier: number | null;
    lowHoldPct: number | null;
    highHoldPct: number | null;
    reason: string;
  };
  rows: ForecastRow[];
};

type PriseState = "attente" | "prise" | "non_datee";

type StatusEvent = {
  at: number;
  day: string;
  from: string;
  to: string;
  index: number;
};

type Prepared = {
  id: string;
  code: string;
  intitule: string;
  teamId: string;
  teamLabel: string;
  responsable: string;
  statut: string;
  createdDay: string;
  initiale: string | null;
  events: StatusEvent[];
};

type Features = {
  prise: PriseState;
  age: string;
  days: string;
};

type Cell = { held: number; n: number };

type Model = {
  fine: Map<string, Cell>;
  mid: Map<string, Cell>;
  coarse: Map<string, Cell>;
};

type Hit = { p: number; held: number; n: number; level: "fine" | "mid" | "coarse" };

export function parseForecastHorizon(raw?: string): ForecastHorizon {
  if (raw === "30" || raw === "60" || raw === "90") return Number(raw) as ForecastHorizon;
  return 90;
}

export function buildForecastTraining(
  raids: ForecastRaid[],
  audits: ForecastAudit[],
  horizon: ForecastHorizon,
  now: Date
): { rows: ForecastTrainingRow[]; unmeasured: number } {
  const today = raidCalendarDay(now) ?? new Date(now).toISOString().slice(0, 10);
  const rows: ForecastTrainingRow[] = [];
  let unmeasured = 0;
  for (const action of prepare(raids, audits)) {
    const snap = snapshot(action, horizon, today);
    if (snap === "unmeasured") unmeasured += 1;
    else if (snap) rows.push(snap);
  }
  rows.sort((a, b) => a.initiale.localeCompare(b.initiale) || a.id.localeCompare(b.id));
  return { rows, unmeasured };
}

export function buildRaidForecast(
  raids: ForecastRaid[],
  audits: ForecastAudit[],
  now: Date,
  horizon: ForecastHorizon,
  teamId: string | null
): RaidForecastPayload {
  const today = raidCalendarDay(now) ?? new Date(now).toISOString().slice(0, 10);
  const actions = prepare(raids, audits);
  const teams = teamOptions(actions);
  const team = teamId && teams.some((item) => item.id === teamId) ? teamId : null;
  const visible = actions.filter((action) => !team || action.teamId === team);
  const { rows: training, unmeasured } = collectTraining(actions, horizon, today);
  const history = assess(training, unmeasured);
  const model = history.reliability === "validated" ? fit(training) : null;
  const horizonEnd = addDays(today, horizon);
  const rows: ForecastRow[] = [];
  let overdue = 0;
  let undated = 0;
  let terminalInHorizon = 0;

  for (const action of visible) {
    const terminal = isRaidClosed(action.statut);
    if (!action.initiale) {
      if (!terminal) undated += 1;
      continue;
    }
    if (terminal) {
      if (action.initiale > today && action.initiale <= horizonEnd) terminalInHorizon += 1;
      continue;
    }
    if (action.initiale <= today) {
      overdue += 1;
      continue;
    }
    if (action.initiale > horizonEnd) continue;
    const daysLeft = daySpan(today, action.initiale);
    const features: Features = {
      prise: livePrise(action, now.getTime()),
      age: ageBucket(Math.max(0, daySpan(action.createdDay, today))),
      days: daysBucket(daysLeft),
    };
    const hit = model ? lookup(model, features) : null;
    rows.push({
      id: action.id,
      code: action.code,
      intitule: action.intitule,
      teamLabel: action.teamLabel,
      responsable: action.responsable || "Non assigné",
      statut: action.statut,
      initiale: action.initiale,
      daysLeft,
      probability: hit ? Math.round(hit.p * 100) : null,
      factors: hit ? factorText(hit, features) : null,
    });
  }

  rows.sort((a, b) => {
    if (a.probability == null && b.probability == null) {
      return a.daysLeft - b.daysLeft || a.code.localeCompare(b.code, "fr");
    }
    if (a.probability == null) return 1;
    if (b.probability == null) return -1;
    return a.probability - b.probability || a.daysLeft - b.daysLeft || a.code.localeCompare(b.code, "fr");
  });

  const scoredRows = rows.filter((row) => row.probability != null);
  const showProbabilities = history.reliability === "validated" && scoredRows.length > 0;
  const tenuePct = showProbabilities
    ? Math.round(scoredRows.reduce((sum, row) => sum + (row.probability ?? 0), 0) / scoredRows.length)
    : null;

  return {
    horizon,
    teamId: team,
    teams,
    calculatedOn: today,
    reliability: history.reliability,
    showProbabilities,
    tenuePct,
    eligible: rows.length,
    scored: showProbabilities ? scoredRows.length : 0,
    highRisk: showProbabilities
      ? scoredRows.filter((row) => (row.probability ?? 100) < FORECAST_HIGH_RISK_BELOW).length
      : null,
    volumes: {
      30: countEligible(visible, today, 30),
      60: countEligible(visible, today, 60),
      90: countEligible(visible, today, 90),
    },
    overdue,
    undated,
    terminalInHorizon,
    history: {
      ...history.stats,
      reason: history.reason,
    },
    rows: rows.map((row) =>
      showProbabilities ? row : { ...row, probability: null, factors: null }
    ),
  };
}

function prepare(raids: ForecastRaid[], audits: ForecastAudit[]): Prepared[] {
  const byRaid = new Map<string, StatusEvent[]>();
  audits.forEach((audit, index) => {
    const at = new Date(audit.createdAt).getTime();
    const day = raidCalendarDay(audit.createdAt);
    const to = audit.newValue.trim();
    if (!audit.raidId || !day || Number.isNaN(at) || !to) return;
    const list = byRaid.get(audit.raidId) ?? [];
    list.push({ at, day, from: audit.oldValue.trim(), to, index });
    byRaid.set(audit.raidId, list);
  });
  for (const list of byRaid.values()) {
    list.sort((a, b) => a.at - b.at || a.index - b.index);
  }

  const out: Prepared[] = [];
  for (const raid of raids) {
    if (raid.deletedAt) continue;
    const statut = raid.statut.trim();
    if (EXCLUDED.has(statut)) continue;
    const createdDay = raidCalendarDay(raid.createdAt);
    if (!createdDay) continue;
    out.push({
      id: raid.id,
      code: raid.code,
      intitule: raid.intitule,
      teamId: raid.chantierId ?? RAID_PERF_NONE,
      teamLabel: raid.teamLabel || "Non rattaché",
      responsable: raid.responsable.trim(),
      statut,
      createdDay,
      initiale: raidCalendarDay(raid.initiale),
      events: byRaid.get(raid.id) ?? [],
    });
  }
  return out;
}

function collectTraining(
  actions: Prepared[],
  horizon: ForecastHorizon,
  today: string
): { rows: ForecastTrainingRow[]; unmeasured: number } {
  const rows: ForecastTrainingRow[] = [];
  let unmeasured = 0;
  for (const action of actions) {
    const snap = snapshot(action, horizon, today);
    if (snap === "unmeasured") unmeasured += 1;
    else if (snap) rows.push(snap);
  }
  rows.sort((a, b) => a.initiale.localeCompare(b.initiale) || a.id.localeCompare(b.id));
  return { rows, unmeasured };
}

/** null = hors population d'apprentissage. "unmeasured" = échéance échue sans statut reconstituable. */
function snapshot(
  action: Prepared,
  horizon: ForecastHorizon,
  today: string
): ForecastTrainingRow | "unmeasured" | null {
  if (!action.initiale || action.initiale >= today) return null;
  if (action.createdDay > action.initiale) return null;
  const earliest = addDays(action.initiale, -horizon);
  const observed = action.createdDay > earliest ? action.createdDay : earliest;
  const daysLeft = daySpan(observed, action.initiale);
  if (daysLeft < 1 || daysLeft > horizon) return null;
  const atObserved = endOfDayMs(observed);
  const state = statusAt(action.events, atObserved);
  if (!state.known) return "unmeasured";
  if (isRaidClosed(state.statut)) return null;
  const end = outcome(action);
  if (!end.known) return "unmeasured";
  return {
    id: action.id,
    initiale: action.initiale,
    held: end.held,
    prise: priseFromStatus(action.events, atObserved, state.statut),
    age: ageBucket(Math.max(0, daySpan(action.createdDay, observed))),
    days: daysBucket(daysLeft),
  };
}

function outcome(action: Prepared): { known: boolean; held: boolean } {
  const due = action.initiale;
  if (!due) return { known: false, held: false };
  const end = endOfDayMs(due);
  const state = statusAt(action.events, end);
  if (!state.known) return { known: false, held: false };
  if (state.statut !== "Clôturé") return { known: true, held: false };
  const close = [...action.events].reverse().find((event) => event.to === "Clôturé" && event.at <= end);
  if (!close) return { known: false, held: false };
  return { known: true, held: close.day <= due };
}

function assess(
  rows: ForecastTrainingRow[],
  unmeasured: number
): {
  reliability: ForecastReliability;
  reason: string;
  stats: Omit<RaidForecastPayload["history"], "reason">;
} {
  const usable = rows.length;
  const denom = usable + unmeasured;
  const unmeasuredPct = denom > 0 ? Math.round((unmeasured / denom) * 100) : null;
  const blank: Omit<RaidForecastPayload["history"], "reason"> = {
    usable,
    unmeasured,
    unmeasuredPct,
    trainN: 0,
    testN: 0,
    scoredTest: 0,
    trainFrom: null,
    trainTo: null,
    testFrom: null,
    testTo: null,
    brier: null,
    baselineBrier: null,
    lowHoldPct: null,
    highHoldPct: null,
  };

  if (usable < FORECAST_MIN_USABLE) {
    return {
      reliability: "insufficient",
      reason:
        unmeasured > usable
          ? "Moins de 20 engagements terminés ont un journal de statut exploitable à la date d'observation."
          : "Moins de 20 engagements terminés sont disponibles pour un contrôle chronologique.",
      stats: blank,
    };
  }

  const gap = unmeasured / denom;

  if (usable < FORECAST_MIN_TRAIN + FORECAST_MIN_TEST) {
    return {
      reliability: "validating",
      reason:
        "L'historique reconstituable ne permet pas encore de réserver 20 engagements récents hors de l'apprentissage.",
      stats: blank,
    };
  }

  const testN = Math.max(FORECAST_MIN_TEST, Math.floor(usable * 0.3));
  const train = rows.slice(0, usable - testN);
  const test = rows.slice(usable - testN);
  const stats = {
    ...blank,
    trainN: train.length,
    testN: test.length,
    trainFrom: train[0]?.initiale ?? null,
    trainTo: train[train.length - 1]?.initiale ?? null,
    testFrom: test[0]?.initiale ?? null,
    testTo: test[test.length - 1]?.initiale ?? null,
  };
  const model = fit(train);
  const scored = test.flatMap((row) => {
    const hit = lookup(model, row);
    return hit ? [{ p: hit.p, y: row.held ? 1 : 0 }] : [];
  });
  stats.scoredTest = scored.length;
  if (scored.length < FORECAST_MIN_TEST) {
    return {
      reliability: "validating",
      reason:
        "Les groupes comparables d'au moins 8 issues ne couvrent pas le bloc récent. Aucune probabilité n'est publiée.",
      stats,
    };
  }

  const baseline = train.filter((row) => row.held).length / train.length;
  const brier = mean(scored.map((row) => (row.p - row.y) ** 2));
  const baselineBrier = mean(scored.map((row) => (baseline - row.y) ** 2));
  stats.brier = round3(brier);
  stats.baselineBrier = round3(baselineBrier);
  const ordered = [...scored].sort((a, b) => a.p - b.p);
  const half = Math.floor(ordered.length / 2);
  const low = ordered.slice(0, half);
  const high = ordered.slice(half);
  const lowHold = mean(low.map((row) => row.y));
  const highHold = mean(high.map((row) => row.y));
  stats.lowHoldPct = Math.round(lowHold * 100);
  stats.highHoldPct = Math.round(highHold * 100);
  const predicted = mean(scored.map((row) => row.p));
  const observed = mean(scored.map((row) => row.y));

  if (gap >= FORECAST_MAX_JOURNAL_GAP) {
    return {
      reliability: "validating",
      reason:
        "La moitié ou plus des engagements terminés n'ont pas de journal de statut exploitable. Le modèle ne décrirait que la part déjà tracée.",
      stats,
    };
  }
  if (!(brier < baselineBrier)) {
    return {
      reliability: "validating",
      reason:
        "Sur le bloc récent, les groupes comparables ne font pas mieux que le taux de tenue historique global.",
      stats,
    };
  }
  if (Math.abs(predicted - observed) > FORECAST_MAX_CALIBRATION_GAP) {
    return {
      reliability: "validating",
      reason: `Les probabilités du bloc récent (${Math.round(predicted * 100)} %) s'écartent de plus de 15 points du taux observé (${Math.round(observed * 100)} %).`,
      stats,
    };
  }
  if (highHold - lowHold < FORECAST_MIN_RANK_GAP) {
    return {
      reliability: "validating",
      reason:
        "Les probabilités basses ne correspondent pas à davantage de non-tenues sur le bloc récent.",
      stats,
    };
  }
  return {
    reliability: "validated",
    reason:
      "Le bloc chronologique récent est mieux prévu par les groupes comparables que par le taux historique global, et les probabilités basses correspondent à davantage de non-tenues.",
    stats,
  };
}

function fit(rows: ForecastTrainingRow[]): Model {
  const model: Model = { fine: new Map(), mid: new Map(), coarse: new Map() };
  for (const row of rows) {
    addCell(model.fine, `${row.prise}|${row.age}|${row.days}`, row.held);
    addCell(model.mid, `${row.prise}|${row.days}`, row.held);
    addCell(model.coarse, row.prise, row.held);
  }
  return model;
}

function addCell(map: Map<string, Cell>, key: string, held: boolean) {
  const cell = map.get(key) ?? { held: 0, n: 0 };
  cell.n += 1;
  if (held) cell.held += 1;
  map.set(key, cell);
}

function lookup(model: Model, features: Features): Hit | null {
  const fine = model.fine.get(`${features.prise}|${features.age}|${features.days}`);
  if (fine && fine.n >= FORECAST_MIN_CELL) {
    return { p: fine.held / fine.n, held: fine.held, n: fine.n, level: "fine" };
  }
  const mid = model.mid.get(`${features.prise}|${features.days}`);
  if (mid && mid.n >= FORECAST_MIN_CELL) {
    return { p: mid.held / mid.n, held: mid.held, n: mid.n, level: "mid" };
  }
  const coarse = model.coarse.get(features.prise);
  if (coarse && coarse.n >= FORECAST_MIN_CELL) {
    return { p: coarse.held / coarse.n, held: coarse.held, n: coarse.n, level: "coarse" };
  }
  return null;
}

function countEligible(actions: Prepared[], today: string, horizon: ForecastHorizon): number {
  const end = addDays(today, horizon);
  return actions.filter(
    (action) =>
      !isRaidClosed(action.statut) &&
      !!action.initiale &&
      action.initiale > today &&
      action.initiale <= end
  ).length;
}

function livePrise(action: Prepared, nowMs: number): PriseState {
  return priseFromStatus(action.events, nowMs, action.statut);
}

function priseFromStatus(events: StatusEvent[], atMs: number, statut: string): PriseState {
  if (WAITING.has(statut)) return "attente";
  const dated = events.some((event) => event.at <= atMs && !WAITING.has(event.to));
  return dated ? "prise" : "non_datee";
}

function statusAt(events: StatusEvent[], atMs: number): { statut: string; known: boolean } {
  let last: StatusEvent | null = null;
  for (const event of events) {
    if (event.at <= atMs) last = event;
    else break;
  }
  if (last) return { statut: last.to, known: true };
  const first = events[0];
  if (first && first.from) return { statut: first.from, known: true };
  return { statut: "", known: false };
}

function ageBucket(age: number): string {
  if (age <= 30) return "0-30";
  if (age <= 90) return "31-90";
  return "91+";
}

function daysBucket(days: number): string {
  if (days <= 14) return "1-14";
  if (days <= 30) return "15-30";
  if (days <= 60) return "31-60";
  return "61-90";
}

function factorText(hit: Hit, features: Features): string {
  const prise =
    features.prise === "attente"
      ? "encore en salle d'attente"
      : features.prise === "prise"
        ? "prise en charge datée"
        : "prise en charge non datée";
  const level =
    hit.level === "fine"
      ? "prise en charge, âge et délai restant"
      : hit.level === "mid"
        ? "prise en charge et délai restant"
        : "prise en charge";
  return `Groupe comparable (${level}) : ${prise}, âge ${features.age} jours, délai restant ${features.days} jours. ${hit.held} tenues sur ${hit.n} engagements terminés.`;
}

function teamOptions(actions: Prepared[]): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const action of actions) map.set(action.teamId, action.teamLabel);
  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => {
      if (a.id === RAID_PERF_NONE) return 1;
      if (b.id === RAID_PERF_NONE) return -1;
      return a.label.localeCompare(b.label, "fr");
    });
}

function endOfDayMs(day: string): number {
  return Date.parse(`${day}T23:59:59.999Z`);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function formatForecastDay(day: string | null): string {
  if (!day) return "—";
  return formatRaidCalendarDate(`${day}T00:00:00.000Z`);
}
