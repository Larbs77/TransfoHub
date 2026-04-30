"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChantierFormDialog } from "./chantier-form-dialog";

export function AddChantierButton() {
  const [open, setOpen] = useState(false);

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
