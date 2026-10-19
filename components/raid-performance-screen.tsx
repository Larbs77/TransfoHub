"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarRange,
  Gauge,
  Hourglass,
  ShieldCheck,
  Timer,
  UnfoldHorizontal,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRaidCalendarDate } from "@/lib/raid-labels";
import type {
  CycleStart,
  CycleStartSnapshot,
  MedianOrigin,
  PerfActionFlag,
  PerfCardKey,
  PerfEvidenceRow,
  PerfGroup,
  PerfStats,
  PriseOriginSnapshot,
  RaidPerformancePayload,
  Tone,
} from "@/lib/raid-performance";
import {
  RAID_PERF_MIN_DUE,
  orderPerfGroups,
  perfCardHistory,
  withPerfSearch,
  type PerfGroupSortKey,
} from "@/lib/raid-performance";
import { cn } from "@/lib/utils";

const PRESETS = [
  { id: "30", label: "30 jours" },
  { id: "90", label: "90 jours" },
  { id: "quarter", label: "Trimestre" },
  { id: "365", label: "12 mois (365 jours glissants)" },
] as const;

const TONE_CLASS: Record<Tone, string> = {
  good: "bg-emerald-500/15 text-emerald-950 dark:text-emerald-50",
  bad: "bg-rose-500/15 text-rose-950 dark:text-rose-50",
  mid: "",
  muted: "bg-muted/70 text-muted-foreground",
};

const FILTERS: { id: PerfActionFlag; label: string }[] = [
  { id: "due", label: "Dues" },
  { id: "held", label: "Tenues" },
  { id: "missed", label: "Autres écarts" },
  { id: "abandon", label: "Abandonnées" },
  { id: "unmeasured", label: "Sans date de fin" },
  { id: "stock", label: "Stock échu" },
];

type SortKey = PerfGroupSortKey;

function showDay(day: string | null): string {
  if (!day) return "—";
  return formatRaidCalendarDate(`${day}T00:00:00.000Z`);
}

function pct(value: number | null): string {
  if (value == null) return "—";
  return `${value} %`;
}

function days(value: number | null): string {
  if (value == null) return "—";
  return `${value} j`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

function Delta({
  value,
  unit,
  lowerBetter,
  scope,
}: {
  value: number | null;
  unit: "pts" | "j";
  lowerBetter?: boolean;
  scope?: string;
}) {
  const about = scope ? ` (${scope})` : "";
  if (value == null) {
    return <span className="text-muted-foreground">Pas de comparaison{about}</span>;
  }
  if (value === 0) {
    return <span className="text-muted-foreground">Stable{about}</span>;
  }
  const good = lowerBetter ? value < 0 : value > 0;
  const sign = value > 0 ? "+" : "−";
  return (
    <span
      className={
        good
          ? "font-medium text-emerald-700 dark:text-emerald-300"
          : "font-medium text-rose-700 dark:text-rose-300"
      }
    >
      {sign}
      {Math.abs(value)} {unit}
      {about}
    </span>
  );
}

function InfoNote({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="text-[11px] font-medium text-[#0A3C74] underline-offset-2 hover:underline dark:text-[#00BDBB]"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Masquer" : "Explication"}
      </button>
      {open ? (
        <div className="mt-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  detail,
  delta,
  deltaUnit,
  lowerBetter,
  reference,
  history,
  historyNote,
  note,
  compareLabel,
  deltaScope,
  accent,
  icon: Icon,
  featured,
  onOpen,
}: {
  label: string;
  value: string;
  hint: string;
  detail?: string;
  delta: number | null;
  deltaUnit: "pts" | "j";
  lowerBetter?: boolean;
  reference?: string;
  history: "delta" | "unavailable";
  historyNote?: string;
  note?: string;
  compareLabel?: string;
  deltaScope?: string;
  accent: string;
  icon: ComponentType<{ className?: string }>;
  featured?: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm",
        featured && "ring-1 ring-[#0A3C74]/30"
      )}
    >
      <div
        className="absolute -right-5 -top-5 size-16 rounded-full opacity-[0.14]"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 block rounded-sm text-left text-2xl font-bold tracking-tight text-primary tabular-nums underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[#00BDBB] focus-visible:outline-none"
        aria-label={`Voir le détail du calcul : ${label}`}
      >
        {value}
      </button>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>
      {detail ? (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground tabular-nums">
          {detail}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] leading-snug">
        {history === "unavailable" ? (
          <span className="text-muted-foreground">
            Évolution historique non disponible.
            {reference ? ` Repère actuel : ${reference}.` : ""}
          </span>
        ) : (
          <>
            <Delta
              value={delta}
              unit={deltaUnit}
              lowerBetter={lowerBetter}
              scope={deltaScope}
            />
            {compareLabel ? (
              <span className="text-muted-foreground">
                {" "}
                par rapport à la période précédente de même durée : {compareLabel}.
              </span>
            ) : null}
            {reference ? (
              <span className="text-muted-foreground"> Repère actuel : {reference}.</span>
            ) : null}
          </>
        )}
      </p>
      {note || historyNote ? (
        <div className="mt-1">
          <InfoNote>
            {note ? <p>{note}</p> : null}
            {historyNote ? <p>{historyNote}</p> : null}
          </InfoNote>
        </div>
      ) : null}
    </div>
  );
}

function toneCell(tone: Tone, text: string, title: string) {
  return (
    <TableCell className={cn("text-sm tabular-nums", TONE_CLASS[tone])} title={title}>
      {text}
    </TableCell>
  );
}

function tenueText(row: PerfGroup, withVolume: boolean): string {
  if (!withVolume || row.due <= 0 || row.tenuePct == null) return pct(row.tenuePct);
  const noun = row.due > 1 ? "actions dues" : "action due";
  return `${pct(row.tenuePct)} — ${row.held} / ${row.due} ${noun}`;
}

function GroupTable({
  rows,
  hrefFor,
  sort,
  onSort,
  showTenueVolume = false,
}: {
  rows: PerfGroup[];
  hrefFor?: (id: string) => string;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
  showTenueVolume?: boolean;
}) {
  const ordered = useMemo(
    () => orderPerfGroups(rows, sort),
    [rows, sort]
  );

  function head(key: SortKey, label: string, className?: string) {
    const active = sort?.key === key;
    return (
      <TableHead className={className}>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-left font-medium"
          onClick={() => onSort(key)}
        >
          {label}
          {active ? (sort?.dir === "asc" ? " ↑" : " ↓") : ""}
        </button>
      </TableHead>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {head("label", "Équipe chantier", "min-w-48")}
          {head("due", "Dues")}
          {head("tenue", "Tenue")}
          {head("prise", "Prise en charge")}
          {head("cycle", "Cycle")}
          {head("stock", "Stock échu")}
          {head("glide", "Échéances reportées", "whitespace-nowrap")}
          {head("abandon", "Abandon")}
        </TableRow>
      </TableHeader>
      <TableBody>
        {ordered.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
              Aucune action sur cette période.
            </TableCell>
          </TableRow>
        ) : (
          ordered.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                {hrefFor ? (
                  <Link
                    href={hrefFor(row.id)}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.label}
                  </Link>
                ) : (
                  <span className="font-medium">{row.label}</span>
                )}
                {row.code ? (
                  <p className="text-[11px] text-muted-foreground">{row.code}</p>
                ) : null}
              </TableCell>
              <TableCell className="tabular-nums">{row.due}</TableCell>
              {toneCell(
                row.tones.tenue,
                tenueText(row, showTenueVolume),
                `${row.held} tenues / ${row.due} dues`
              )}
              {toneCell(
                row.tones.prise,
                days(row.priseMedian),
                `Médiane sur ${row.priseN} prises en charge`
              )}
              {toneCell(
                row.tones.cycle,
                days(row.cycleMedian),
                row.cycleP90 == null
                  ? `Médiane sur ${row.cycleN} clôtures`
                  : `Médiane sur ${row.cycleN} clôtures. 9e décile ${row.cycleP90} j : 90 % ont duré au plus ${row.cycleP90} j`
              )}
              {toneCell(
                row.tones.stock,
                row.stockOpen === 0
                  ? "0"
                  : `${row.stockOverdue} · ${pct(row.stockPct)}`,
                `${row.stockOverdue} échues / ${row.stockOpen} ouvertes datées`
              )}
              {toneCell(
                row.tones.glide,
                pct(row.glidePct),
                `${row.glide} échéances reportées / ${row.due} dues`
              )}
              <TableCell className="tabular-nums">{row.abandon}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function QualityNote({ stats }: { stats: PerfStats }) {
  if (stats.blindPrise === 0 && stats.blindClose === 0) return null;
  return (
    <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      Journal incomplet.
      {stats.blindPrise > 0
        ? ` ${plural(stats.blindPrise, "action hors salle d'attente", "actions hors salle d'attente")} sans date de prise en charge : exclue${stats.blindPrise > 1 ? "s" : ""} des médianes.`
        : ""}
      {stats.blindClose > 0
        ? ` ${plural(stats.blindClose, "clôture due", "clôtures dues")} dans la fenêtre sans date de fin : comptée${stats.blindClose > 1 ? "s" : ""} non tenue${stats.blindClose > 1 ? "s" : ""}.`
        : ""}
    </p>
  );
}

function cycleDecileDetail(current: PerfStats, start: CycleStart): string {
  const from =
    start === "prise" ? "la sortie de salle d'attente" : "la date d'identification";
  if (current.cycleN === 0 || current.cycleP90 == null) {
    return "Aucune clôture mesurée sur cette période. Le 9e décile n'est pas calculé.";
  }
  const n = current.cycleP90;
  const unit = n > 1 ? "jours" : "jour";
  const calendar = n > 1 ? "calendaires" : "calendaire";
  return `9e décile : ${n} ${unit}. Sur ${current.cycleN} clôtures mesurées, 90 % ont duré au plus ${n} ${unit} ${calendar} entre ${from} et la clôture. Les 10 % les plus lentes ont duré plus longtemps. L'écart sous le chiffre compare la médiane, pas ce décile.`;
}

type KpiModelCard = {
  key: PerfCardKey;
  label: string;
  value: string;
  hint: string;
  detail?: string;
  delta: number | null;
  unit: "pts" | "j";
  lowerBetter?: boolean;
  reference?: string;
  history: "delta" | "unavailable";
  historyNote?: string;
  note?: string;
  compareLabel?: string;
  deltaScope?: string;
  accent: string;
  icon: ComponentType<{ className?: string }>;
  featured?: boolean;
};

function kpiModel(
  current: PerfStats,
  previous: PerfStats,
  programme: PerfStats | null,
  compareLabel: string,
  origin: MedianOrigin,
  cycleStart: CycleStart
): KpiModelCard[] {
  const ref = programme
    ? {
        tenue: `programme ${pct(programme.tenuePct)}`,
        prise: `programme ${days(programme.priseMedian)}`,
        cycle: `programme ${days(programme.cycleMedian)}`,
        stock: `programme ${pct(programme.stockPct)}`,
        glide: `programme ${pct(programme.glidePct)}`,
      }
    : null;
  return [
    {
      key: "tenue",
      label: "Tenue de l'engagement",
      value: pct(current.tenuePct),
      hint: "Engagements tenus à l'échéance initiale",
      detail: `${current.held} tenues / ${current.due} dues`,
      delta:
        current.tenuePct == null || previous.tenuePct == null
          ? null
          : current.tenuePct - previous.tenuePct,
      unit: "pts" as const,
      lowerBetter: false,
      reference: ref?.tenue,
      compareLabel,
      history: perfCardHistory("tenue"),
      accent: "#0A3C74",
      icon: ShieldCheck,
      featured: true,
    },
    {
      key: "prise",
      label: "Prise en charge",
      value: days(current.priseMedian),
      hint: `Médiane en jours calendaires, depuis la ${origin === "creation" ? "date de création" : "date d'identification"} · ${plural(current.priseN, "sortie de la salle d'attente", "sorties de la salle d'attente")}`,
      detail:
        origin === "identification"
          ? `Hors médiane : ${current.priseExcludedMissing} sans date d'identification, ${current.priseExcludedInverted} identification après la prise en charge.`
          : undefined,
      note:
        origin === "creation"
          ? "Depuis la date de création. Un délai négatif compte 0 jour et reste dans la médiane."
          : "Le délai part de la date d'identification. Une sortie sans date, ou une identification postérieure à la prise en charge, sort de la médiane.",
      delta:
        current.priseMedian == null || previous.priseMedian == null
          ? null
          : current.priseMedian - previous.priseMedian,
      unit: "j" as const,
      lowerBetter: true,
      deltaScope: "médiane",
      reference: ref?.prise,
      compareLabel,
      history: perfCardHistory("prise"),
      accent: "#00BDBB",
      icon: Timer,
      featured: false,
    },
    {
      key: "cycle",
      label: "Cycle de traitement",
      value: days(current.cycleMedian),
      hint: `Médiane depuis ${cycleStart === "prise" ? "la sortie de salle d'attente" : "la date d'identification"} · ${plural(current.cycleN, "clôture mesurée", "clôtures mesurées")}`,
      detail:
        cycleStart === "identification"
          ? `9e décile ${days(current.cycleP90)}. Hors médiane : ${current.cycleExcludedNoStart} sans date d'identification, ${current.cycleExcludedInverted} identification après la clôture.`
          : current.cycleP90 == null
            ? undefined
            : `9e décile ${current.cycleP90} j`,
      note: cycleDecileDetail(current, cycleStart),
      delta:
        current.cycleMedian == null || previous.cycleMedian == null
          ? null
          : current.cycleMedian - previous.cycleMedian,
      unit: "j" as const,
      lowerBetter: true,
      deltaScope: "médiane",
      reference: ref?.cycle,
      compareLabel,
      history: perfCardHistory("cycle"),
      accent: "#1d4ed8",
      icon: Hourglass,
      featured: false,
    },
    {
      key: "stock",
      label: "Stock échu",
      value: String(current.stockOverdue),
      hint: "Actions ouvertes en retard à la date de fin, toutes échéances confondues",
      detail: `${pct(current.stockPct)} des ${current.stockOpen} ouvertes datées`,
      delta:
        current.stockPct == null || previous.stockPct == null
          ? null
          : current.stockPct - previous.stockPct,
      unit: "pts" as const,
      lowerBetter: true,
      reference: ref?.stock,
      history: perfCardHistory("stock"),
      historyNote:
        "Le retard se lit avec les échéances actualisées d'aujourd'hui.",
      accent: "#b45309",
      icon: Gauge,
      featured: false,
    },
    {
      key: "glide",
      label: "Échéances reportées",
      value: pct(current.glidePct),
      hint: "Échéance actualisée postérieure à l'échéance initiale — photographie actuelle",
      detail: `${current.glide} échéances reportées / ${current.due} dues`,
      delta:
        current.glidePct == null || previous.glidePct == null
          ? null
          : current.glidePct - previous.glidePct,
      unit: "pts" as const,
      lowerBetter: true,
      reference: ref?.glide,
      history: perfCardHistory("glide"),
      historyNote:
        "Ce n'est pas le flux des reports intervenus pendant la période.",
      accent: "#9f1239",
      icon: UnfoldHorizontal,
      featured: false,
    },
  ];
}

const ORIGIN_LABEL: Record<MedianOrigin, string> = {
  creation: "Date de création",
  identification: "Date d'identification",
};

function frDecimal(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

function rateWork(numerator: number, denominator: number): string {
  if (denominator <= 0) return "Aucune base : le taux n'est pas calculé.";
  const raw = (numerator / denominator) * 100;
  return `${numerator} ÷ ${denominator} = ${frDecimal(raw)} %, arrondi = ${Math.round(raw)} %.`;
}

function numericCalculs(rows: PerfEvidenceRow[]): number[] | null {
  const values: number[] = [];
  for (const row of rows) {
    const match = /^(\d+) j$/.exec(row.calcul);
    if (!match) return null;
    values.push(Number(match[1]));
  }
  return values;
}

function medianWork(values: number[]): string {
  if (!values.length) return "Aucun délai : la médiane n'est pas calculée.";
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2) {
    return `Effectif ${sorted.length}, impair. Les délais du tableau sont triés du plus court au plus long. Valeur centrale, position ${mid + 1} : ${sorted[mid]} j. Médiane = ${sorted[mid]} j.`;
  }
  const left = sorted[mid - 1];
  const right = sorted[mid];
  const mean = (left + right) / 2;
  return `Effectif ${sorted.length}, pair. Les délais du tableau sont triés du plus court au plus long. Valeurs centrales, positions ${mid} et ${mid + 1} : ${left} j et ${right} j. (${left} + ${right}) / 2 = ${frDecimal(mean)}, arrondi à l'entier le plus proche = ${Math.round(mean)} j.`;
}

function decileWork(values: number[]): string {
  if (!values.length) return "Aucun délai : le 9e décile n'est pas calculé.";
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * 0.9) - 1)
  );
  return `9e décile : position ceil(${sorted.length} × 0,9) = ${index + 1} sur les délais triés. Valeur = ${sorted[index]} j. 90 % des clôtures mesurées ont duré au plus cette valeur.`;
}

function snapshotText(origin: MedianOrigin, snap: PriseOriginSnapshot): string {
  const base = `${ORIGIN_LABEL[origin]} : médiane ${days(snap.median)} sur ${plural(snap.n, "sortie mesurée", "sorties mesurées")}.`;
  if (origin === "creation") {
    return `${base} Une création postérieure à la prise en charge compte 0 jour et reste dans la médiane.`;
  }
  return `${base} Hors médiane : ${plural(snap.excludedMissing, "sortie sans date d'identification", "sorties sans date d'identification")}, ${plural(snap.excludedInverted, "identification postérieure à la prise en charge", "identifications postérieures à la prise en charge")}.`;
}

function impactText(
  active: MedianOrigin,
  origins: Record<MedianOrigin, PriseOriginSnapshot>
): string {
  const other: MedianOrigin = active === "creation" ? "identification" : "creation";
  const shown = origins[active];
  const alternate = origins[other];
  const otherName = ORIGIN_LABEL[other].toLowerCase();
  if (shown.median == null && alternate.median == null) {
    return "Aucune des deux origines n'a de sortie mesurée sur cette population.";
  }
  if (alternate.median == null) {
    return `Avec la ${otherName}, la médiane n'est pas calculée : aucune sortie mesurée ne reste.`;
  }
  if (shown.median == null) {
    return `Le mode affiché n'a pas de médiane. Avec la ${otherName}, elle serait ${days(alternate.median)} sur ${plural(alternate.n, "sortie mesurée", "sorties mesurées")}.`;
  }
  const gap = alternate.median - shown.median;
  const level =
    gap === 0
      ? "égale"
      : `${gap > 0 ? "plus élevée" : "plus basse"} de ${Math.abs(gap)} j`;
  const volume =
    shown.n === alternate.n
      ? `sur le même nombre de sorties (${shown.n})`
      : `sur ${alternate.n} sorties au lieu de ${shown.n}`;
  return `Avec la ${otherName}, la médiane serait ${level}, ${volume}.`;
}

const CYCLE_LABEL: Record<CycleStart, string> = {
  prise: "Sortie de salle d'attente",
  identification: "Date d'identification",
};

function perfHref(
  data: RaidPerformancePayload,
  origin: MedianOrigin,
  cycleStart: CycleStart
): string {
  const search = withPerfSearch(data.window.search, origin, cycleStart);
  return search ? `${data.screen.basePath}?${search}` : data.screen.basePath;
}

function cycleSnapshotText(start: CycleStart, snap: CycleStartSnapshot): string {
  const base = `${CYCLE_LABEL[start]} : médiane ${days(snap.median)}, 9e décile ${days(snap.p90)}, sur ${plural(snap.n, "clôture mesurée", "clôtures mesurées")}.`;
  if (start === "prise") {
    return `${base} ${plural(snap.excludedNoStart, "clôture de la période n'a pas de sortie de salle d'attente", "clôtures de la période n'ont pas de sortie de salle d'attente")}.`;
  }
  return `${base} Hors médiane : ${plural(snap.excludedNoStart, "clôture sans date d'identification", "clôtures sans date d'identification")}, ${plural(snap.excludedInverted, "identification postérieure à la clôture", "identifications postérieures à la clôture")}.`;
}

function cycleImpactText(
  active: CycleStart,
  starts: Record<CycleStart, CycleStartSnapshot>
): string {
  const other: CycleStart = active === "prise" ? "identification" : "prise";
  const shown = starts[active];
  const alternate = starts[other];
  const otherName = CYCLE_LABEL[other].toLowerCase();
  if (shown.median == null && alternate.median == null) {
    return "Aucune des deux lectures n'a de clôture mesurée sur cette population.";
  }
  if (alternate.median == null) {
    return `Avec ${otherName}, la médiane n'est pas calculée : aucune clôture mesurée ne reste.`;
  }
  if (shown.median == null) {
    return `Le mode affiché n'a pas de médiane. Avec ${otherName}, elle serait ${days(alternate.median)} sur ${plural(alternate.n, "clôture mesurée", "clôtures mesurées")}.`;
  }
  const gap = alternate.median - shown.median;
  const level =
    gap === 0
      ? "égale"
      : `${gap > 0 ? "plus élevée" : "plus basse"} de ${Math.abs(gap)} j`;
  const volume =
    shown.n === alternate.n
      ? `sur le même nombre de clôtures (${shown.n})`
      : `sur ${alternate.n} clôtures au lieu de ${shown.n}`;
  return `Avec ${otherName}, la médiane serait ${level}, ${volume}. Le 9e décile serait ${days(alternate.p90)}.`;
}

function ModeSwitch<T extends string>({
  label,
  value,
  options,
  hrefFor,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  hrefFor: (id: T) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Button
            key={option.id}
            size="sm"
            variant={active ? "default" : "outline"}
            className={active ? "bg-[#0A3C74] hover:bg-[#0c4a8f]" : ""}
            aria-current={active ? "page" : undefined}
            asChild
          >
            <Link href={hrefFor(option.id)}>{option.label}</Link>
          </Button>
        );
      })}
    </div>
  );
}

function ModesControl({ data }: { data: RaidPerformancePayload }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold text-primary">Modes de calcul</h2>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            Origine de la médiane de prise en charge
          </h3>
          <ModeSwitch
            label="Origine du délai de prise en charge"
            value={data.medianOrigin}
            options={[
              { id: "creation", label: "Date de création" },
              { id: "identification", label: "Date d'identification" },
            ]}
            hrefFor={(origin) => perfHref(data, origin, data.cycleStart)}
          />
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {(["creation", "identification"] as const).map((origin) => {
            const active = data.medianOrigin === origin;
            return (
              <p
                key={origin}
                className={
                  active
                    ? "rounded-lg border border-[#0A3C74]/30 bg-[#0A3C74]/5 px-3 py-2 text-xs leading-relaxed text-foreground"
                    : "rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                }
              >
                <span className="font-medium text-foreground">
                  {active ? "Mode affiché. " : "Autre mode. "}
                </span>
                {snapshotText(origin, data.priseOrigins[origin])}
              </p>
            );
          })}
        </div>
        <p className="text-xs text-foreground">
          {impactText(data.medianOrigin, data.priseOrigins)}
        </p>
        <InfoNote>
          <p>
            Ce choix s&apos;applique à la médiane de prise en charge, à
            l&apos;écart de cette carte et à la couleur « prise en charge » de
            la heatmap. La tenue de l&apos;engagement, le cycle de traitement, le stock échu et les échéances reportées ne changent pas avec ce choix.
          </p>
          <p>
            {`L'écart sous la carte compare la période précédente de même durée, ${data.window.compareLabel}, calculée avec la même origine.`}
          </p>
          <p>Cliquer le chiffre d&apos;une carte ouvre les entrées RAID de ce calcul.</p>
        </InfoNote>
      </div>
      <div className="space-y-2 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-foreground">Cycle de traitement</h3>
          <ModeSwitch
            label="Départ du cycle de traitement"
            value={data.cycleStart}
            options={[
              { id: "prise", label: "Sortie de salle d'attente" },
              { id: "identification", label: "Date d'identification" },
            ]}
            hrefFor={(start) => perfHref(data, data.medianOrigin, start)}
          />
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {(["prise", "identification"] as const).map((start) => {
            const active = data.cycleStart === start;
            return (
              <p
                key={start}
                className={
                  active
                    ? "rounded-lg border border-[#0A3C74]/30 bg-[#0A3C74]/5 px-3 py-2 text-xs leading-relaxed text-foreground"
                    : "rounded-lg border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                }
              >
                <span className="font-medium text-foreground">
                  {active ? "Mode affiché. " : "Autre mode. "}
                </span>
                {cycleSnapshotText(start, data.cycleStarts[start])}
              </p>
            );
          })}
        </div>
        <p className="text-xs text-foreground">
          {cycleImpactText(data.cycleStart, data.cycleStarts)}
        </p>
        <InfoNote>
          <p>
            Les deux modes comptent les actions clôturées dont la clôture tombe
            dans la période. L&apos;arrivée est la date de fin réelle, ou le
            dernier passage à Clôturé dans le journal si l&apos;action est
            encore clôturée.
          </p>
          <p>
            Sortie de salle d&apos;attente : du premier statut hors A planifier,
            Planifié et A lancer jusqu&apos;à la clôture. Sans cette sortie, la
            ligne ne compte pas.
          </p>
          <p>
            Date d&apos;identification : de ce jour jusqu&apos;à la clôture,
            sans la salle d&apos;attente ni la date de création. Une
            identification absente, ou postérieure à la clôture, sort du
            calcul.
          </p>
          <p>
            Ce choix suit la carte Cycle, son écart et la colonne cycle de la
            heatmap. Il est indépendant du mode de prise en charge. La tenue, le stock échu et les échéances reportées ne changent pas avec ce choix.
          </p>
        </InfoNote>
      </div>
    </section>
  );
}

function cardCopy(
  card: PerfCardKey,
  data: RaidPerformancePayload,
  current: PerfStats,
  rows: PerfEvidenceRow[]
): { title: string; intro: string; sums: string[] } {
  const scope = data.detail
    ? `Équipe ${data.detail.team.label}`
    : "Vue programme";
  const period = `${scope}. Période ${data.window.label}. ${plural(rows.length, "ligne", "lignes")}.`;
  if (card === "tenue") {
    const held = rows.filter((row) => row.calcul === "Tenue").length;
    return {
      title: "Tenue de l'engagement",
      intro: `${period} Une action est due lorsque son échéance initiale tombe dans la période et que cette journée est écoulée, ou que son statut est déjà terminal. Elle est tenue lorsque le statut est Clôturé et que le jour de clôture est au plus tard l'échéance initiale. Les abandons, les clôtures sans date de fin et les autres écarts restent au dénominateur.`,
      sums: [
        `Calcul : ${rateWork(current.held, current.due)} Chiffre de la carte : ${pct(current.tenuePct)}.`,
        `Recomptage du tableau : ${held} lignes « Tenue » sur ${rows.length}.`,
        "Dates utilisées : échéance initiale et clôture. La colonne Calcul classe chaque ligne : Tenue, Abandonnée, Sans date de fin ou Autre écart.",
      ],
    };
  }
  if (card === "prise") {
    const delays = numericCalculs(rows);
    const originName =
      data.medianOrigin === "creation" ? "la date de création" : "la date d'identification";
    const rule =
      data.medianOrigin === "creation"
        ? "Le délai part de la date de création. Une création postérieure à la prise en charge compte 0 jour et reste dans la médiane."
        : "Le délai part de la date d'identification. Une sortie sans date d'identification est exclue. Une identification postérieure au jour de prise en charge est exclue : elle ne compte pas 0 jour.";
    return {
      title: "Prise en charge",
      intro: `${period} La prise en charge est le premier jour du journal hors salle d'attente (hors A planifier, Planifié et A lancer), lorsque ce jour appartient à la période. Le délai est le nombre de jours calendaires entre ${originName} et ce jour. ${rule}`,
      sums: [
        delays
          ? `Calcul : ${medianWork(delays)} Chiffre de la carte : ${days(current.priseMedian)}.`
          : `Calcul : médiane de ${current.priseN} délais = ${days(current.priseMedian)}.`,
        data.medianOrigin === "identification"
          ? `Hors tableau, donc hors médiane : ${current.priseExcludedMissing} sans date d'identification, ${current.priseExcludedInverted} identification après la prise en charge.`
          : "Les lignes à 0 jour incluent les créations postérieures à la prise en charge.",
        impactText(data.medianOrigin, data.priseOrigins),
        "Dates utilisées : l'origine choisie et le jour de prise en charge. La colonne Calcul est le délai de la ligne, en jours calendaires.",
      ],
    };
  }
  if (card === "cycle") {
    const delays = numericCalculs(rows);
    const fromIdentification = data.cycleStart === "identification";
    const rule = fromIdentification
      ? "Le délai part de la date d'identification. Une clôture sans date d'identification est exclue. Une identification postérieure à la clôture est exclue : elle ne compte pas 0 jour."
      : "Le délai part de la sortie de salle d'attente, le premier statut hors A planifier, Planifié et A lancer. Sans cette sortie, la ligne ne compte pas. Un écart négatif compte 0 jour.";
    return {
      title: "Cycle de traitement",
      intro: `${period} Le cycle est le nombre de jours calendaires jusqu'au jour de clôture, pour les actions au statut Clôturé dont la clôture tombe dans la période. ${rule} 0 jour signifie que le départ et la clôture tombent le même jour calendaire.`,
      sums: [
        delays
          ? `Calcul : ${medianWork(delays)} Chiffre de la carte : ${days(current.cycleMedian)}.`
          : `Calcul : médiane de ${current.cycleN} délais = ${days(current.cycleMedian)}.`,
        delays ? decileWork(delays) : "Aucun délai : le 9e décile n'est pas calculé.",
        "L'écart sous la carte compare la médiane, pas ce décile.",
        fromIdentification
          ? `Hors tableau : ${current.cycleExcludedNoStart} sans date d'identification, ${current.cycleExcludedInverted} identification après la clôture.`
          : `Hors tableau : ${current.cycleExcludedNoStart} clôtures sans sortie de salle d'attente.`,
        cycleImpactText(data.cycleStart, data.cycleStarts),
        fromIdentification
          ? "Dates utilisées : date d'identification et clôture."
          : "Dates utilisées : prise en charge et clôture. La colonne Calcul est le délai de la ligne.",
      ],
    };
  }
  if (card === "stock") {
    const onTime = Math.max(0, current.stockOpen - current.stockOverdue);
    return {
      title: "Stock échu",
      intro: `${period} Le chiffre de la carte est le nombre d'actions encore ouvertes à la date de fin, avec une échéance datée dont la fin de journée est antérieure à l'instant de lecture. L'échéance retenue est l'échéance actualisée lorsqu'elle existe, sinon l'échéance initiale. Ce calcul est le même pour les deux origines de la médiane de prise en charge.`,
      sums: [
        `Calcul : ${current.stockOverdue} actions en retard. Part du stock daté : ${rateWork(current.stockOverdue, current.stockOpen)}`,
        `Le tableau liste ces ${rows.length} actions en retard. Les ${onTime} actions ouvertes datées qui ne sont pas en retard entrent dans le dénominateur du pourcentage et n'apparaissent pas dans le tableau.`,
        "Dates utilisées : échéance initiale, échéance actualisée et échéance retenue.",
      ],
    };
  }
  const reported = rows.filter((row) => row.calcul === "Reportée").length;
  return {
    title: "Échéances reportées",
    intro: `${period} Parmi les actions dues de la tenue, une échéance est reportée lorsque l'échéance actualisée est postérieure à l'échéance initiale. C'est la photographie actuelle des dates. Ce calcul est le même pour les deux origines de la médiane de prise en charge.`,
    sums: [
      `Calcul : ${rateWork(current.glide, current.due)} Chiffre de la carte : ${pct(current.glidePct)}.`,
      `Recomptage du tableau : ${reported} lignes « Reportée » sur ${rows.length}.`,
      "Dates utilisées : échéance initiale et échéance actualisée. La colonne Calcul indique Reportée ou Non reportée.",
    ],
  };
}

/** Le tableau tient dans la popup : largeurs en % et texte qui revient à la ligne. */
function evidenceColumnWidths(dateCount: number): string[] {
  const date = dateCount >= 3 ? 8 : 9;
  const parts = [8, 0, 12, 13, 9];
  for (let index = 0; index < dateCount; index += 1) parts.push(date);
  parts.push(12);
  const used = parts.reduce((sum, value) => sum + value, 0);
  parts[1] = 100 - used;
  return parts.map((value) => `${value}%`);
}

const EVIDENCE_CELL =
  "whitespace-normal break-words px-2 py-2 align-top text-xs leading-snug";

function EvidenceDialog({
  card,
  data,
  current,
  onClose,
}: {
  card: PerfCardKey;
  data: RaidPerformancePayload;
  current: PerfStats;
  onClose: () => void;
}) {
  const rows = data.evidence[card];
  const copy = cardCopy(card, data, current, rows);
  const dateLabels = rows[0]?.dates.map((date) => date.label) ?? [];
  const columnCount = 5 + dateLabels.length + 1;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[min(88vh,52rem)] flex-col gap-3 overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-primary">{copy.title}</DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed">
            {copy.intro}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 text-xs leading-relaxed text-foreground">
          {copy.sums.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden rounded-md border">
          <table className="w-full table-fixed border-collapse text-xs min-w-0">
            <colgroup>
              {evidenceColumnWidths(dateLabels.length).map((width, index) => (
                <col key={`${width}-${index}`} style={{ width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 border-b bg-background">
              <tr>
                {["Code", "Intitulé", "Équipe", "Responsable", "Statut", ...dateLabels, "Calcul"].map(
                  (label) => (
                    <th
                      key={label}
                      className="px-2 py-2 text-left align-bottom text-xs font-medium leading-tight break-words text-foreground"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-2 py-10 text-center text-muted-foreground"
                  >
                    Aucune entrée n&apos;entre dans ce calcul.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className={EVIDENCE_CELL}>
                      <Link
                        href={`/raid/${row.id}`}
                        className="font-medium break-all text-primary hover:underline"
                      >
                        {row.code}
                      </Link>
                    </td>
                    <td className={EVIDENCE_CELL}>{row.intitule}</td>
                    <td className={EVIDENCE_CELL}>{row.teamLabel}</td>
                    <td className={EVIDENCE_CELL}>{row.responsable}</td>
                    <td className={EVIDENCE_CELL}>{row.statut}</td>
                    {dateLabels.map((label) => (
                      <td key={label} className={`${EVIDENCE_CELL} tabular-nums`}>
                        {row.dates.find((date) => date.label === label)?.value ?? "—"}
                      </td>
                    ))}
                    <td className={`${EVIDENCE_CELL} tabular-nums`}>{row.calcul}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RaidPerformanceScreen({ data }: { data: RaidPerformancePayload }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(
    null
  );
  const [filter, setFilter] = useState<PerfActionFlag>("due");
  const [openCard, setOpenCard] = useState<PerfCardKey | null>(null);
  const detail = data.detail;
  const current = detail ? detail.team : data.programme;
  const previous = detail ? detail.previous : data.previous;
  const cards = kpiModel(
    current,
    previous,
    detail ? data.programme : null,
    data.window.compareLabel,
    data.medianOrigin,
    data.cycleStart
  );
  const actions = detail?.actions ?? [];
  const visible = actions.filter((row) => row.flags.includes(filter));

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) {
        return { key, dir: key === "label" ? "asc" : "desc" };
      }
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  function teamHref(id: string) {
    const search = withPerfSearch(
      data.window.search,
      data.medianOrigin,
      data.cycleStart
    );
    return `/raid/performance/${id}?${search}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-[90rem] space-y-6 p-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 h-8 gap-1 px-0" asChild>
            <Link href={data.screen.backHref}>
              <ArrowLeft className="size-4" />
              {data.screen.backLabel}
            </Link>
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
                {data.screen.kicker}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-primary">
                {data.screen.heading}
              </h1>
              <InfoNote>
                <p>
                  Prise en charge, tenue de l&apos;engagement initial et délai de
                  traitement. L&apos;échéance actualisée mesure les reports, elle
                  ne dit pas qu&apos;une équipe est à l&apos;heure.
                </p>
              </InfoNote>
            </div>
            {detail ? null : (
              <Button variant="outline" className="shrink-0" asChild>
                <Link href="/raid/performance/previsions">Prévisions des engagements</Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card p-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => {
              const active = data.window.preset === preset.id;
              return (
                <Button
                  key={preset.id}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={active ? "bg-[#0A3C74] hover:bg-[#0c4a8f]" : ""}
                  asChild
                >
                  <Link
                    href={`${data.screen.basePath}?${withPerfSearch(`preset=${preset.id}`, data.medianOrigin, data.cycleStart)}`}
                  >
                    {preset.label}
                  </Link>
                </Button>
              );
            })}
          </div>
          <form
            key={`${data.window.startDay}-${data.window.endDay}`}
            action={data.screen.basePath}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="preset" value="custom" />
            {data.medianOrigin === "identification" ? (
              <input type="hidden" name="origine" value="identification" />
            ) : null}
            {data.cycleStart === "identification" ? (
              <input type="hidden" name="cycle" value="identification" />
            ) : null}
            <CalendarRange className="size-4 text-[#00BDBB]" />
            <input
              type="date"
              name="from"
              required
              defaultValue={data.window.startDay}
              aria-label="Début"
              className="h-8 rounded-md border bg-background px-2 text-sm"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              name="to"
              required
              defaultValue={data.window.endDay}
              aria-label="Fin"
              className="h-8 rounded-md border bg-background px-2 text-sm"
            />
            <Button type="submit" size="sm" variant="outline">
              Appliquer
            </Button>
          </form>
          <div className="w-full space-y-1 text-xs leading-relaxed text-muted-foreground">
            <p>
              Période affichée : {data.window.label}.
              {data.window.preset === "365"
                ? " 365 jours glissants, jusqu'à aujourd'hui."
                : ""}
            </p>
            <p className="text-foreground">
              Comparaison avec la période précédente de même durée :{" "}
              {data.window.compareLabel}.
            </p>
            <InfoNote>
              {data.window.preset === "quarter" ? (
                <p>
                  Le trimestre civil court de son premier jour jusqu&apos;à
                  aujourd&apos;hui. La comparaison reprend la période
                  immédiatement précédente, du même nombre de jours. Elle ne
                  reprend pas le trimestre civil précédent.
                </p>
              ) : null}
              <p>
                Note de méthode. Les valeurs de la période précédente sont
                recalculées à partir des informations actuellement disponibles.
                Elles ne constituent pas une photographie historique figée. Les
                changements de statut et les reports d&apos;échéance intervenus
                depuis peuvent modifier certaines valeurs.
              </p>
              <p>
                Une équipe reste grise sous {RAID_PERF_MIN_DUE} actions dues :
                volume insuffisant, pas une performance moyenne. Le vert et le
                rouge se lisent contre la médiane de ces équipes.
              </p>
            </InfoNote>
          </div>
        </div>

        <ModesControl data={data} />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(({ key, unit, ...card }) => (
            <KpiCard
              key={key}
              deltaUnit={unit}
              {...card}
              onOpen={() => setOpenCard(key)}
            />
          ))}
        </div>
        {openCard ? (
          <EvidenceDialog
            card={openCard}
            data={data}
            current={current}
            onClose={() => setOpenCard(null)}
          />
        ) : null}
        <QualityNote stats={current} />

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-primary">
              Activité et respect des engagements
            </h2>
            <InfoNote>
              <p>
                Les barres comptent des événements datés. La courbe mesure la
                tenue des engagements dont l&apos;échéance initiale appartient au
                seau.
                {data.trendMode === "equipe"
                  ? " Courbe ambre : l'équipe. Courbe marine : le programme."
                  : ""}
              </p>
            </InfoNote>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" strokeOpacity={0.35} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis yAxisId="n" allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                <YAxis
                  yAxisId="r"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  width={36}
                  unit=" %"
                />
                <Tooltip
                  formatter={(value, name) => {
                    const label = String(name);
                    if (label.startsWith("Tenue")) {
                      return [value == null ? "—" : `${value} %`, label];
                    }
                    return [value ?? 0, label];
                  }}
                />
                <Legend />
                <Bar yAxisId="n" dataKey="opened" name="Créées" fill="#0A3C74" radius={[3, 3, 0, 0]} />
                <Bar
                  yAxisId="n"
                  dataKey="closedOnTime"
                  name="Clôturées tenues"
                  fill="#00BDBB"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="r"
                  dataKey="tenue"
                  name={
                    data.trendMode === "equipe"
                      ? "Tenue équipe"
                      : "Tenue des échéances"
                  }
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                {data.trendMode === "equipe" ? (
                  <Line
                    yAxisId="r"
                    dataKey="benchmark"
                    name="Tenue programme"
                    stroke="#0A3C74"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>

        {detail ? (
          <>
            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h2 className="text-sm font-semibold text-primary">Responsables</h2>
                <InfoNote>
                  <p>
                    Même lecture que les équipes. Gris sous {RAID_PERF_MIN_DUE}{" "}
                    actions dues : le taux n&apos;est pas interprétable.
                  </p>
                </InfoNote>
              </div>
              <div className="overflow-x-auto">
                <GroupTable
                  rows={detail.responsables}
                  sort={sort}
                  onSort={toggleSort}
                  showTenueVolume
                />
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border bg-card">
              <div className="space-y-3 border-b px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-primary">Actions</h2>
                  <InfoNote>
                    <p>
                      Dues : engagement de la fenêtre. Autres écarts : engagements non tenus, hors abandons et clôtures sans date de fin. Stock échu : encore ouvertes en retard à la date de fin, même si l&apos;échéance est plus ancienne.
                    </p>
                  </InfoNote>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map((item) => {
                    const count = actions.filter((row) =>
                      row.flags.includes(item.id)
                    ).length;
                    const active = filter === item.id;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        size="sm"
                        variant={active ? "default" : "outline"}
                        className={active ? "bg-[#0A3C74] hover:bg-[#0c4a8f]" : ""}
                        onClick={() => setFilter(item.id)}
                      >
                        {item.label}
                        <span className="tabular-nums opacity-80">{count}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Intitulé</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Échéance initiale</TableHead>
                      <TableHead>Échéance actualisée</TableHead>
                      <TableHead>Retard</TableHead>
                      <TableHead>Âge</TableHead>
                      <TableHead>Dernier mouvement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                          Aucune action dans ce filtre.
                        </TableCell>
                      </TableRow>
                    ) : (
                      visible.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Link
                              href={`/raid/${row.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {row.code}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-md whitespace-normal text-sm">
                            {row.intitule}
                          </TableCell>
                          <TableCell className="text-sm">{row.responsable}</TableCell>
                          <TableCell className="text-xs">{row.statut}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs tabular-nums">
                            {showDay(row.initiale)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs tabular-nums">
                            {showDay(row.actualisee)}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {days(row.delayDays)}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {row.ageDays} j
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs tabular-nums">
                            {showDay(row.lastMoveDay)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        ) : (
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-primary">
                  Heatmap des équipes chantier
                </h2>
                <p className="text-xs text-muted-foreground">
                  base : tenue {pct(data.colorMedian.tenue)}, prise en charge{" "}
                  {days(data.colorMedian.prise)}, cycle {days(data.colorMedian.cycle)},
                  stock échu {pct(data.colorMedian.stock)}, échéances reportées{" "}
                  {pct(data.colorMedian.glide)}.
                </p>
                <InfoNote>
                  <p>
                    Vert : mieux que la médiane des équipes mesurables. Rouge :
                    moins bien. Égalité : neutre, sans couleur. Gris : volume
                    insuffisant, moins de {RAID_PERF_MIN_DUE} actions dues. Le
                    gris n&apos;est pas une performance moyenne. Cliquer une
                    équipe ouvre son détail.
                  </p>
                </InfoNote>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-950 dark:text-emerald-50">
                  Au-dessus
                </span>
                <span className="rounded bg-rose-500/15 px-2 py-0.5 text-rose-950 dark:text-rose-50">
                  En dessous
                </span>
                <span className="rounded border bg-muted px-2 py-0.5">
                  Gris : volume insuffisant
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <GroupTable
                rows={data.teams}
                hrefFor={teamHref}
                sort={sort}
                onSort={toggleSort}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
