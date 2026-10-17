"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchApp } from "@/app/(app)/actions";
import type { AppSearchHit } from "@/lib/app-chrome";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function AppSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AppSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = window.setTimeout(() => {
      void searchApp(term)
        .then((rows) => {
          setHits(rows);
          setOpen(true);
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function go(hit: AppSearchHit) {
    setOpen(false);
    setQ("");
    router.push(hit.href);
  }

  return (
    <div ref={rootRef} className="relative min-w-0 w-56 max-w-xs flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (hits.length > 0) setOpen(true);
        }}
        placeholder="Chantier, RAID…"
        className="h-9 bg-background/80 pl-8"
        aria-label="Recherche chantier ou RAID"
      />
      {open && (q.trim().length >= 2 || hits.length > 0) ? (
        <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-40 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {loading && hits.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Recherche…
            </p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              Aucun résultat
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <button
                    type="button"
                    onClick={() => go(hit)}
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-accent"
                  >
                    <span className="text-sm font-medium leading-snug">
                      {hit.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      <span
                        className={cn(
                          "mr-1.5 rounded-full border px-1.5 py-0 text-[10px] font-medium",
                          hit.kind === "chantier"
                            ? "border-[#00BDBB]/30 bg-[#00BDBB]/10 text-[#0A3C74]"
                            : "border-border bg-muted"
                        )}
                      >
                        {hit.kind === "chantier" ? "Chantier" : "RAID"}
                      </span>
                      {hit.subtitle}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
