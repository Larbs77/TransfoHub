"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Pencil,
  Trash2,
  ArrowRight,
  FolderKanban,
  ShieldAlert,
  Building2,
  UserCircle,
} from "lucide-react";
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
  profilId?: string | null;
  equipeHierarchieId?: string | null;
  equipeHierarchie?: { id: string; name: string; is_active: boolean } | null;
  equipesFonctionnelles?: {
    equipeId: string;
    equipe?: { id: string; name: string; is_active: boolean };
  }[];
  user?: {
    id: string;
    username: string;
    role: string;
    is_active: boolean;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { membres: number; raids: number };
}

export function RessourceCard({
  ressource,
  equipes = [],
  activeRoles = [],
  canCreateAccount = false,
}: {
  ressource: RessourceWithStats;
  equipes?: { id: string; name: string; is_active: boolean }[];
  activeRoles?: { code: string; label: string }[];
  canCreateAccount?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="space-y-1">
            <CardDescription className="flex flex-wrap items-center gap-1.5">
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
              {ressource.user ? (
                <Badge className="text-[10px] bg-blue-600 hover:bg-blue-600">
                  Compte
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">
                  Sans compte
                </Badge>
              )}
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
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <span className="truncate" title={
                  ressource.equipeHierarchie?.name ||
                  ressource.organisation ||
                  undefined
                }>
                  {ressource.equipeHierarchie?.name?.trim() ||
                    ressource.organisation ||
                    "—"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">Équipe</div>
            </div>
          </div>
          {ressource.user && (
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <UserCircle className="size-3.5" />
              {ressource.user.username}
            </div>
          )}
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
          equipes={equipes}
          activeRoles={activeRoles}
          canCreateAccount={canCreateAccount}
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
