/**
 * Reminder slot: Monday and Thursday, 02:00–08:00, Africa/Casablanca.
 * The clock is Casablanca even when the server timezone is different.
 */

export const RELANCE_TZ = "Africa/Casablanca";

const WEEKDAY_FR: Record<string, string> = {
  Sun: "dimanche",
  Mon: "lundi",
  Tue: "mardi",
  Wed: "mercredi",
  Thu: "jeudi",
  Fri: "vendredi",
  Sat: "samedi",
};

const SLOT_WEEKDAYS = new Set(["Mon", "Thu"]);

export type CasablancaParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Sun | Mon | Tue | Wed | Thu | Fri | Sat */
  weekday: string;
};

export type RelanceWindow = {
  /** True from 02:00 inclusive to 08:00 exclusive, Monday or Thursday. */
  inWindow: boolean;
  /** yyyy-mm-dd when a scheduled slot is open, otherwise null. */
  slotKey: string | null;
  label: string;
};

export function casablancaParts(now: Date): CasablancaParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: RELANCE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    weekday: bag.weekday,
  };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function ymdKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function formatFrenchDate(year: number, month: number, day: number): string {
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

export function formatCasablancaDate(date: Date): string {
  const p = casablancaParts(date);
  return formatFrenchDate(p.year, p.month, p.day);
}

/** Calendar-day lag in Casablanca. Overdue rows show at least 1. */
export function retardJours(echeance: Date, now: Date): number {
  const a = casablancaParts(echeance);
  const b = casablancaParts(now);
  const days = Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) -
      Date.UTC(a.year, a.month - 1, a.day)) /
      86_400_000
  );
  return Math.max(1, days);
}

function weekdayKey(year: number, month: number, day: number): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
}

function addDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const t = new Date(Date.UTC(year, month - 1, day));
  t.setUTCDate(t.getUTCDate() + delta);
  return {
    year: t.getUTCFullYear(),
    month: t.getUTCMonth() + 1,
    day: t.getUTCDate(),
  };
}

export function describeRelanceWindow(now: Date = new Date()): RelanceWindow {
  const p = casablancaParts(now);
  const inWindow =
    SLOT_WEEKDAYS.has(p.weekday) && p.hour >= 2 && p.hour < 8;
  if (inWindow) {
    const jour = WEEKDAY_FR[p.weekday] ?? p.weekday;
    return {
      inWindow: true,
      slotKey: ymdKey(p.year, p.month, p.day),
      label: `Créneau en cours : ${jour} ${formatFrenchDate(p.year, p.month, p.day)}, de 2 h à 8 h (Africa/Casablanca).`,
    };
  }

  for (let i = 0; i < 8; i++) {
    const day = addDays(p.year, p.month, p.day, i);
    const wd = weekdayKey(day.year, day.month, day.day);
    if (!SLOT_WEEKDAYS.has(wd)) continue;
    if (i === 0 && p.hour >= 2) continue;
    const jour = WEEKDAY_FR[wd] ?? wd;
    return {
      inWindow: false,
      slotKey: null,
      label: `Prochain envoi : ${jour} ${formatFrenchDate(day.year, day.month, day.day)} à 2 h (Africa/Casablanca).`,
    };
  }

  return {
    inWindow: false,
    slotKey: null,
    label: "Prochain envoi : lundi ou jeudi à 2 h (Africa/Casablanca).",
  };
}
