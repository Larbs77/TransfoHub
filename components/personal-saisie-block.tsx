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
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
  getRAGColor,
  getRAGStatus,
  MOIS_LABELS,
  RAG_COLORS,
  RAG_LABELS,
} from "@/lib/capacite-labels";
import type { PersonalCapaciteData } from "@/components/personal-capacite-block";

const YEAR_MIN = 2026;
const YEAR_MAX = 2030;

/** Charge % based on days recorded in saisie vs nominal monthly capacity. */
function saisieChargePct(jours: number, capacite: number): number {
  if (capacite <= 0 || jours <= 0) return 0;
  return Math.round((jours / capacite) * 100);
}

export function PersonalSaisieBlock({
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
          <Clock className="size-5 text-[#00BDBB]" />
          <h2 className="text-lg font-semibold">Saisie de temps</h2>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Aucune ressource liée — les saisies de temps ne sont pas
            disponibles.
          </CardContent>
        </Card>
      </section>
    );
  }

  const totalSaisis = data.months.reduce(
    (s, m) => s + (m.jours_travailles || 0),
    0
  );
  const monthsWithSaisie = data.months.filter(
    (m) => m.jours_travailles > 0
  ).length;
  const avgMonthly =
    monthsWithSaisie > 0
      ? Math.round((totalSaisis / monthsWithSaisie) * 10) / 10
      : 0;
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const currentMonth = data.months[now.getMonth()];
  const currentSaisie = isCurrentYear
    ? currentMonth?.jours_travailles ?? 0
    : 0;
  const currentPct = saisieChargePct(currentSaisie, data.capacite);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Clock className="size-5 text-[#00BDBB]" />
        <h2 className="text-lg font-semibold">Saisie de temps</h2>
        <span className="rounded-full border border-muted-foreground/25 bg-muted/50 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Lecture seule
        </span>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Jours saisis par le Bureau Programme (PMO) — consultation uniquement,
        pas de saisie depuis cet écran.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold tabular-nums">
              {totalSaisis.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                j
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Total saisi {year}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold tabular-nums">
              {avgMonthly > 0 ? avgMonthly.toFixed(1) : "—"}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                j
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Moy. mensuelle (mois saisis)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div
              className="text-2xl font-bold tabular-nums"
              style={{
                color: isCurrentYear
                  ? getRAGColor(currentPct)
                  : undefined,
              }}
            >
              {isCurrentYear
                ? currentSaisie > 0
                  ? `${currentSaisie.toFixed(1)} j`
                  : "—"
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {MOIS_LABELS[now.getMonth()]} (cours)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="text-2xl font-bold tabular-nums">
              {data.capacite}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                j/mois
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Capacité de référence
            </p>
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
              Timeline des jours saisis (données PMO) — couleurs vs capacité
              nominale
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-3 rounded"
                style={{ backgroundColor: RAG_COLORS.green }}
              />
              {RAG_LABELS.green} (&lt;80% cap.)
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
        <CardContent
          className={`pb-4 ${loading ? "opacity-60 pointer-events-none" : ""}`}
        >
          <TooltipProvider delayDuration={200}>
            {/* Padding so current-month ring is fully visible (not clipped) */}
            <div className="overflow-x-hidden px-0.5 pb-1 pt-0.5">
              <div className="grid grid-cols-12 gap-1">
                {data.months.map((m) => {
                  const jours = m.jours_travailles || 0;
                  const pct = saisieChargePct(jours, data.capacite);
                  const st = getRAGStatus(pct);
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
                              backgroundColor: getRAGColor(pct),
                              color: st === "gray" ? "#6b7280" : "white",
                            }}
                          >
                            {jours > 0
                              ? `${
                                  jours % 1 === 0
                                    ? String(jours)
                                    : jours.toFixed(1)
                                }j`
                              : "—"}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          <p className="font-bold">
                            {MOIS_LABELS[m.mois - 1]} {year}
                          </p>
                          <p>
                            Jours saisis (PMO) :{" "}
                            <strong>{jours.toFixed(1)} j</strong>
                          </p>
                          <p>
                            Capacité : {data.capacite} j/mois
                            {jours > 0
                              ? ` → ${pct}% (${RAG_LABELS[st]})`
                              : ""}
                          </p>
                          <p className="mt-1 text-muted-foreground">
                            Lecture seule — saisie effectuée par le programme
                          </p>
                        </TooltipContent>
                      </Tooltip>
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
