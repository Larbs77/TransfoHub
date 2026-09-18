"use client";

import { useState, useEffect, useMemo } from "react";
import { createAdherence, updateAdherence } from "@/app/(app)/actions";
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
import { ChantierSelect, ChantierMultiSelect } from "@/components/chantier-select";
import {
  ADHERENCE_TYPES,
  ADHERENCE_STATUTS,
  ADHERENCE_CRITICITES,
  ADHERENCE_DOMAINES,
} from "@/lib/adherence-labels";

interface ChantierOption {
  id: string;
  code: string;
  nom: string;
}

interface AdherenceData {
  id: string;
  code: string;
  chantierSourceId: string;
  chantierDependantLabel: string;
  dependants?: Array<{ chantier: { id: string; code: string; nom: string } }>;
  type: string;
  domaine: string;
  description: string;
  criticite: string;
  statut: string;
  date_identification: Date | null;
  date_resolution_prevue: Date | null;
  responsable: string;
  contrat_interface: string;
  commentaires: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adherence?: AdherenceData | null;
  chantiers: ChantierOption[];
  chantiersDependant?: ChantierOption[];
  nextCode: string;
  defaultSourceId?: string;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

const FIELD_NONE = "__none__";

export function AdherenceFormDialog({
  open,
  onOpenChange,
  adherence,
  chantiers,
  chantiersDependant,
  nextCode,
  defaultSourceId,
}: Props) {
  const isEdit = !!adherence;
  const dependantOptions = chantiersDependant?.length
    ? chantiersDependant
    : chantiers;
  const sourceOptions = useMemo(() => {
    const list = [...chantiers];
    const currentId = adherence?.chantierSourceId ?? defaultSourceId;
    if (currentId && !list.some((c) => c.id === currentId)) {
      const extra = dependantOptions.find((c) => c.id === currentId);
      if (extra) list.unshift(extra);
    }
    return list;
  }, [chantiers, dependantOptions, adherence?.chantierSourceId, defaultSourceId]);
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState(adherence?.code ?? nextCode);
  const [chantierSourceId, setChantierSourceId] = useState(adherence?.chantierSourceId ?? defaultSourceId ?? "");
  const [chantierDependantIds, setChantierDependantIds] = useState<string[]>(
    adherence?.dependants?.map((d) => d.chantier.id) ?? []
  );
  const [chantierDependantLabel, setChantierDependantLabel] = useState(adherence?.chantierDependantLabel ?? "");
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState(adherence?.type ?? "");
  const [domaine, setDomaine] = useState(adherence?.domaine ?? "");
  const [description, setDescription] = useState(adherence?.description ?? "");
  const [criticite, setCriticite] = useState(adherence?.criticite ?? "");
  const [statut, setStatut] = useState(adherence?.statut ?? "");
  const [dateIdent, setDateIdent] = useState(toDateInput(adherence?.date_identification));
  const [dateResolution, setDateResolution] = useState(toDateInput(adherence?.date_resolution_prevue));
  const [responsable, setResponsable] = useState(adherence?.responsable ?? "");
  const [contratInterface, setContratInterface] = useState(adherence?.contrat_interface ?? "");
  const [commentaires, setCommentaires] = useState(adherence?.commentaires ?? "");
  const [isTransverse, setIsTransverse] = useState(
    !adherence?.dependants?.length && !!adherence?.chantierDependantLabel
  );

  useEffect(() => {
    if (open) {
      setError(null);
      setCode(adherence?.code ?? nextCode);
      setChantierSourceId(adherence?.chantierSourceId ?? defaultSourceId ?? "");
      setChantierDependantIds(
        adherence?.dependants?.map((d) => d.chantier.id) ?? []
      );
      setChantierDependantLabel(adherence?.chantierDependantLabel ?? "");
      setType(adherence?.type ?? "");
      setDomaine(adherence?.domaine ?? "");
      setDescription(adherence?.description ?? "");
      setCriticite(adherence?.criticite ?? "");
      setStatut(adherence?.statut ?? "");
      setDateIdent(toDateInput(adherence?.date_identification));
      setDateResolution(toDateInput(adherence?.date_resolution_prevue));
      setResponsable(adherence?.responsable ?? "");
      setContratInterface(adherence?.contrat_interface ?? "");
      setCommentaires(adherence?.commentaires ?? "");
      setIsTransverse(
        !adherence?.dependants?.length && !!adherence?.chantierDependantLabel
      );
    }
  }, [open, adherence, nextCode, defaultSourceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!chantierSourceId) {
      setError("Le chantier source est obligatoire.");
      return;
    }
    if (!isTransverse && chantierDependantIds.length === 0) {
      setError(
        "Sélectionnez au moins un chantier dépendant, ou cochez Transverse."
      );
      return;
    }
    if (!type.trim()) {
      setError("Le type est obligatoire.");
      return;
    }
    if (!criticite.trim()) {
      setError("La criticité est obligatoire.");
      return;
    }
    if (!statut.trim()) {
      setError("Le statut est obligatoire.");
      return;
    }
    setLoading(true);
    const data = {
      code,
      chantierSourceId,
      chantierDependantIds: isTransverse ? [] : chantierDependantIds,
      chantierDependantLabel: isTransverse
        ? chantierDependantLabel.trim() || "Tous chantiers"
        : "",
      type,
      domaine,
      description,
      criticite,
      statut,
      date_identification: dateIdent || null,
      date_resolution_prevue: dateResolution || null,
      responsable,
      contrat_interface: contratInterface,
      commentaires,
    };
    try {
      if (isEdit) {
        await updateAdherence(adherence.id, data);
      } else {
        await createAdherence(data);
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-[min(100vw-1.5rem,64rem)] max-w-none flex-col overflow-y-auto sm:max-w-none"
        onInteractOutside={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest?.("[data-chantier-picker]")) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          const el = e.target as HTMLElement | null;
          if (el?.closest?.("[data-chantier-picker]")) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'adhérence" : "Nouvelle adhérence"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Code + Type + Criticité */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Code</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Type <span className="text-destructive">*</span>
              </label>
              <Select
                value={type || FIELD_NONE}
                onValueChange={(v) => setType(v === FIELD_NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FIELD_NONE}>Sélectionner</SelectItem>
                  {ADHERENCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Criticité <span className="text-destructive">*</span>
              </label>
              <Select
                value={criticite || FIELD_NONE}
                onValueChange={(v) => setCriticite(v === FIELD_NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FIELD_NONE}>Sélectionner</SelectItem>
                  {ADHERENCE_CRITICITES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chantier Source */}
          <div className="grid min-w-0 gap-1.5">
            <label className="text-sm font-medium">
              Chantier Source (dépend de){" "}
              <span className="text-destructive">*</span>
            </label>
            <ChantierSelect
              chantiers={sourceOptions}
              value={chantierSourceId}
              onChange={(id) => {
                setChantierSourceId(id);
                setChantierDependantIds((prev) =>
                  prev.filter((d) => d !== id)
                );
              }}
              placeholder="Sélectionner…"
            />
          </div>

          {/* Chantier Dépendant */}
          <div className="grid min-w-0 gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium">
                Chantier Dépendant <span className="text-destructive">*</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isTransverse}
                  onChange={(e) => {
                  const next = e.target.checked;
                  setIsTransverse(next);
                  if (next) setChantierDependantIds([]);
                }}
                  className="rounded"
                />
                Transverse (tous chantiers)
              </label>
            </div>
            {isTransverse ? (
              <Input
                value={chantierDependantLabel}
                onChange={(e) => setChantierDependantLabel(e.target.value)}
                placeholder="Ex: Tous chantiers applicatifs"
              />
            ) : (
              <ChantierMultiSelect
                chantiers={dependantOptions}
                value={chantierDependantIds}
                onChange={setChantierDependantIds}
                excludeId={chantierSourceId || undefined}
                placeholder="Sélectionner un ou plusieurs chantiers…"
              />
            )}
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description de l'adhérence..."
            />
          </div>

          {/* Domaine + Statut */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Domaine</label>
              <Select
                value={domaine || FIELD_NONE}
                onValueChange={(v) => setDomaine(v === FIELD_NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FIELD_NONE}>Sélectionner</SelectItem>
                  {ADHERENCE_DOMAINES.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Statut <span className="text-destructive">*</span>
              </label>
              <Select
                value={statut || FIELD_NONE}
                onValueChange={(v) => setStatut(v === FIELD_NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={FIELD_NONE}>Sélectionner</SelectItem>
                  {ADHERENCE_STATUTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date identification</label>
              <Input type="date" value={dateIdent} onChange={(e) => setDateIdent(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date résolution prévue</label>
              <Input type="date" value={dateResolution} onChange={(e) => setDateResolution(e.target.value)} />
            </div>
          </div>

          {/* Responsable + Contrat Interface */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Responsable</label>
              <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Lead Archi, Lead RSSI..." />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Contrat d&apos;interface</label>
              <Input value={contratInterface} onChange={(e) => setContratInterface(e.target.value)} placeholder="CI-xxx-xxx" />
            </div>
          </div>

          {/* Commentaires */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Commentaires</label>
            <Input value={commentaires} onChange={(e) => setCommentaires(e.target.value)} placeholder="Notes additionnelles..." />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter className="sm:justify-between">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Les champs marqués d&apos;un astérisque sont obligatoires.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
