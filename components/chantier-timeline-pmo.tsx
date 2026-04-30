"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  PRIORITE_CHANTIER_COLORS,
} from "@/lib/chantier-labels";

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

  const months: { label: string; pos: number }[] = [];
  const d = new Date(minDate);
  d.setDate(1);
  while (d.getTime() <= maxDate) {
    months.push({
      label: format(d, "MMM yy", { locale: fr }),
      pos: ((d.getTime() - minDate) / range) * 100,
    });
    d.setMonth(d.getMonth() + 6);
  }

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
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded border-2 border-primary bg-primary/80" />
          Mes chantiers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded bg-muted-foreground/30" />
          Autres chantiers
        </span>
      </div>

      {/* Month headers */}
      <div className="flex items-center border-b pb-1 mb-1">
        <div className="w-44 shrink-0" />
        <div className="relative flex-1 h-5">
          {months.map((m, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
              style={{ left: `${m.pos}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {/* Groups */}
      {groups.map((group) => {
        const color = PRIORITE_CHANTIER_COLORS[group.priorite] ?? "#6b7280";
        const label = PRIORITE_SHORT_LABELS[group.priorite] ?? group.priorite;

        return (
          <div key={group.priorite} className="flex">
            <div
              className="w-44 shrink-0 flex items-center justify-center border-r px-2 py-1"
              style={{ backgroundColor: color + "18" }}
            >
              <span
                className="text-[11px] font-semibold leading-tight text-center"
                style={{ color }}
              >
                {label}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              {group.items.map((c) => {
                const start = new Date(c.date_debut).getTime();
                const end = new Date(c.date_fin).getTime();
                const left = ((start - minDate) / range) * 100;
                const width = Math.max(((end - start) / range) * 100, 1);

                const barColor = c.isMine ? color : "#9ca3af";
                const opacity = c.isMine ? 1 : 0.4;

                return (
                  <div key={c.code} className="relative h-7 border-b border-muted/30 last:border-b-0 bg-muted/20">
                    {months.map((m, i) => (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0 border-l border-muted/30"
                        style={{ left: `${m.pos}%` }}
                      />
                    ))}
                    <div
                      className="absolute top-1 bottom-1 rounded flex items-center overflow-hidden cursor-pointer transition-opacity hover:opacity-85 hover:ring-2 hover:ring-ring hover:ring-offset-1 ring-offset-background"
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
                      <span className="truncate px-1.5 text-[10px] font-medium text-white whitespace-nowrap">
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
