"use client";

import { useState, useEffect, useCallback } from "react";
import { createComite, updateComite, getNextComiteNumero } from "@/app/(app)/actions";
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
import { INSTANCE_LABELS, STATUT_COMITE_LABELS } from "@/lib/comite-labels";

interface ComiteData {
  id: string;
  instance: string;
  numero: number;
  date: Date;
  heure_casablanca: string;
  heure_belgique: string;
  statut: string;
  ordre_du_jour: string;
  invitation_envoyee: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comite?: ComiteData | null;
  defaultInstance?: string;
}

function toDateInput(d: Date) {
  return new Date(d).toISOString().split("T")[0];
}

export function ComiteFormDialog({ open, onOpenChange, comite, defaultInstance }: Props) {
  const isEdit = !!comite;
  const [loading, setLoading] = useState(false);

  const [instance, setInstance] = useState(comite?.instance ?? defaultInstance ?? "Comité Programme");
  const [numero, setNumero] = useState(comite?.numero ?? 1);

  const fetchNextNumero = useCallback(async (inst: string) => {
    if (isEdit) return;
    const next = await getNextComiteNumero(inst);
    setNumero(next);
  }, [isEdit]);

  useEffect(() => {
    fetchNextNumero(instance);
  }, [instance, fetchNextNumero]);
  const [date, setDate] = useState(comite ? toDateInput(comite.date) : "");
  const [heureCasa, setHeureCasa] = useState(comite?.heure_casablanca ?? "");
  const [heureBelgique, setHeureBelgique] = useState(comite?.heure_belgique ?? "");
  const [statut, setStatut] = useState(comite?.statut ?? "A planifier");
  const [ordreDuJour, setOrdreDuJour] = useState(comite?.ordre_du_jour ?? "");
  const [invitationEnvoyee, setInvitationEnvoyee] = useState(comite?.invitation_envoyee ?? false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const data = {
      instance,
      numero,
      date,
      heure_casablanca: heureCasa,
      heure_belgique: heureBelgique,
      statut,
      ordre_du_jour: ordreDuJour,
      invitation_envoyee: invitationEnvoyee,
    };
    if (isEdit) {
      await updateComite(comite.id, data);
    } else {
      await createComite(data);
    }
    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le comité" : "Nouveau comité"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Instance</label>
              <Select value={instance} onValueChange={setInstance}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(INSTANCE_LABELS).map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">N°</label>
              <Input
                type="number"
                min={1}
                value={numero}
                onChange={(e) => setNumero(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Heure Casablanca</label>
              <Input
                value={heureCasa}
                onChange={(e) => setHeureCasa(e.target.value)}
                placeholder="14H00"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Heure Belgique</label>
              <Input
                value={heureBelgique}
                onChange={(e) => setHeureBelgique(e.target.value)}
                placeholder="15H00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Statut</label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUT_COMITE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none rounded-md border px-3 py-2 hover:bg-accent/50 transition-colors self-end">
              <input
                type="checkbox"
                checked={invitationEnvoyee}
                onChange={(e) => setInvitationEnvoyee(e.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              <span className="text-sm font-medium">Invitation envoyée</span>
            </label>
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Ordre du jour</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:opacity-50"
              value={ordreDuJour}
              onChange={(e) => setOrdreDuJour(e.target.value)}
              placeholder="Points à aborder..."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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
