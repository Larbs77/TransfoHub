"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChantierFormDialog } from "./chantier-form-dialog";

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

export function ChantierDetailActions({ chantier }: { chantier: ChantierData }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 shrink-0"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="size-3.5" />
        Modifier
      </Button>

      {editOpen && (
        <ChantierFormDialog
          open={editOpen}
          onOpenChange={(open) => !open && setEditOpen(false)}
          chantier={chantier}
        />
      )}
    </>
  );
}
