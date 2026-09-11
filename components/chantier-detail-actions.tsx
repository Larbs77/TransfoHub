"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChantierFormDialog } from "./chantier-form-dialog";
import {
  useCanWritePage,
  useIsConsultationChantier,
} from "@/components/user-provider";

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
  lien_espace_documentaire?: string;
}

export function ConsultationChantierBadge({
  chantierId,
}: {
  chantierId: string;
}) {
  const yes = useIsConsultationChantier(chantierId);
  if (!yes) return null;
  return (
    <Badge variant="secondary" className="text-[11px]">
      Consultation
    </Badge>
  );
}

export function ChantierDetailActions({ chantier }: { chantier: ChantierData }) {
  const [editOpen, setEditOpen] = useState(false);
  const canWrite = useCanWritePage("/chantiers");
  const consultationOnly = useIsConsultationChantier(chantier.id);
  if (!canWrite || consultationOnly) return null;

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
