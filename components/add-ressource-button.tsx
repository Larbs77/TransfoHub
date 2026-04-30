"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RessourceFormDialog } from "./ressource-form-dialog";

export function AddRessourceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nouvelle ressource
      </Button>
      {open && (
        <RessourceFormDialog
          open={open}
          onOpenChange={(o) => !o && setOpen(false)}
        />
      )}
    </>
  );
}
