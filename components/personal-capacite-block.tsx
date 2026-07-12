"use client";

import { useState } from "react";
import { getPersonalCapacite } from "@/app/(app)/actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import {
  getRAGColor,
  getRAGStatus,
  MOIS_LABELS,
  RAG_COLORS,
  RAG_LABELS,
} from "@/lib/capacite-labels";

export type PersonalCapaciteData = NonNullable<
  Awaited<ReturnType<typeof getPersonalCapacite>>
>;

const YEAR_MIN = 2026;
const YEAR_MAX = 2030;

export function PersonalCapaciteBlock({
  initialData,
  initialYear,
}: {
  initialData: PersonalCapaciteData | null;
  initialYear: number;
}) {
  const [data, setData] = useState(initialData);
  const [year, setYear] = useState(initialYear);
  const [loading, setLoading] = useState(false);

  async function changeYear(newYear: number) {
    if (newYear < YEAR_MIN || newYear > YEAR_MAX) return;
    setLoading(true);
    setYear(newYear);
    try {
      const next = await getPersonalCapacite(newYear);
      setData(next);
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-[#00BDBB]" />
          <h2 className="text-lg font-semibold">Capacité</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucune ressource liée — la capacité personnelle n&apos;est pas
            disponible.
          </CardContent>
        </Card>
      </section>
    );
  }

  const status = getRAGStatus(data.currentCharge);
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-5 text-[#00BDBB]" />
        <h2 className="text-lg font-semibold">Capacité</h2>
      </div>

      {/* Summary KPIs — same RAG labels as Capacité page */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold tabular-nums">
              {data.capacite}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                j/mois
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Capacité nominale</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div
              className="text-2xl font-bold tabular-nums"
              style={{ color: getRAGColor(data.avgCharge) }}
            >
              {data.avgCharge}%
            </div>
            <p className="text-xs text-muted-foreground">
              Charge moyenne {year}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div
              className="text-2xl font-bold tabular-nums"
              style={{
                color: isCurrentYear
                  ? getRAGColor(data.currentCharge)
                  : "inherit",
              }}
            >
              {isCurrentYear ? `${data.currentCharge}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Charge {MOIS_LABELS[now.getMonth()]} (cours)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div
              className="text-sm font-bold leading-snug"
              style={{
                color:
                  status === "gray"
                    ? "#6b7280"
                    : getRAGColor(data.currentCharge),
              }}
            >
              {isCurrentYear
                ? `${RAG_LABELS[status]}${
                    status === "green"
                      ? " (<80%)"
                      : status === "orange"
                        ? " (80-100%)"
                        : status === "red"
                          ? " (>100%)"
                          : ""
                  }`
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Statut RAG</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-3 text-base">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => changeYear(year - 1)}
                disabled={loading || year <= YEAR_MIN}
                aria-label="Année précédente"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[3.5rem] text-center text-lg font-bold tabular-nums">
                {year}
              </span>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => changeYear(year + 1)}
                disabled={loading || year >= YEAR_MAX}
                aria-label="Année suivante"
              >
                <ChevronRight className="size-4" />
              </Button>
            </CardTitle>
            <CardDescription className="text-xs">
              Votre charge planifiée par mois — même logique que Capacité &amp;
              Charge
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded"
                style={{ backgroundColor: RAG_COLORS.green }}
              />
              {RAG_LABELS.green} (&lt;80%)
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded"
                style={{ backgroundColor: RAG_COLORS.orange }}
              />
              {RAG_LABELS.orange} (80-100%)
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded"
                style={{ backgroundColor: RAG_COLORS.red }}
              />
              {RAG_LABELS.red} (&gt;100%)
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded"
                style={{ backgroundColor: RAG_COLORS.gray }}
              />
              {RAG_LABELS.gray}
            </span>
          </div>
        </CardHeader>
        <CardContent className={loading ? "opacity-60 pointer-events-none" : ""}>
          <TooltipProvider delayDuration={200}>
            {/* pb/pt so current-month ring is not clipped by overflow */}
            <div className="overflow-x-hidden overflow-y-visible px-0.5 pb-1.5 pt-0.5">
              <div className="grid grid-cols-12 gap-1">
                {data.months.map((m) => {
                  const st = getRAGStatus(m.charge_pct);
                  const isCurrent =
                    isCurrentYear && m.mois === now.getMonth() + 1;
                  return (
                    <div key={m.mois} className="min-w-0 text-center">
                      <div className="mb-1 truncate text-[9px] text-muted-foreground">
                        {MOIS_LABELS[m.mois - 1]}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`cursor-default rounded py-1.5 text-[10px] font-bold tabular-nums transition-colors hover:brightness-110 ${
                              isCurrent
                                ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                                : ""
                            }`}
                            style={{
                              backgroundColor: getRAGColor(m.charge_pct),
                              color: st === "gray" ? "#6b7280" : "white",
                            }}
                          >
                            {m.charge_pct > 0 ? `${m.charge_pct}%` : "—"}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          <p className="font-bold">
                            {MOIS_LABELS[m.mois - 1]} {year}
                          </p>
                          <p>
                            {RAG_LABELS[st]} — charge {m.charge_pct}%
                          </p>
                          <p>Planifié : {m.jours_planifies} j</p>
                          <p>Travaillé : {m.jours_travailles} j</p>
                          {m.chantiers.length > 0 && (
                            <p className="mt-1 text-muted-foreground">
                              {m.chantiers
                                .map(
                                  (c) =>
                                    `${c.code} (${c.charge_pourcentage}%)`
                                )
                                .join(", ")}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                      {m.jours_travailles > 0 && (
                        <div className="mt-0.5 text-[9px] text-muted-foreground">
                          {m.jours_travailles}j saisis
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TooltipProvider>
        </CardContent>
      </Card>
    </section>
  );
}
