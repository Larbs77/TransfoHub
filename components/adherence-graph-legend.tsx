"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ADHERENCE_CRITICITE_COLORS } from "@/lib/adherence-labels";
import { STATUT_CHANTIER_COLORS } from "@/lib/chantier-labels";

const CRITICITE_ITEMS = [
  { label: "Bloquante", key: "BLOQUANTE", width: 4 },
  { label: "Forte", key: "FORTE", width: 3 },
  { label: "Modérée", key: "MODÉRÉE", width: 2 },
  { label: "Faible", key: "FAIBLE", width: 1.5 },
];

const STATUT_ITEMS = [
  { label: "Non démarré", key: "Non démarré" },
  { label: "Pré cadrage", key: "Pré cadrage" },
  { label: "Cadrage", key: "Cadrage" },
  { label: "Exécution", key: "Exécution" },
  { label: "Clôturé", key: "Clôturé" },
];

export function AdherenceGraphLegend() {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute bottom-3 right-3 z-10 rounded-lg border bg-card shadow-md text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-3 py-2 font-semibold"
      >
        Légende
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && (
        <div className="border-t px-3 py-2 space-y-3">
          {/* Criticité */}
          <div>
            <p className="font-semibold mb-1.5">Criticité (liens)</p>
            <div className="space-y-1">
              {CRITICITE_ITEMS.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <svg width="28" height="10">
                    <line
                      x1="0"
                      y1="5"
                      x2="28"
                      y2="5"
                      stroke={ADHERENCE_CRITICITE_COLORS[item.key]}
                      strokeWidth={item.width}
                    />
                  </svg>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Statut chantier */}
          <div>
            <p className="font-semibold mb-1.5">Statut chantier</p>
            <div className="space-y-1">
              {STATUT_ITEMS.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  <span
                    className="inline-block size-3 rounded-full"
                    style={{
                      backgroundColor: STATUT_CHANTIER_COLORS[item.key] ?? "#6b7280",
                    }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
