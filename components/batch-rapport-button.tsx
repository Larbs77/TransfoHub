"use client";

import { useState } from "react";
import { FileText, CheckSquare, Square, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Chantier {
  id: string;
  code: string;
  nom: string;
  statut: string;
  domaine: string;
}

interface Props {
  chantiers: Chantier[];
}

const STATUT_COLORS: Record<string, string> = {
  "Non démarré": "#4c4e52",
  "Pré cadrage": "#4a6d78",
  "Cadrage": "#0b889e",
  "Exécution": "#0cb71a",
  "Clôture": "#6366f1",
  "Clôturé": "#0508da",
};

export function BatchRapportButton({ chantiers }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Default: select all active chantiers
  function openDialog() {
    const active = chantiers
      .filter((c) => !["Clôturé", "Non démarré"].includes(c.statut))
      .map((c) => c.id);
    setSelected(new Set(active));
    setOpen(true);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(chantiers.map((c) => c.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function selectActive() {
    setSelected(
      new Set(
        chantiers.filter((c) => !["Clôturé", "Non démarré"].includes(c.statut)).map((c) => c.id)
      )
    );
  }

  function generateRapports() {
    if (selected.size === 0) return;
    const ids = Array.from(selected).join(",");
    window.open(`/rapport-batch?ids=${ids}`, "_blank");
    setOpen(false);
  }

  const activeCount = chantiers.filter(
    (c) => !["Clôturé", "Non démarré"].includes(c.statut)
  ).length;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={openDialog}>
        <FileText className="size-4" />
        Rapports PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="size-4" />
              Générer des rapports PDF
            </DialogTitle>
          </DialogHeader>

          {/* Quick selectors */}
          <div className="flex items-center gap-2 flex-wrap pb-2 border-b">
            <span className="text-xs text-muted-foreground">Sélectionner :</span>
            <Button size="xs" variant="outline" onClick={selectActive}>
              Actifs ({activeCount})
            </Button>
            <Button size="xs" variant="outline" onClick={selectAll}>
              Tous ({chantiers.length})
            </Button>
            <Button size="xs" variant="ghost" onClick={selectNone}>
              <X className="size-3 mr-1" />
              Aucun
            </Button>
            <span className="ml-auto text-xs font-medium text-muted-foreground">
              {selected.size} sélectionné(s)
            </span>
          </div>

          {/* Chantier list */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {chantiers.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                    isSelected ? "bg-primary/5 border border-primary/20" : "hover:bg-muted border border-transparent"
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="size-4 shrink-0 text-primary" />
                  ) : (
                    <Square className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">
                    {c.code}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">{c.nom}</span>
                  <Badge
                    className="text-[10px] shrink-0"
                    style={{
                      backgroundColor: STATUT_COLORS[c.statut] ?? "#6b7280",
                      color: "white",
                    }}
                  >
                    {c.statut}
                  </Badge>
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={generateRapports}
              disabled={selected.size === 0}
              className="gap-2"
            >
              <Printer className="size-4" />
              Générer {selected.size > 0 ? `${selected.size} rapport(s)` : ""}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
