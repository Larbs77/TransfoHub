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
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Sélectionner...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  const allSelected = selected.length === options.length;

  function toggleAll() {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  }

  const displayLabel =
    selected.length === 0
      ? placeholder
      : selected.length === options.length
        ? "Tous"
        : selected.length === 1
          ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
          : `${selected.length} sélectionnés`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] h-9"
        )}
        data-placeholder={selected.length === 0 ? "" : undefined}
      >
        <span className="truncate">{displayLabel}</span>
        <div className="flex items-center gap-1">
          {selected.length > 0 && (
            <span
              role="button"
              tabIndex={-1}
              className="rounded-full hover:bg-muted p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <XIcon className="size-3 opacity-60" />
            </span>
          )}
          <ChevronDownIcon className="size-4 opacity-50" />
        </div>
      </button>

      {open && (
        <div className="bg-popover text-popover-foreground absolute z-50 mt-1 min-w-full max-h-60 overflow-y-auto rounded-md border shadow-md animate-in fade-in-0 zoom-in-95 p-1">
          {/* Toggle all */}
          <button
            type="button"
            onClick={toggleAll}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground outline-hidden select-none text-muted-foreground"
          >
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-sm border",
                allSelected
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-input"
              )}
            >
              {allSelected && <CheckIcon className="size-3" />}
            </span>
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
          <div className="bg-border -mx-1 my-1 h-px" />
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground outline-hidden select-none"
              >
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded-sm border",
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-input"
                  )}
                >
                  {checked && <CheckIcon className="size-3" />}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
