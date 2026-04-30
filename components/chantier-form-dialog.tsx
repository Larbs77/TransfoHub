"use client";

import { useState } from "react";
import { createChantier, updateChantier } from "@/app/(app)/actions";
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
  DOMAINE_LABELS,
  TYPE_CHANTIER_LABELS,
  PRIORITE_CHANTIER_LABELS,
  STATUT_CHANTIER_LABELS,
} from "@/lib/chantier-labels";
import { RmdMultiSelect } from "./rmd-multi-select";

interface ChantierData {
  id: string;
  code: string;
  nom: string;
  description: string;
  domaine: string;
  type_chantier: string;
  priorite: string;
  duree_mois: number;
  budget: number;
  budgetJH: number;
  budgetProjetMAD: number;
  conseilEditeursMAD: number;
  licencesAchatsMAD: number;
  licencesAbonnementsMAD: number;
  coutsInfrasMAD: number;
  budgetTotalMAD: number;
  directeur: string;
  pmo: string;
  date_debut: Date;
  date_fin: Date;
  statut: string;
  avancement: number;
  rmds?: { rmd: { id: string } }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chantier?: ChantierData | null;
}

function toDateInput(d: Date) {
  return new Date(d).toISOString().split("T")[0];
}

export function ChantierFormDialog({ open, onOpenChange, chantier }: Props) {
  const isEdit = !!chantier;
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState(chantier?.code ?? "");
  const [nom, setNom] = useState(chantier?.nom ?? "");
  const [description, setDescription] = useState(chantier?.description ?? "");
  const [domaine, setDomaine] = useState(chantier?.domaine ?? "Cockpit");
  const [typeChantier, setTypeChantier] = useState(chantier?.type_chantier ?? "Progiciel + Sélection");
  const [priorite, setPriorite] = useState(chantier?.priorite ?? "Fondations techniques");
  const [dureeMois, setDureeMois] = useState(chantier?.duree_mois ?? 12);
  const [budgetJH, setBudgetJH] = useState(chantier?.budgetJH ?? 0);
  const [budgetProjetMAD, setBudgetProjetMAD] = useState(chantier?.budgetProjetMAD ?? 0);
  const [conseilEditeursMAD, setConseilEditeursMAD] = useState(chantier?.conseilEditeursMAD ?? 0);
  const [licencesAchatsMAD, setLicencesAchatsMAD] = useState(chantier?.licencesAchatsMAD ?? 0);
  const [licencesAbonnementsMAD, setLicencesAbonnementsMAD] = useState(chantier?.licencesAbonnementsMAD ?? 0);
  const [coutsInfrasMAD, setCoutsInfrasMAD] = useState(chantier?.coutsInfrasMAD ?? 0);
  const [rmdIds, setRmdIds] = useState<string[]>(
    chantier?.rmds?.map((cr) => cr.rmd.id) ?? []
  );
  const [dateDebut, setDateDebut] = useState(
    chantier ? toDateInput(chantier.date_debut) : ""
  );
  const [dateFin, setDateFin] = useState(
    chantier ? toDateInput(chantier.date_fin) : ""
  );
  const [statut, setStatut] = useState(chantier?.statut ?? "Non démarré");
  const [avancement, setAvancement] = useState(chantier?.avancement ?? 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const budgetTotal = budgetProjetMAD + conseilEditeursMAD + licencesAchatsMAD + licencesAbonnementsMAD + coutsInfrasMAD;
    const data = {
      code,
      nom,
      description,
      domaine,
      type_chantier: typeChantier,
      priorite,
      duree_mois: dureeMois,
      budget: budgetTotal,
      budgetJH,
      budgetProjetMAD,
      conseilEditeursMAD,
      licencesAchatsMAD,
      licencesAbonnementsMAD,
      coutsInfrasMAD,
      budgetTotalMAD: budgetTotal,
      directeur: "",
      pmo: "",
      date_debut: dateDebut,
      date_fin: dateFin,
      statut,
      avancement,
      rmdIds,
    };
    if (isEdit) {
      await updateChantier(chantier.id, data);
    } else {
      await createChantier(data);
    }
    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le chantier" : "Nouveau chantier"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Code</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CH_047"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Domaine</label>
              <Select value={domaine} onValueChange={setDomaine}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOMAINE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Nom</label>
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none disabled:opacity-50"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Type chantier</label>
              <Select value={typeChantier} onValueChange={setTypeChantier}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CHANTIER_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Priorité</label>
              <Select value={priorite} onValueChange={setPriorite}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITE_CHANTIER_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">RMD</label>
            <RmdMultiSelect
              selected={rmdIds}
              onChange={setRmdIds}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date début</label>
              <Input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Date fin</label>
              <Input
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Durée (mois)</label>
              <Input
                type="number"
                min={0}
                value={dureeMois}
                onChange={(e) => setDureeMois(Number(e.target.value))}
              />
            </div>
          </div>
          {/* Budget fields */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Budget Projet (JH)</label>
              <Input type="number" min={0} value={budgetJH} onChange={(e) => setBudgetJH(Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Budget Projet (MAD)</label>
              <Input type="number" min={0} value={budgetProjetMAD} onChange={(e) => setBudgetProjetMAD(Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Conseil Éditeurs (MAD)</label>
              <Input type="number" min={0} value={conseilEditeursMAD} onChange={(e) => setConseilEditeursMAD(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Licences Achat (MAD)</label>
              <Input type="number" min={0} value={licencesAchatsMAD} onChange={(e) => setLicencesAchatsMAD(Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Licences Abonn. (MAD)</label>
              <Input type="number" min={0} value={licencesAbonnementsMAD} onChange={(e) => setLicencesAbonnementsMAD(Number(e.target.value))} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Coûts Infras (MAD)</label>
              <Input type="number" min={0} value={coutsInfrasMAD} onChange={(e) => setCoutsInfrasMAD(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Statut</label>
              <Select value={statut} onValueChange={setStatut} disabled>
                <SelectTrigger className="w-full bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUT_CHANTIER_LABELS).map(
                    ([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Calculé automatiquement depuis les jalons</p>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Avancement (%)</label>
              <Input
                type="number"
                value={avancement}
                readOnly
                className="bg-muted"
              />
              <p className="text-[10px] text-muted-foreground">Calculé automatiquement depuis les jalons</p>
            </div>
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
