"use client";

import { useState, useEffect } from "react";
import {
  createRaid,
  updateRaid,
  getChantiersForSelect,
  getChantiersForRaidCreate,
  getComitesForSelect,
  getRessourcesForSelect,
} from "@/app/(app)/actions";
import { useUser } from "@/components/user-provider";
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
  RAID_TYPES,
  CATEGORIE_LIST,
  DOMAINE_LIST,
  STRATEGIE_LIST,
  PROBABILITE_LABELS,
  IMPACT_LABELS,
  getStatutsForType,
  getStatutsFromConfig,
  getCriticiteLabel,
  CRITICITE_COLORS,
  type StatusConfigItem,
} from "@/lib/raid-labels";
import { scoreCriticite } from "@/lib/utils-pmo";
import { format } from "date-fns";
import { INSTANCE_LABELS } from "@/lib/comite-labels";

interface RaidData {
  id: string;
  type: string;
  intitule: string;
  description: string;
  categorie: string;
  chantierId: string | null;
  domaine: string;
  probabilite: number | null;
  impact: number | null;
  strategie: string;
  mitigation: string;
  responsable: string;
  responsableRessourceId: string | null;
  statut: string;
  date_identification: Date | null;
  date_revision: Date | null;
  date_echeance: Date | null;
  commentaires: string;
  comiteId: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  raid?: RaidData | null;
  defaultType?: string;
  defaultChantierId?: string;
  defaultComiteId?: string;
  statusConfigs?: StatusConfigItem[];
}

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export function RaidFormDialog({
  open,
  onOpenChange,
  raid,
  defaultType,
  defaultChantierId,
  defaultComiteId,
  statusConfigs,
}: Props) {
  const isEdit = !!raid;
  const { raidCreateScope } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chantiers, setChantiers] = useState<{ id: string; code: string; nom: string }[]>([]);
  const [comites, setComites] = useState<{ id: string; instance: string; numero: number; date: Date }[]>([]);

  const [type, setType] = useState(raid?.type ?? defaultType ?? "Action");
  const [intitule, setIntitule] = useState(raid?.intitule ?? "");
  const [description, setDescription] = useState(raid?.description ?? "");
  const [categorie, setCategorie] = useState(raid?.categorie ?? "");
  const [chantierId, setChantierId] = useState(raid?.chantierId ?? defaultChantierId ?? "__none__");
  const [domaine, setDomaine] = useState(raid?.domaine ?? "");
  const [probabilite, setProbabilite] = useState<number | "">(raid?.probabilite ?? "");
  const [impact, setImpact] = useState<number | "">(raid?.impact ?? "");
  const [strategie, setStrategie] = useState(raid?.strategie ?? "");
  const [mitigation, setMitigation] = useState(raid?.mitigation ?? "");
  const [responsable, setResponsable] = useState(raid?.responsable ?? "");
  const [responsableRessourceId, setResponsableRessourceId] = useState(
    raid?.responsableRessourceId ?? "__none__"
  );
  const [ressources, setRessources] = useState<
    { id: string; nom_complet: string; type: string; organisation: string }[]
  >([]);
  const [statut, setStatut] = useState(raid?.statut ?? "");
  const [dateIdent, setDateIdent] = useState(toDateInput(raid?.date_identification ?? null));
  const [dateRev, setDateRev] = useState(toDateInput(raid?.date_revision ?? null));
  const [dateEcheance, setDateEcheance] = useState(toDateInput(raid?.date_echeance ?? null));
  const [commentaires, setCommentaires] = useState(raid?.commentaires ?? "");
  const [comiteId, setComiteId] = useState(raid?.comiteId ?? defaultComiteId ?? "__none__");

  const isRisque = type === "Risque";
  const score = isRisque && probabilite && impact ? scoreCriticite(Number(impact), Number(probabilite)) : null;
  const criticiteLabel = score ? getCriticiteLabel(score) : null;
  const chantierRequiredOnCreate = !isEdit && raidCreateScope === "chantier";

  useEffect(() => {
    if (open) {
      setError(null);
      Promise.all([
        isEdit ? getChantiersForSelect() : getChantiersForRaidCreate(),
        getComitesForSelect(),
        getRessourcesForSelect(),
      ]).then(([c, co, res]) => {
        setChantiers(c);
        setComites(co);
        setRessources(res);
      });
    }
  }, [open, isEdit]);

  function handleResponsableRessourceChange(newId: string) {
    setResponsableRessourceId(newId);
    if (newId !== "__none__") {
      const selected = ressources.find((r) => r.id === newId);
      if (selected) {
        setResponsable(selected.nom_complet);
      }
    }
  }

  // Reset statut when type changes (only for new items)
  useEffect(() => {
    if (!isEdit) {
      const statuts = statusConfigs?.length ? getStatutsFromConfig(type, statusConfigs) : getStatutsForType(type);
      setStatut(statuts[0]);
    }
  }, [type, isEdit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const resolvedChantierId =
      chantierId && chantierId !== "__none__" ? chantierId : null;
    if (chantierRequiredOnCreate && !resolvedChantierId) {
      setError(
        "Un chantier est obligatoire : votre rôle ne permet la création qu'au niveau des chantiers auxquels vous êtes rattaché."
      );
      return;
    }
    setLoading(true);
    const data = {
      type,
      intitule,
      description,
      categorie,
      chantierId: resolvedChantierId,
      domaine,
      probabilite: isRisque && probabilite ? Number(probabilite) : null,
      impact: isRisque && impact ? Number(impact) : null,
      strategie: isRisque ? strategie : "",
      mitigation: isRisque ? mitigation : "",
      responsable,
      responsableRessourceId:
        responsableRessourceId !== "__none__" ? responsableRessourceId : null,
      statut,
      date_identification: dateIdent || null,
      date_revision: dateRev || null,
      date_echeance: type === "Action" ? (dateEcheance || null) : null,
      commentaires,
      comiteId: comiteId && comiteId !== "__none__" ? comiteId : null,
    };
    try {
      if (isEdit) {
        await updateRaid(raid.id, data);
      } else {
        await createRaid(data);
      }
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de l'enregistrement."
      );
    } finally {
      setLoading(false);
    }
  }

  const statuts = statusConfigs?.length ? getStatutsFromConfig(type, statusConfigs) : getStatutsForType(type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'élément RAID" : "Nouvel élément RAID"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Type + Statut */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RAID_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Statut</label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuts.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Intitulé */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Intitulé</label>
            <Input
              value={intitule}
              onChange={(e) => setIntitule(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:opacity-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Catégorie + Domaine */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Catégorie</label>
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIE_LIST.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Domaine</label>
              <Select value={domaine} onValueChange={setDomaine}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAINE_LIST.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chantier + Comité */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5 min-w-0">
              <label className="text-sm font-medium">
                Chantier
                {chantierRequiredOnCreate && (
                  <span className="text-destructive"> *</span>
                )}
              </label>
              <Select value={chantierId} onValueChange={setChantierId}>
                <SelectTrigger className="w-full overflow-hidden">
                  <span className="truncate">
                    <SelectValue
                      placeholder={
                        chantierRequiredOnCreate
                          ? "Sélectionner un chantier"
                          : "Aucun"
                      }
                    />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {!chantierRequiredOnCreate && (
                    <SelectItem value="__none__">Aucun</SelectItem>
                  )}
                  {chantiers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} - {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {chantierRequiredOnCreate && (
                <p className="text-[11px] text-muted-foreground">
                  Niveau Chantier : uniquement les chantiers auxquels vous êtes
                  rattaché.
                </p>
              )}
            </div>
            <div className="grid gap-1.5 min-w-0">
              <label className="text-sm font-medium">Comité</label>
              <Select value={comiteId} onValueChange={setComiteId}>
                <SelectTrigger className="w-full overflow-hidden">
                  <span className="truncate">
                    <SelectValue placeholder="Aucun" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {comites.map((co) => (
                    <SelectItem key={co.id} value={co.id}>
                      {INSTANCE_LABELS[co.instance] ?? co.instance} #{co.numero}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Responsable */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Ressource responsable</label>
              <Select
                value={responsableRessourceId}
                onValueChange={handleResponsableRessourceChange}
              >
                <SelectTrigger className="w-full overflow-hidden">
                  <span className="truncate">
                    <SelectValue placeholder="Aucun(e)" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun(e)</SelectItem>
                  {ressources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nom_complet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Responsable (texte)</label>
              <Input
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Nom libre si pas de ressource"
              />
            </div>
          </div>

          {/* Risque-only fields */}
          {isRisque && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Probabilité</label>
                  <Select
                    value={probabilite ? String(probabilite) : ""}
                    onValueChange={(v) => setProbabilite(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROBABILITE_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {k} - {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Impact</label>
                  <Select
                    value={impact ? String(impact) : ""}
                    onValueChange={(v) => setImpact(Number(v))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(IMPACT_LABELS).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {k} - {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Criticité</label>
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50">
                    {score ? (
                      <>
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: CRITICITE_COLORS[criticiteLabel!] }}
                        />
                        <span className="text-sm font-medium">
                          {score}/25 — {criticiteLabel}
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Stratégie</label>
                  <Select value={strategie} onValueChange={setStrategie}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {STRATEGIE_LIST.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-sm font-medium">Mitigation</label>
                  <Input
                    value={mitigation}
                    onChange={(e) => setMitigation(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Dates */}
          <div className={`grid gap-4 ${type === "Action" ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date identification</label>
              <Input
                type="date"
                value={dateIdent}
                onChange={(e) => setDateIdent(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date révision</label>
              <Input
                type="date"
                value={dateRev}
                onChange={(e) => setDateRev(e.target.value)}
              />
            </div>
            {type === "Action" && (
              <div className="grid gap-1.5">
                <label className="text-sm font-medium">Date échéance</label>
                <Input
                  type="date"
                  value={dateEcheance}
                  onChange={(e) => setDateEcheance(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Commentaires */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Commentaires</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:opacity-50"
              value={commentaires}
              onChange={(e) => setCommentaires(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

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
