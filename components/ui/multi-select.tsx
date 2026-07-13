"use client";

import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  /**
   * When true (default for multi with long labels), selected values appear as
   * wrapping chips instead of a single truncated line.
   */
  chips?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Sélectionner...",
  className,
  chips = true,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  function remove(value: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onChange(selected.filter((v) => v !== value));
  }

  const allSelected = options.length > 0 && selected.length === options.length;

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  }

  const labelFor = (value: string) =>
    options.find((o) => o.value === value)?.label ?? null;

  const selectedOptions = selected
    .map((id) => {
      const label = labelFor(id);
      return label ? { value: id, label } : null;
    })
    .filter(Boolean) as Option[];

  const compactLabel =
    selected.length === 0
      ? placeholder
      : selected.length === options.length && options.length > 0
        ? "Tous"
        : selected.length === 1
          ? labelFor(selected[0]) ?? "1 sélection"
          : `${selected.length} sélectionnés`;

  return (
    <div ref={ref} className={cn("relative w-full min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "border-input text-foreground focus-visible:border-ring focus-visible:ring-ring/50",
          "dark:bg-input/30 dark:hover:bg-input/50",
          "flex w-full items-start justify-between gap-2 rounded-lg border bg-transparent px-3 py-2 text-sm shadow-xs",
          "transition-[color,box-shadow] outline-none focus-visible:ring-[3px]",
          "min-h-10 text-left",
          selected.length === 0 && "text-muted-foreground"
        )}
      >
        <div className="min-w-0 flex-1">
          {chips && selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {selectedOptions.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex max-w-full items-start gap-1 rounded-md border border-primary/15 bg-primary/5 px-2 py-1 text-left text-xs font-medium text-primary"
                >
                  <span className="min-w-0 break-words whitespace-normal leading-snug">
                    {opt.label}
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    className="mt-0.5 shrink-0 rounded-sm p-0.5 hover:bg-primary/10"
                    onClick={(e) => remove(opt.value, e)}
                    onMouseDown={(e) => e.preventDefault()}
                    aria-label={`Retirer ${opt.label}`}
                  >
                    <XIcon className="size-3 opacity-70" />
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <span
              className={cn(
                "block min-w-0 leading-snug",
                selected.length <= 1
                  ? "whitespace-normal break-words"
                  : "truncate whitespace-nowrap"
              )}
            >
              {compactLabel}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={-1}
              className="rounded-full p-0.5 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Tout effacer"
            >
              <XIcon className="size-3.5 opacity-60" />
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              "size-4 opacity-50 transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {open && (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1.5 max-h-64 w-full min-w-0 overflow-y-auto rounded-lg border p-1 shadow-lg animate-in fade-in-0 zoom-in-95">
          <button
            type="button"
            onClick={toggleAll}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
          >
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                allSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input"
              )}
            >
              {allSelected && <CheckIcon className="size-3" />}
            </span>
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
          <div className="bg-border -mx-1 my-1 h-px" />
          {options.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              Aucune option
            </p>
          ) : (
            options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden select-none",
                    "hover:bg-accent hover:text-accent-foreground",
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
                  <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                    {option.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
