"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatRisqueLienLabel } from "@/lib/raid-labels";

const NONE = "__none__";

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export type RisqueLienOption = {
  id: string;
  code: string | null;
  intitule: string;
};

export function RisqueLienSelect({
  risques,
  value,
  onChange,
  noneValue = NONE,
  placeholder = "Aucun",
  disabled = false,
}: {
  risques: RisqueLienOption[];
  value: string;
  onChange: (next: string) => void;
  noneValue?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = risques.find((r) => r.id === value);
  const selectedLabel = selected
    ? formatRisqueLienLabel(selected.code, selected.intitule)
    : null;

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return risques;
    return risques.filter((r) => {
      const hay = normalize(`${r.code ?? ""} ${r.intitule ?? ""}`);
      return hay.includes(q);
    });
  }, [risques, query]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      modal={false}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "border-input text-foreground focus-visible:border-ring focus-visible:ring-ring/50",
            "dark:bg-input/30 dark:hover:bg-input/50",
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border bg-transparent px-3 text-sm shadow-xs",
            "transition-[color,box-shadow] outline-none focus-visible:ring-[3px] text-left",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selectedLabel && "text-muted-foreground"
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selectedLabel ?? placeholder}
          </span>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 opacity-50 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-risque-lien-picker
        align="start"
        sideOffset={4}
        className="z-[200] w-[var(--radix-popover-trigger-width)] min-w-[22rem] p-0"
      >
        <div className="relative border-b p-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par code ou intitulé…"
            className="h-8 pl-8"
          />
        </div>
        <div role="listbox" className="max-h-64 overflow-y-auto p-1">
          <button
            type="button"
            role="option"
            aria-selected={!selected}
            onClick={() => choose(noneValue)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
              !selected && "bg-primary/5"
            )}
          >
            <span className="min-w-0 flex-1 text-muted-foreground">Aucun</span>
            {!selected ? (
              <CheckIcon className="size-3.5 shrink-0 text-primary" />
            ) : null}
          </button>
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Aucun risque
            </p>
          ) : (
            filtered.map((r) => {
              const checked = r.id === value;
              const label = formatRisqueLienLabel(r.code, r.intitule);
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  title={label}
                  onClick={() => choose(r.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    checked && "bg-primary/5"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {checked ? (
                    <CheckIcon className="size-3.5 shrink-0 text-primary" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
