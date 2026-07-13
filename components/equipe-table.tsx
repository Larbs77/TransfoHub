"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Users, Crown, Network } from "lucide-react";
import { deleteMembreEquipe } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembreEquipeFormDialog } from "./membre-equipe-form-dialog";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { EQUIPE_LABELS, EQUIPE_COLORS } from "@/lib/equipe-labels";
import { OrganigrammeChantier } from "./organigramme-chantier";

interface Membre {
  id: string;
  equipe: string;
  role: string;
  commentaires?: string;
  is_directeur?: boolean;
  charge_pourcentage?: number;
  ressourceId: string;
  ressource?: { id: string; nom_complet: string } | null;
}

interface RmdInfo {
  rmd: { id: string; nom_complet: string; domaine: string };
}

interface Props {
  membres: Membre[];
  chantierId: string;
  directeur: string;
  rmds?: RmdInfo[];
}

const EQUIPE_ORDER = ["PMO", "AMOA", "MOE", "Métiers", "Sécurité", "EI"];

function membreDisplayName(m: Membre): string {
  return m.ressource?.nom_complet?.trim() || "—";
}

export function EquipeTable({ membres, chantierId, directeur, rmds }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Group by equipe
  const grouped = new Map<string, Membre[]>();
  for (const m of membres) {
    const list = grouped.get(m.equipe) ?? [];
    list.push(m);
    grouped.set(m.equipe, list);
  }

  // All equipes (show all tabs, even empty ones)
  const allEquipes = EQUIPE_ORDER;
  const firstWithMembers =
    allEquipes.find((e) => (grouped.get(e)?.length ?? 0) > 0) ?? allEquipes[0];
  const [activeTab, setActiveTab] = useState(firstWithMembers);

  // Find directeur from membres
  const directeurMembre = membres.find((m) => m.is_directeur);
  const directeurName = directeurMembre
    ? membreDisplayName(directeurMembre)
    : directeur;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {membres.length} membre(s) dans{" "}
            {allEquipes.filter((e) => grouped.has(e)).length} équipe(s)
          </span>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Ajouter un membre
        </Button>
      </div>

      <Tabs
        defaultValue={firstWithMembers}
        onValueChange={setActiveTab}
        className="space-y-3"
      >
        <TabsList className="h-auto p-1 gap-1">
          {allEquipes.map((equipe) => {
            const count = grouped.get(equipe)?.length ?? 0;
            const color = EQUIPE_COLORS[equipe] ?? "hsl(0, 0%, 50%)";
            return (
              <TabsTrigger
                key={equipe}
                value={equipe}
                className="gap-2 px-3 py-1.5"
              >
                <span
                  className="inline-block size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                {EQUIPE_LABELS[equipe] ?? equipe}
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                  {count}
                </span>
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="organigramme" className="gap-2 px-3 py-1.5">
            <Network className="size-4 text-primary" />
            Organigramme
          </TabsTrigger>
        </TabsList>

        {allEquipes.map((equipe) => {
          const membresEquipe = grouped.get(equipe) ?? [];
          const color = EQUIPE_COLORS[equipe] ?? "hsl(0, 0%, 50%)";
          return (
            <TabsContent key={equipe} value={equipe}>
              <div
                className="rounded-lg border-l-4 bg-card"
                style={{ borderLeftColor: color }}
              >
                {membresEquipe.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun membre dans l&apos;équipe {EQUIPE_LABELS[equipe]}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Ressource</TableHead>
                        <TableHead>Commentaires</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membresEquipe.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1.5">
                              {m.is_directeur && (
                                <Crown className="size-3.5 text-primary shrink-0" />
                              )}
                              {m.role}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {membreDisplayName(m)}
                              {m.is_directeur && (
                                <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                                  Directeur
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                            {m.commentaires?.trim() || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setEditMembre(m)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => setDeleteId(m.id)}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          );
        })}

        <TabsContent value="organigramme">
          <OrganigrammeChantier
            directeur={directeurName}
            membres={membres}
            rmds={rmds}
          />
        </TabsContent>
      </Tabs>

      {addOpen && (
        <MembreEquipeFormDialog
          open={addOpen}
          onOpenChange={(o) => !o && setAddOpen(false)}
          chantierId={chantierId}
          defaultEquipe={activeTab !== "organigramme" ? activeTab : undefined}
        />
      )}

      {editMembre && (
        <MembreEquipeFormDialog
          open={!!editMembre}
          onOpenChange={(o) => !o && setEditMembre(null)}
          chantierId={chantierId}
          membre={editMembre}
        />
      )}

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteMembreEquipe(deleteId);
        }}
        title="Supprimer le membre"
      />
    </div>
  );
}
