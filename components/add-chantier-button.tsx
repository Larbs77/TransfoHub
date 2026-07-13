"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChantierFormDialog } from "./chantier-form-dialog";
import { useCanCreateChantier } from "@/components/user-provider";

export function AddChantierButton() {
  const [open, setOpen] = useState(false);
  const canCreate = useCanCreateChantier();

  if (!canCreate) return null;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nouveau Chantier
      </Button>
      <ChantierFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
