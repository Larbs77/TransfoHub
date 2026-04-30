"use client";

import { useState, useEffect } from "react";
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
  chantierDependantId: string | null;
  chantierDependantLabel: string;
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
  nextCode: string;
  defaultSourceId?: string;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

export function AdherenceFormDialog({
  open,
  onOpenChange,
  adherence,
  chantiers,
  nextCode,
  defaultSourceId,
}: Props) {
  const isEdit = !!adherence;
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState(adherence?.code ?? nextCode);
  const [chantierSourceId, setChantierSourceId] = useState(adherence?.chantierSourceId ?? defaultSourceId ?? "");
  const [chantierDependantId, setChantierDependantId] = useState(adherence?.chantierDependantId ?? "");
  const [chantierDependantLabel, setChantierDependantLabel] = useState(adherence?.chantierDependantLabel ?? "");
  const [type, setType] = useState(adherence?.type ?? "Technique");
  const [domaine, setDomaine] = useState(adherence?.domaine ?? "");
  const [description, setDescription] = useState(adherence?.description ?? "");
  const [criticite, setCriticite] = useState(adherence?.criticite ?? "MODÉRÉE");
  const [statut, setStatut] = useState(adherence?.statut ?? "Planifié");
  const [dateIdent, setDateIdent] = useState(toDateInput(adherence?.date_identification));
  const [dateResolution, setDateResolution] = useState(toDateInput(adherence?.date_resolution_prevue));
  const [responsable, setResponsable] = useState(adherence?.responsable ?? "");
  const [contratInterface, setContratInterface] = useState(adherence?.contrat_interface ?? "");
  const [commentaires, setCommentaires] = useState(adherence?.commentaires ?? "");
  const [isTransverse, setIsTransverse] = useState(!adherence?.chantierDependantId && !!adherence?.chantierDependantLabel);

  useEffect(() => {
    if (open) {
      setCode(adherence?.code ?? nextCode);
      setChantierSourceId(adherence?.chantierSourceId ?? defaultSourceId ?? "");
      setChantierDependantId(adherence?.chantierDependantId ?? "");
      setChantierDependantLabel(adherence?.chantierDependantLabel ?? "");
      setType(adherence?.type ?? "Technique");
      setDomaine(adherence?.domaine ?? "");
      setDescription(adherence?.description ?? "");
      setCriticite(adherence?.criticite ?? "MODÉRÉE");
      setStatut(adherence?.statut ?? "Planifié");
      setDateIdent(toDateInput(adherence?.date_identification));
      setDateResolution(toDateInput(adherence?.date_resolution_prevue));
      setResponsable(adherence?.responsable ?? "");
      setContratInterface(adherence?.contrat_interface ?? "");
      setCommentaires(adherence?.commentaires ?? "");
      setIsTransverse(!adherence?.chantierDependantId && !!adherence?.chantierDependantLabel);
    }
  }, [open, adherence, nextCode, defaultSourceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const data = {
      code,
      chantierSourceId,
      chantierDependantId: isTransverse ? null : (chantierDependantId || null),
      chantierDependantLabel: isTransverse ? chantierDependantLabel : "",
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
    if (isEdit) {
      await updateAdherence(adherence.id, data);
    } else {
      await createAdherence(data);
    }
    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADHERENCE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Criticité</label>
              <Select value={criticite} onValueChange={setCriticite}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADHERENCE_CRITICITES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chantier Source */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Chantier Source (dépend de)</label>
            <Select value={chantierSourceId} onValueChange={setChantierSourceId}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {chantiers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.code} — {c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Chantier Dépendant */}
          <div className="grid gap-1.5">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Chantier Dépendant</label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isTransverse}
                  onChange={(e) => setIsTransverse(e.target.checked)}
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
              <Select value={chantierDependantId} onValueChange={setChantierDependantId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {chantiers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={domaine} onValueChange={setDomaine}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {ADHERENCE_DOMAINES.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Statut</label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !chantierSourceId}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
