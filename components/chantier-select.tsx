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

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export type ChantierSelectOption = {
  id: string;
  code: string;
  nom: string;
};

export function formatChantierSelectLabel(c: ChantierSelectOption) {
  return `${c.code} — ${c.nom}`;
}

export function ChantierSelect({
  chantiers,
  value,
  onChange,
  placeholder = "Sélectionner…",
  disabled = false,
}: {
  chantiers: ChantierSelectOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = chantiers.find((c) => c.id === value);
  const selectedLabel = selected ? formatChantierSelectLabel(selected) : null;

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return chantiers;
    return chantiers.filter((c) =>
      normalize(`${c.code} ${c.nom}`).includes(q)
    );
  }, [chantiers, query]);

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
          title={selectedLabel ?? undefined}
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
        data-chantier-picker
        align="start"
        sideOffset={4}
        className="z-[200] w-[min(36rem,calc(100vw-2rem))] min-w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="relative border-b p-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par code ou nom…"
            className="h-8 pl-8"
          />
        </div>
        <div role="listbox" className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Aucun chantier
            </p>
          ) : (
            filtered.map((c) => {
              const checked = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  title={formatChantierSelectLabel(c)}
                  onClick={() => choose(c.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    checked && "bg-primary/5"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold text-[#0A3C74] dark:text-foreground">
                      {c.code}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug whitespace-normal text-foreground/90">
                      {c.nom}
                    </span>
                  </span>
                  {checked ? (
                    <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
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

export function ChantierMultiSelect({
  chantiers,
  value,
  onChange,
  placeholder = "Sélectionner…",
  disabled = false,
  excludeId,
}: {
  chantiers: ChantierSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedSet = useMemo(() => new Set(value), [value]);

  const pool = useMemo(
    () =>
      excludeId ? chantiers.filter((c) => c.id !== excludeId) : chantiers,
    [chantiers, excludeId]
  );

  const selected = useMemo(
    () => pool.filter((c) => selectedSet.has(c.id)),
    [pool, selectedSet]
  );

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return pool;
    return pool.filter((c) => normalize(`${c.code} ${c.nom}`).includes(q));
  }, [pool, query]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(value.filter((v) => v !== id));
      return;
    }
    onChange([...value, id]);
  }

  const triggerLabel =
    selected.length === 0
      ? placeholder
      : selected.length <= 3
        ? selected.map((c) => c.code).join(", ")
        : `${selected
            .slice(0, 3)
            .map((c) => c.code)
            .join(", ")} +${selected.length - 3}`;

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
          title={
            selected.length
              ? selected.map(formatChantierSelectLabel).join("\n")
              : undefined
          }
          className={cn(
            "border-input text-foreground focus-visible:border-ring focus-visible:ring-ring/50",
            "dark:bg-input/30 dark:hover:bg-input/50",
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border bg-transparent px-3 text-sm shadow-xs",
            "transition-[color,box-shadow] outline-none focus-visible:ring-[3px] text-left",
            "disabled:cursor-not-allowed disabled:opacity-50",
            selected.length === 0 && "text-muted-foreground"
          )}
        >
          <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
          {selected.length > 0 ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold tabular-nums text-primary">
              {selected.length}
            </span>
          ) : null}
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 opacity-50 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-chantier-picker
        align="start"
        sideOffset={4}
        className="z-[200] w-[min(36rem,calc(100vw-2rem))] min-w-[var(--radix-popover-trigger-width)] p-0"
      >
        <div className="relative border-b p-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par code ou nom…"
            className="h-8 pl-8"
          />
        </div>
        <div role="listbox" className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Aucun chantier
            </p>
          ) : (
            filtered.map((c) => {
              const checked = selectedSet.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  title={formatChantierSelectLabel(c)}
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                    checked && "bg-primary/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input"
                    )}
                  >
                    {checked && <CheckIcon className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs font-semibold text-[#0A3C74] dark:text-foreground">
                      {c.code}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug whitespace-normal text-foreground/90">
                      {c.nom}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
