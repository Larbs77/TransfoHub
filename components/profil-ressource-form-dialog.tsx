"use client";

import { useState } from "react";
import { createProfilRessource, updateProfilRessource } from "@/app/(app)/actions";
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
import { Loader2, CircleCheck, CircleX } from "lucide-react";
import { RESSOURCE_TYPE_LABELS } from "@/lib/ressource-labels";

interface ProfilData {
  id: string;
  nom: string;
  type_ressource: string;
  tjm_defaut: number;
  ordre: number;
  actif: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profil?: ProfilData | null;
}

export function ProfilRessourceFormDialog({ open, onOpenChange, profil }: Props) {
  const isEdit = !!profil;
  const [loading, setLoading] = useState(false);

  const [nom, setNom] = useState(profil?.nom ?? "");
  const [typeRessource, setTypeRessource] = useState(profil?.type_ressource ?? "Interne");
  const [tjmDefaut, setTjmDefaut] = useState(profil?.tjm_defaut ?? 0);
  const [ordre, setOrdre] = useState(profil?.ordre ?? 0);
  const [actif, setActif] = useState(profil?.actif ?? true);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const data = {
      nom,
      type_ressource: typeRessource,
      tjm_defaut: tjmDefaut,
      ordre,
      actif,
    };
    if (isEdit) {
      await updateProfilRessource(profil.id, data);
    } else {
      await createProfilRessource(data);
    }
    setLoading(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le profil" : "Nouveau profil"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {/* Nom */}
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Nom du profil</label>
            <Input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Chef de projet, Architecte Data..."
              required
            />
          </div>

          {/* Type + TJM */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Type de ressource</label>
              <Select value={typeRessource} onValueChange={setTypeRessource}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RESSOURCE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">TJM par défaut (MAD)</label>
              <Input
                type="number"
                min={0}
                value={tjmDefaut}
                onChange={(e) => setTjmDefaut(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Ordre + Actif */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Ordre d&apos;affichage</label>
              <Input
                type="number"
                min={0}
                value={ordre}
                onChange={(e) => setOrdre(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Statut</label>
              <button
                type="button"
                className="flex items-center gap-2 text-sm h-9 px-3 border rounded-md"
                onClick={() => setActif(!actif)}
              >
                {actif ? (
                  <CircleCheck className="size-5 text-emerald-500" />
                ) : (
                  <CircleX className="size-5 text-muted-foreground" />
                )}
                <span className={actif ? "font-medium" : "text-muted-foreground"}>
                  {actif ? "Actif" : "Inactif"}
                </span>
              </button>
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
