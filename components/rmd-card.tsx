"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, ArrowRight, FolderKanban, UserCheck } from "lucide-react";
import { deleteRmd } from "@/app/(app)/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RmdFormDialog } from "./rmd-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { DOMAINE_LABELS, DOMAINE_COLORS } from "@/lib/chantier-labels";

interface RmdWithStats {
  id: string;
  nom_complet: string;
  domaine: string;
  suppleant: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { chantiers: number };
}

export function RmdCard({ rmd }: { rmd: RmdWithStats }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="space-y-1">
            <CardDescription className="flex items-center gap-1.5">
              <Badge style={{ backgroundColor: DOMAINE_COLORS[rmd.domaine], color: "white" }}>{DOMAINE_LABELS[rmd.domaine] ?? rmd.domaine}</Badge>
            </CardDescription>
            <CardTitle className="text-sm leading-snug">{rmd.nom_complet}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-between gap-2">
          <div className="grid grid-cols-2 gap-2 text-center text-sm">
            <div>
              <div className="text-lg font-bold flex items-center justify-center gap-1">
                <FolderKanban className="size-4 text-muted-foreground" />
                {rmd._count.chantiers}
              </div>
              <div className="text-xs text-muted-foreground">Chantiers</div>
            </div>
            <div>
              <div className="text-sm font-medium flex items-center justify-center gap-1 min-h-[1.75rem]">
                <UserCheck className="size-4 text-muted-foreground" />
                <span className="truncate">{rmd.suppleant || "—"}</span>
              </div>
              <div className="text-xs text-muted-foreground">Suppléant(e)</div>
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
            <Link href={`/rmds/${rmd.id}`}>
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
        <RmdFormDialog
          open={editOpen}
          onOpenChange={(open) => !open && setEditOpen(false)}
          rmd={rmd}
        />
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => !open && setDeleteOpen(false)}
        onConfirm={async () => {
          try {
            await deleteRmd(rmd.id);
          } catch (err) {
            setDeleteError(
              err instanceof Error ? err.message : "Erreur de suppression"
            );
            throw err;
          }
        }}
        title="Supprimer le RMD"
      />
    </>
  );
}
