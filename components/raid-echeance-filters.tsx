"use client";

import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RaidEcheanceFilter = "" | "week" | "next";

const idle = {
  overdue:
    "border-red-600 bg-transparent text-red-700 shadow-none hover:bg-red-50 hover:text-red-800 dark:border-red-400 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/40 dark:hover:text-red-200",
  week: "border-amber-500 bg-transparent text-amber-700 shadow-none hover:bg-amber-50 hover:text-amber-800 dark:border-amber-400 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-950/40 dark:hover:text-amber-200",
  next: "border-sky-500 bg-transparent text-sky-700 shadow-none hover:bg-sky-50 hover:text-sky-800 dark:border-sky-400 dark:bg-transparent dark:text-sky-300 dark:hover:bg-sky-950/40 dark:hover:text-sky-200",
} as const;

const active = {
  overdue:
    "border-red-600 bg-red-600 text-white shadow-none hover:bg-red-700 hover:text-white dark:border-red-500 dark:bg-red-600 dark:text-white dark:hover:bg-red-500",
  week: "border-amber-500 bg-amber-500 text-amber-950 shadow-none hover:bg-amber-400 hover:text-amber-950 dark:border-amber-400 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400",
  next: "border-sky-600 bg-sky-600 text-white shadow-none hover:bg-sky-700 hover:text-white dark:border-sky-500 dark:bg-sky-600 dark:text-white dark:hover:bg-sky-500",
} as const;

/** Filtres d'échéance des actions : Échues, cette semaine, semaine prochaine. Un seul actif à la fois. */
export function RaidEcheanceFilterButtons({
  overdue,
  echeance,
  onOverdueChange,
  onEcheanceChange,
}: {
  overdue: boolean;
  echeance: RaidEcheanceFilter;
  onOverdueChange: (next: boolean) => void;
  onEcheanceChange: (next: RaidEcheanceFilter) => void;
}) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={overdue}
        onClick={() => {
          onOverdueChange(!overdue);
          if (!overdue) onEcheanceChange("");
        }}
        className={cn("h-9 gap-1 text-xs", overdue ? active.overdue : idle.overdue)}
      >
        <Clock className="size-3.5" />
        Échues
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={echeance === "week"}
        onClick={() => {
          const next = echeance === "week" ? "" : "week";
          onEcheanceChange(next);
          if (next) onOverdueChange(false);
        }}
        className={cn(
          "h-9 gap-1 text-xs",
          echeance === "week" ? active.week : idle.week
        )}
      >
        <Clock className="size-3.5" />
        Cette semaine
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-pressed={echeance === "next"}
        onClick={() => {
          const next = echeance === "next" ? "" : "next";
          onEcheanceChange(next);
          if (next) onOverdueChange(false);
        }}
        className={cn(
          "h-9 gap-1 text-xs",
          echeance === "next" ? active.next : idle.next
        )}
      >
        <Clock className="size-3.5" />
        Semaine prochaine
      </Button>
    </>
  );
}
