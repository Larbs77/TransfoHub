"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, ArrowRight, FolderKanban, ShieldAlert, Building2 } from "lucide-react";
import { deleteRessource } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RessourceFormDialog } from "./ressource-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import {
  RESSOURCE_TYPE_LABELS,
  RESSOURCE_TYPE_COLORS,
} from "@/lib/ressource-labels";

interface RessourceWithStats {
  id: string;
  nom_complet: string;
  email: string;
  telephone: string;
  type: string;
  organisation: string;
  tarif_journalier: number;
  capacite_jours_mois: number;
  actif: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { membres: number; raids: number };
}

export function RessourceCard({ ressource }: { ressource: RessourceWithStats }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="space-y-1">
            <CardDescription className="flex items-center gap-1.5">
              <Badge
                style={{
                  backgroundColor: RESSOURCE_TYPE_COLORS[ressource.type],
                  color: "white",
                }}
              >
                {RESSOURCE_TYPE_LABELS[ressource.type] ?? ressource.type}
              </Badge>
              <Badge
                variant={ressource.actif ? "default" : "secondary"}
                className={`text-[10px] ${ressource.actif ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
              >
                {ressource.actif ? "Actif" : "Inactif"}
              </Badge>
            </CardDescription>
            <CardTitle className="text-sm leading-snug">
              {ressource.nom_complet}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-between gap-2">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-lg font-bold flex items-center justify-center gap-1">
                <FolderKanban className="size-4 text-muted-foreground" />
                {ressource._count.membres}
              </div>
              <div className="text-xs text-muted-foreground">Chantiers</div>
            </div>
            <div>
              <div className="text-lg font-bold flex items-center justify-center gap-1">
                <ShieldAlert className="size-4 text-muted-foreground" />
                {ressource._count.raids}
              </div>
              <div className="text-xs text-muted-foreground">RAID</div>
            </div>
            <div>
              <div className="text-sm font-medium flex items-center justify-center gap-1 min-h-[1.75rem]">
                <Building2 className="size-4 text-muted-foreground" />
                <span className="truncate">{ressource.organisation || "—"}</span>
              </div>
              <div className="text-xs text-muted-foreground">Organisation</div>
            </div>
          </div>
          {ressource.tarif_journalier > 0 && (
            <div className="text-xs text-muted-foreground text-center">
              TJM: {ressource.tarif_journalier.toLocaleString("fr-MA")} MAD/jour
            </div>
          )}
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
            <Link href={`/ressources/${ressource.id}`}>
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
        <RessourceFormDialog
          open={editOpen}
          onOpenChange={(open) => !open && setEditOpen(false)}
          ressource={ressource}
        />
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
        onConfirm={async () => {
          try {
            await deleteRessource(ressource.id);
          } catch (err) {
            setDeleteError(
              err instanceof Error ? err.message : "Erreur de suppression"
            );
            throw err;
          }
        }}
        title="Supprimer la ressource"
      />
    </>
  );
}
