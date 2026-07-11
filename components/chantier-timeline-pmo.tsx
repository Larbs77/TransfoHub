"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { TIMELINE_PRIORITE_COLORS } from "@/lib/chantier-labels";

interface TimelineItemPMO {
  id: string;
  code: string;
  nom: string;
  domaine: string;
  priorite: string;
  statut: string;
  date_debut: Date | string;
  date_fin: Date | string;
  isMine: boolean;
}

const PRIORITE_GROUP_ORDER = [
  "Pilotage Transformation",
  "Fondations techniques",
  "Briques transverses EI",
  "Briques Satellite EI",
  "Dépendante de EI",
  "Indépendante de EI",
];

const PRIORITE_SHORT_LABELS: Record<string, string> = {
  "Pilotage Transformation": "Transverse",
  "Fondations techniques": "Fondations",
  "Briques transverses EI": "Briques Transverses EI",
  "Briques Satellite EI": "Briques Satellites EI",
  "Dépendante de EI": "Couplées aux briques EI",
  "Indépendante de EI": "Indépendantes de EI",
};

/** January = cool sky; July = warm amber */
function timelineMonthLabelClass(month: number): string {
  if (month === 0) {
    return "font-semibold text-sky-600 dark:text-sky-400";
  }
  if (month === 6) {
    return "font-semibold text-amber-600 dark:text-amber-400";
  }
  return "text-muted-foreground";
}

function timelineMonthLineClass(month: number): string {
  if (month === 0) {
    return "border-l border-sky-400/45 dark:border-sky-400/35";
  }
  if (month === 6) {
    return "border-l border-amber-400/50 dark:border-amber-400/40";
  }
  return "border-l border-muted/30";
}

export function ChantierTimelinePMO({ chantierTimeline }: { chantierTimeline: TimelineItemPMO[] }) {
  const router = useRouter();

  if (chantierTimeline.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Aucun chantier à afficher
      </div>
    );
  }

  const allDates = chantierTimeline.flatMap((c) => [
    new Date(c.date_debut).getTime(),
    new Date(c.date_fin).getTime(),
  ]);
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const range = maxDate - minDate || 1;

  const months: { label: string; pos: number; month: number }[] = [];
  const d = new Date(minDate);
  d.setDate(1);
  while (d.getTime() <= maxDate) {
    months.push({
      label: format(d, "MMM yy", { locale: fr }),
      pos: ((d.getTime() - minDate) / range) * 100,
      month: d.getMonth(),
    });
    d.setMonth(d.getMonth() + 6);
  }

  const nowTs = Date.now();
  const todayPos =
    nowTs >= minDate && nowTs <= maxDate
      ? ((nowTs - minDate) / range) * 100
      : null;

  const groups: { priorite: string; items: TimelineItemPMO[] }[] = [];
  for (const p of PRIORITE_GROUP_ORDER) {
    const items = chantierTimeline.filter((c) => c.priorite === p);
    if (items.length > 0) groups.push({ priorite: p, items });
  }
  const knownSet = new Set(PRIORITE_GROUP_ORDER);
  const others = chantierTimeline.filter((c) => !knownSet.has(c.priorite));
  if (others.length > 0) groups.push({ priorite: "Autre", items: others });

  return (
    <div className="overflow-x-auto">
      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border-2 border-primary bg-primary/80" />
          Mes chantiers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-muted-foreground/30" />
          Autres chantiers
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" />
          <span className="font-medium text-sky-600 dark:text-sky-400">Janvier</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" />
          <span className="font-medium text-amber-600 dark:text-amber-400">Juillet</span>
        </span>
        {todayPos != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-px rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.7)]" />
            <span className="font-semibold text-rose-600 dark:text-rose-400">Auj.</span>
          </span>
        )}
      </div>

      {/* Month headers — dates on top, "Auj." tight below */}
      <div className="mb-0.5 flex items-end border-b pb-0.5">
        <div className="w-44 shrink-0" />
        <div className="relative h-[22px] flex-1">
          {months.map((m, i) => (
            <span
              key={i}
              className={`absolute top-0 -translate-x-1/2 text-[10px] capitalize leading-none ${timelineMonthLabelClass(m.month)}`}
              style={{ left: `${m.pos}%` }}
            >
              {m.label}
            </span>
          ))}
          {todayPos != null && (
            <span
              className="absolute top-[12px] z-10 -translate-x-1/2 text-[8px] font-semibold leading-none text-rose-600 dark:text-rose-400"
              style={{ left: `${todayPos}%` }}
              title={format(new Date(nowTs), "dd MMMM yyyy", { locale: fr })}
            >
              Auj.
            </span>
          )}
        </div>
      </div>

      {/* Groups */}
      {groups.map((group) => {
        const color =
          TIMELINE_PRIORITE_COLORS[group.priorite] ??
          TIMELINE_PRIORITE_COLORS.Autre;
        const label = PRIORITE_SHORT_LABELS[group.priorite] ?? group.priorite;

        return (
          <div key={group.priorite} className="flex">
            <div
              className="flex w-44 shrink-0 items-center justify-center border-r px-2 py-1"
              style={{ backgroundColor: color + "18" }}
            >
              <span
                className="text-center text-[11px] font-semibold leading-tight"
                style={{ color }}
              >
                {label}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              {group.items.map((c) => {
                const start = new Date(c.date_debut).getTime();
                const end = new Date(c.date_fin).getTime();
                const left = ((start - minDate) / range) * 100;
                const width = Math.max(((end - start) / range) * 100, 1);

                const barColor = c.isMine ? color : "#9ca3af";
                const opacity = c.isMine ? 1 : 0.4;

                return (
                  <div
                    key={c.code}
                    className="relative h-7 border-b border-muted/30 bg-muted/20 last:border-b-0"
                  >
                    {months.map((m, i) => (
                      <div
                        key={i}
                        className={`absolute top-0 bottom-0 ${timelineMonthLineClass(m.month)}`}
                        style={{ left: `${m.pos}%` }}
                      />
                    ))}
                    {todayPos != null && (
                      <div
                        className="pointer-events-none absolute top-0 bottom-0 z-[5] w-px bg-gradient-to-b from-rose-500 via-rose-500 to-rose-400/80 shadow-[0_0_6px_rgba(244,63,94,0.55)]"
                        style={{ left: `${todayPos}%` }}
                        title="Aujourd'hui"
                      />
                    )}
                    <div
                      className="absolute top-1 bottom-1 z-[1] flex cursor-pointer items-center overflow-hidden rounded transition-opacity hover:opacity-85 hover:ring-2 hover:ring-ring hover:ring-offset-1 ring-offset-background"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        backgroundColor: barColor,
                        opacity,
                        border: c.isMine ? "2px solid " + color : undefined,
                      }}
                      title={`${c.isMine ? "★ " : ""}${c.code} - ${c.nom}\n${format(new Date(c.date_debut), "dd/MM/yyyy", { locale: fr })} → ${format(new Date(c.date_fin), "dd/MM/yyyy", { locale: fr })}\nCliquez pour ouvrir`}
                      onClick={() => router.push(`/chantiers/${c.id}`)}
                    >
                      <span className="truncate whitespace-nowrap px-1.5 text-[10px] font-medium text-white">
                        {c.code} {c.nom}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
