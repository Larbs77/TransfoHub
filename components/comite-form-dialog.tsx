"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  INSTANCE_LABELS,
  STATUT_COMITE_LABELS,
  type ComiteParametreOption,
} from "@/lib/comite-labels";

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
  /** Active committee types from admin parameter table */
  instances?: ComiteParametreOption[];
}

function toDateInput(d: Date) {
  return new Date(d).toISOString().split("T")[0];
}

export function ComiteFormDialog({
  open,
  onOpenChange,
  comite,
  defaultInstance,
  instances,
}: Props) {
  const isEdit = !!comite;
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const instanceOptions = useMemo(() => {
    if (instances && instances.length > 0) {
      return instances
        .filter((p) => p.is_active || p.name === comite?.instance)
        .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    }
    // Fallback if catalog not loaded
    return Object.keys(INSTANCE_LABELS).map((name, i) => ({
      id: name,
      name,
      description: "",
      frequency: "",
      owner: "",
      short_label: INSTANCE_LABELS[name] ?? name,
      color: "#6b7280",
      position: i,
      is_active: true,
    }));
  }, [instances, comite?.instance]);

  const defaultInst =
    comite?.instance ??
    defaultInstance ??
    instanceOptions[0]?.name ??
    "Comité Programme";

  const [instance, setInstance] = useState(defaultInst);
  const [numero, setNumero] = useState(comite?.numero ?? 1);

  const selectedParam = instanceOptions.find((p) => p.name === instance);

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
    setFormError("");
    if (!instance) {
      setFormError("Sélectionnez un type d'instance de comité.");
      return;
    }
    setLoading(true);
    try {
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
      onOpenChange(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setLoading(false);
    }
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
                  <SelectValue placeholder="Choisir une instance" />
                </SelectTrigger>
                <SelectContent>
                  {instanceOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.name}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: opt.color }}
                        />
                        {opt.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedParam &&
                (selectedParam.frequency ||
                  selectedParam.owner ||
                  selectedParam.description) && (
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {[
                      selectedParam.frequency && `Fréquence : ${selectedParam.frequency}`,
                      selectedParam.owner && `Propriétaire : ${selectedParam.owner}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {selectedParam.description ? (
                      <>
                        {(selectedParam.frequency || selectedParam.owner) && <br />}
                        {selectedParam.description}
                      </>
                    ) : null}
                  </p>
                )}
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
          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={loading || instanceOptions.length === 0}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
