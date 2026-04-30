"use client";

import { useState, useEffect } from "react";
import { createJalon, updateJalon } from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { PHASES, STATUT_JALON_LIST } from "@/lib/jalon-labels";

interface JalonData {
  id: string;
  chantierId: string;
  phase: string;
  nom: string;
  description: string;
  ordre: number;
  date_cible: Date;
  date_reelle: Date | null;
  statut: string;
  livrables: string;
  commentaire: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jalon?: JalonData | null;
  chantierId: string;
  defaultPhase?: string;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

export function JalonFormDialog({ open, onOpenChange, jalon, chantierId, defaultPhase }: Props) {
  const isEdit = !!jalon;
  const [loading, setLoading] = useState(false);

  const [phase, setPhase] = useState(jalon?.phase ?? defaultPhase ?? "Exécution");
  const [nom, setNom] = useState(jalon?.nom ?? "");
  const [description, setDescription] = useState(jalon?.description ?? "");
  const [ordre, setOrdre] = useState(jalon?.ordre ?? 0);
  const [dateCible, setDateCible] = useState(toDateInput(jalon?.date_cible));
  const [dateReelle, setDateReelle] = useState(toDateInput(jalon?.date_reelle));
  const [statut, setStatut] = useState(jalon?.statut ?? "Planifié");
  const [livrables, setLivrables] = useState(jalon?.livrables ?? "");
  const [commentaire, setCommentaire] = useState(jalon?.commentaire ?? "");

  // Reset form state when dialog opens or jalon changes
  useEffect(() => {
    if (open) {
      setPhase(jalon?.phase ?? defaultPhase ?? "Exécution");
      setNom(jalon?.nom ?? "");
      setDescription(jalon?.description ?? "");
      setOrdre(jalon?.ordre ?? 0);
      setDateCible(toDateInput(jalon?.date_cible));
      setDateReelle(toDateInput(jalon?.date_reelle));
      setStatut(jalon?.statut ?? "Planifié");
      setLivrables(jalon?.livrables ?? "");
      setCommentaire(jalon?.commentaire ?? "");
    }
  }, [open, jalon, defaultPhase]);

  function handleStatutChange(newStatut: string) {
    setStatut(newStatut);
    // Auto-fill date_reelle when marking as Atteint
    if (newStatut === "Atteint" && !dateReelle) {
      setDateReelle(new Date().toISOString().slice(0, 10));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const data = {
      chantierId,
      phase,
      nom,
      description,
      ordre,
      date_cible: dateCible,
      date_reelle: dateReelle || null,
      statut,
      livrables,
      commentaire,
    };
    if (isEdit) {
      await updateJalon(jalon.id, data);
    } else {
      await createJalon(data);
    }
    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le jalon" : "Nouveau jalon"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Phase + Nom */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Phase</label>
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASES.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-1.5">
              <label className="text-sm font-medium">Nom du jalon</label>
              <Input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Go/No-Go, UAT, Go-Live..."
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du jalon"
            />
          </div>

          {/* Date cible + Date réelle */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date cible</label>
              <Input
                type="date"
                value={dateCible}
                onChange={(e) => setDateCible(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date réelle</label>
              <Input
                type="date"
                value={dateReelle}
                onChange={(e) => setDateReelle(e.target.value)}
              />
            </div>
          </div>

          {/* Statut + Ordre */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Statut</label>
              <Select value={statut} onValueChange={handleStatutChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUT_JALON_LIST.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Ordre</label>
              <Input
                type="number"
                min={0}
                value={ordre}
                onChange={(e) => setOrdre(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Livrables */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Livrables</label>
            <Input
              value={livrables}
              onChange={(e) => setLivrables(e.target.value)}
              placeholder="Documents, livrables attendus..."
            />
          </div>

          {/* Commentaire */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Commentaire</label>
            <Input
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Notes additionnelles..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
