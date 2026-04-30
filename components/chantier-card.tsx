"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Pencil, Trash2, ArrowRight, Crown, Star } from "lucide-react";
import { formatMADCompact } from "@/lib/utils-pmo";
import { deleteChantier, toggleFavori } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ChantierFormDialog } from "./chantier-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import {
  STATUT_CHANTIER_LABELS,
  STATUT_CHANTIER_COLORS,
  PRIORITE_CHANTIER_LABELS,
  PRIORITE_CHANTIER_COLORS,
} from "@/lib/chantier-labels";

interface ChantierWithStats {
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
  createdAt: Date;
  updatedAt: Date;
  _count: { raids: number };
  raids: { type: string; statut: string }[];
  rmds?: { rmd: { id: string; nom_complet: string } }[];
  membres?: { nom_complet: string }[];
}

export function ChantierCard({
  chantier,
  isFavori = false,
}: {
  chantier: ChantierWithStats;
  isFavori?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [favori, setFavori] = useState(isFavori);

  const directeurName = chantier.membres?.[0]?.nom_complet || chantier.directeur;
  const actionsCount = chantier.raids.filter((r) => r.type === "Action").length;
  const risksCount = chantier.raids.filter((r) => r.type === "Risque").length;

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <CardDescription className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="shrink-0">{chantier.code}</Badge>
                <Badge className="shrink-0" style={{ backgroundColor: STATUT_CHANTIER_COLORS[chantier.statut], color: "white" }}>
                  {STATUT_CHANTIER_LABELS[chantier.statut] ?? chantier.statut}
                </Badge>
              </CardDescription>
              <CardTitle className="text-sm leading-snug line-clamp-2">{chantier.nom}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0 mt-0.5"
              onClick={async () => {
                setFavori(!favori);
                await toggleFavori(chantier.id);
              }}
            >
              <Star
                className={`size-4 transition-colors ${favori ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
              />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <Badge className="text-[10px] shrink-0" style={{ backgroundColor: PRIORITE_CHANTIER_COLORS[chantier.priorite], color: "white" }}>
              {PRIORITE_CHANTIER_LABELS[chantier.priorite] ?? chantier.priorite}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-between gap-2">
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            <div>
              <div className="text-sm font-bold">{actionsCount}</div>
              <div className="text-xs text-muted-foreground">Actions</div>
            </div>
            <div>
              <div className="text-sm font-bold">{risksCount}</div>
              <div className="text-xs text-muted-foreground">Risques</div>
            </div>
            <div>
              <div className="text-sm font-bold">{chantier.duree_mois}m</div>
              <div className="text-xs text-muted-foreground">Durée</div>
            </div>
            <div>
              <div className="text-sm font-bold text-nowrap">{formatMADCompact(chantier.budgetTotalMAD)}</div>
              <div className="text-xs text-muted-foreground">Budget</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${chantier.avancement}%`,
                  backgroundColor: STATUT_CHANTIER_COLORS[chantier.statut] ?? "#6b7280",
                }}
              />
            </div>
            <span className="text-muted-foreground font-medium shrink-0">{chantier.avancement}%</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            {directeurName && (
              <div className="flex items-center gap-1">
                <Crown className="size-3 text-primary shrink-0" />
                <span className="font-medium">Directeur:</span> {directeurName}
              </div>
            )}
            <div>
              {format(new Date(chantier.date_debut), "dd MMM yyyy", { locale: fr })}
              {" → "}
              {format(new Date(chantier.date_fin), "dd MMM yyyy", { locale: fr })}
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
            <Link href={`/chantiers/${chantier.id}`}>
              <Button variant="outline" size="sm" className="gap-1">
                Détails <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
          {deleteError && (
            <p className="text-xs text-destructive">{deleteError}</p>
          )}
        </CardContent>
      </Card>

      {editOpen && (
        <ChantierFormDialog
          open={editOpen}
          onOpenChange={(open) => !open && setEditOpen(false)}
          chantier={chantier}
        />
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
        onConfirm={async () => {
          try {
            await deleteChantier(chantier.id);
          } catch (err) {
            setDeleteError(
              err instanceof Error ? err.message : "Erreur de suppression"
            );
            throw err;
          }
        }}
        title="Supprimer le chantier"
      />
    </>
  );
}
