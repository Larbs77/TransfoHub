"use client";

import { useState } from "react";
import { createRmd, updateRmd } from "@/app/(app)/actions";
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
import { DOMAINE_LABELS } from "@/lib/chantier-labels";

interface RmdData {
  id: string;
  nom_complet: string;
  domaine: string;
  suppleant: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rmd?: RmdData | null;
}

export function RmdFormDialog({ open, onOpenChange, rmd }: Props) {
  const isEdit = !!rmd;
  const [loading, setLoading] = useState(false);

  const [nomComplet, setNomComplet] = useState(rmd?.nom_complet ?? "");
  const [domaine, setDomaine] = useState(rmd?.domaine ?? "Cockpit");
  const [suppleant, setSuppleant] = useState(rmd?.suppleant ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const data = {
      nom_complet: nomComplet,
      domaine,
      suppleant,
    };
    if (isEdit) {
      await updateRmd(rmd.id, data);
    } else {
      await createRmd(data);
    }
    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le RMD" : "Nouveau RMD"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Nom complet</label>
            <Input
              value={nomComplet}
              onChange={(e) => setNomComplet(e.target.value)}
              placeholder="Nom et prénom"
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
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Suppléant(e)</label>
            <Input
              value={suppleant}
              onChange={(e) => setSuppleant(e.target.value)}
              placeholder="Nom du suppléant"
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
