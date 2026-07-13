"use client";

import { useState, useEffect } from "react";
import {
  createMembreEquipe,
  updateMembreEquipe,
  getRessourcesForSelect,
} from "@/app/(app)/actions";
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
import { Loader2, Crown } from "lucide-react";
import { EQUIPE_LABELS, ROLE_PAR_EQUIPE } from "@/lib/equipe-labels";

interface MembreData {
  id: string;
  equipe: string;
  role: string;
  commentaires?: string;
  is_directeur?: boolean;
  charge_pourcentage?: number;
  ressourceId: string;
  ressource?: { id: string; nom_complet: string } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chantierId: string;
  membre?: MembreData | null;
  defaultEquipe?: string;
}

export function MembreEquipeFormDialog({
  open,
  onOpenChange,
  chantierId,
  membre,
  defaultEquipe,
}: Props) {
  const isEdit = !!membre;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialEquipe = membre?.equipe ?? defaultEquipe ?? "AMOA";
  const [equipe, setEquipe] = useState(initialEquipe);
  const [role, setRole] = useState(
    membre?.role ?? ROLE_PAR_EQUIPE[initialEquipe]?.[0] ?? ROLE_PAR_EQUIPE["AMOA"][0]
  );
  const [commentaires, setCommentaires] = useState(membre?.commentaires ?? "");
  const [isDirecteur, setIsDirecteur] = useState(membre?.is_directeur ?? false);
  const [chargePourcentage, setChargePourcentage] = useState(
    membre?.charge_pourcentage ?? 100
  );
  const [ressourceId, setRessourceId] = useState(membre?.ressourceId ?? "");

  const [ressources, setRessources] = useState<
    { id: string; nom_complet: string; type: string; organisation: string }[]
  >([]);

  useEffect(() => {
    if (open) {
      getRessourcesForSelect().then(setRessources);
      setError(null);
      if (membre) {
        setEquipe(membre.equipe);
        setRole(membre.role);
        setCommentaires(membre.commentaires ?? "");
        setIsDirecteur(membre.is_directeur ?? false);
        setChargePourcentage(membre.charge_pourcentage ?? 100);
        setRessourceId(membre.ressourceId);
      } else {
        setEquipe(defaultEquipe ?? "AMOA");
        setRole(
          ROLE_PAR_EQUIPE[defaultEquipe ?? "AMOA"]?.[0] ?? ROLE_PAR_EQUIPE["AMOA"][0]
        );
        setCommentaires("");
        setIsDirecteur(false);
        setChargePourcentage(100);
        setRessourceId("");
      }
    }
  }, [open, membre, defaultEquipe]);

  const roles = ROLE_PAR_EQUIPE[equipe] ?? [];

  function handleEquipeChange(newEquipe: string) {
    setEquipe(newEquipe);
    const newRoles = ROLE_PAR_EQUIPE[newEquipe] ?? [];
    if (!newRoles.includes(role)) {
      setRole(newRoles[0] ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ressourceId) {
      setError("Veuillez sélectionner une ressource.");
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await updateMembreEquipe(membre.id, {
          equipe,
          role,
          commentaires,
          is_directeur: isDirecteur,
          charge_pourcentage: chargePourcentage,
          ressourceId,
        });
      } else {
        await createMembreEquipe({
          chantierId,
          equipe,
          role,
          commentaires,
          is_directeur: isDirecteur,
          charge_pourcentage: chargePourcentage,
          ressourceId,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le membre" : "Ajouter un membre"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Équipe</label>
              <Select value={equipe} onValueChange={handleEquipeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Rôle</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">
              Ressource <span className="text-destructive">*</span>
            </label>
            <Select value={ressourceId || undefined} onValueChange={setRessourceId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner une ressource" />
              </SelectTrigger>
              <SelectContent>
                {ressources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nom_complet}
                    {r.organisation ? ` (${r.organisation})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Le membre doit exister dans le catalogue Ressources.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Commentaires{" "}
                <span className="text-muted-foreground font-normal">(optionnel)</span>
              </label>
              <Input
                value={commentaires}
                onChange={(e) => setCommentaires(e.target.value)}
                placeholder="Notes sur l'affectation…"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Charge %</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={10}
                value={chargePourcentage}
                onChange={(e) => setChargePourcentage(Number(e.target.value))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none rounded-md border px-3 py-2 hover:bg-accent/50 transition-colors">
            <input
              type="checkbox"
              checked={isDirecteur}
              onChange={(e) => setIsDirecteur(e.target.checked)}
              className="size-4 rounded border-input accent-primary"
            />
            <Crown className="size-4 text-primary" />
            <span className="text-sm font-medium">Directeur de chantier</span>
          </label>

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
            <Button type="submit" disabled={loading || !ressourceId}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
