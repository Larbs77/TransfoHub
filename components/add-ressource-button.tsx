"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  RessourceFormDialog,
  type EquipeOption,
  type ActiveRoleOption,
} from "./ressource-form-dialog";

export function AddRessourceButton({
  equipes = [],
  activeRoles = [],
  canCreateAccount = false,
}: {
  equipes?: EquipeOption[];
  activeRoles?: ActiveRoleOption[];
  canCreateAccount?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={equipes.length === 0}>
        <Plus className="size-4" />
        Nouvelle ressource
      </Button>
      {open && (
        <RessourceFormDialog
          open={open}
          onOpenChange={(o) => !o && setOpen(false)}
          equipes={equipes}
          activeRoles={activeRoles}
          canCreateAccount={canCreateAccount}
        />
      )}
    </>
  );
}
