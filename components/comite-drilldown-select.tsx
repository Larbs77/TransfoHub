"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  comiteTypeNeedsChantierPane,
  formatComiteSeanceLabel,
  groupComitesForPicker,
  type ComiteChantierGroup,
  type ComiteParametreOption,
  type ComiteSeanceRef,
  type ComiteTypeGroup,
} from "@/lib/comite-labels";

const NONE = "__none__";

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export type ComitePickerSeance = ComiteSeanceRef & { id: string };

type Pane = "types" | "chantiers" | "seances";

export function ComiteDrilldownSelect({
  comites,
  params,
  value,
  onChange,
  noneValue = NONE,
  placeholder = "Aucun",
  disabled = false,
}: {
  comites: ComitePickerSeance[];
  params?: ComiteParametreOption[] | null;
  value: string;
  onChange: (next: string) => void;
  noneValue?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pane, setPane] = useState<Pane>("types");
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [chantierKey, setChantierKey] = useState<string | null>(null);

  const groups = useMemo(
    () => groupComitesForPicker(comites, params),
    [comites, params]
  );

  const selected = comites.find((c) => c.id === value);
  const selectedLabel = selected
    ? formatComiteSeanceLabel(selected, params, { withChantier: true })
    : null;

  const currentType = typeKey
    ? groups.find((g) => g.instance === typeKey) ?? null
    : null;
  const currentChantier: ComiteChantierGroup | null =
    currentType && chantierKey
      ? currentType.chantiers.find((c) => c.id === chantierKey) ?? null
      : null;

  const seanceList: ComiteSeanceRef[] = currentChantier
    ? currentChantier.seances
    : currentType
      ? currentType.seances
      : [];

  const q = normalize(query);
  const filteredTypes = useMemo(() => {
    if (!q) return groups;
    return groups.filter((g) => normalize(`${g.label} ${g.instance}`).includes(q));
  }, [groups, q]);

  const filteredChantiers = useMemo(() => {
    const list = currentType?.chantiers ?? [];
    if (!q) return list;
    return list.filter((c) =>
      normalize(`${c.code} ${c.nom}`).includes(q)
    );
  }, [currentType, q]);

  const filteredSeances = useMemo(() => {
    if (!q) return seanceList;
    return seanceList.filter((s) =>
      normalize(
        formatComiteSeanceLabel(s, params, { withChantier: false })
      ).includes(q)
    );
  }, [seanceList, q, params]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPane("types");
    setTypeKey(null);
    setChantierKey(null);
  }, [open]);

  function goTypes() {
    setQuery("");
    setPane("types");
    setTypeKey(null);
    setChantierKey(null);
  }

  function openType(group: ComiteTypeGroup) {
    setQuery("");
    setTypeKey(group.instance);
    setChantierKey(null);
    if (comiteTypeNeedsChantierPane(group)) {
      setPane("chantiers");
      return;
    }
    if (group.chantiers.length === 1) {
      setChantierKey(group.chantiers[0].id);
    }
    setPane("seances");
  }

  function openChantier(ch: ComiteChantierGroup) {
    setQuery("");
    setChantierKey(ch.id);
    setPane("seances");
  }

  function chooseSeance(id: string) {
    onChange(id);
    setOpen(false);
  }

  function chooseNone() {
    onChange(noneValue);
    setOpen(false);
  }

  function goBack() {
    if (
      pane === "seances" &&
      currentType &&
      comiteTypeNeedsChantierPane(currentType)
    ) {
      setQuery("");
      setChantierKey(null);
      setPane("chantiers");
      return;
    }
    goTypes();
  }

  const headerTitle =
    pane === "types"
      ? "Type de comité"
      : pane === "chantiers"
        ? currentType?.label ?? "Chantiers"
        : currentChantier
          ? `${currentType?.label ?? ""} · ${currentChantier.code}`
          : currentType?.label ?? "Séances";

  const searchPlaceholder =
    pane === "types"
      ? "Rechercher un type…"
      : pane === "chantiers"
        ? "Rechercher un chantier…"
        : "Rechercher une séance…";

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
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
        data-comite-picker
        align="start"
        sideOffset={4}
        className="z-[200] w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
      >
        <div className="flex items-center gap-1 border-b px-1.5 py-1.5">
          {pane !== "types" ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Retour"
            >
              <ChevronLeft className="size-4" />
            </button>
          ) : null}
          <p className="min-w-0 flex-1 truncate px-1 text-xs font-semibold uppercase tracking-wide text-[#0A3C74] dark:text-foreground">
            {headerTitle}
          </p>
        </div>
        <div className="relative border-b p-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pl-8"
          />
        </div>
        <div role="listbox" className="max-h-64 overflow-y-auto p-1">
          {pane === "types" ? (
            <>
              <button
                type="button"
                role="option"
                aria-selected={!selected}
                onClick={chooseNone}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  !selected && "bg-primary/5"
                )}
              >
                <span className="min-w-0 flex-1 text-muted-foreground">
                  Aucun
                </span>
                {!selected ? (
                  <CheckIcon className="size-3.5 shrink-0 text-primary" />
                ) : null}
              </button>
              {filteredTypes.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Aucun type
                </p>
              ) : (
                filteredTypes.map((g) => (
                  <button
                    key={g.instance}
                    type="button"
                    onClick={() => openType(g)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {g.label}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {g.seances.length}
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
            </>
          ) : null}

          {pane === "chantiers" ? (
            filteredChantiers.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Aucun chantier
              </p>
            ) : (
              filteredChantiers.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => openChantier(ch)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{ch.code}</span>
                    {ch.nom ? (
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {ch.nom}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                    {ch.seances.length}
                  </span>
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )
          ) : null}

          {pane === "seances" ? (
            filteredSeances.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Aucune séance
              </p>
            ) : (
              filteredSeances.map((s) => {
                const id = s.id ?? "";
                const checked = id === value;
                return (
                  <button
                    key={id}
                    type="button"
                    role="option"
                    aria-selected={checked}
                    onClick={() => id && chooseSeance(id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      checked && "bg-primary/5"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {formatComiteSeanceLabel(s, params, {
                        withChantier: false,
                      })}
                    </span>
                    {checked ? (
                      <CheckIcon className="size-3.5 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })
            )
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
