"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComiteFormDialog } from "./comite-form-dialog";

export function AddComiteButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nouveau comité
      </Button>
      {open && (
        <ComiteFormDialog
          open={open}
          onOpenChange={(o) => !o && setOpen(false)}
        />
      )}
    </>
  );
}
