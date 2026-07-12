"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComiteFormDialog } from "./comite-form-dialog";
import type { ComiteParametreOption } from "@/lib/comite-labels";

export function AddComiteButton({
  instances = [],
}: {
  instances?: ComiteParametreOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={instances.length === 0}>
        <Plus className="size-4" />
        Nouveau comité
      </Button>
      {open && (
        <ComiteFormDialog
          open={open}
          onOpenChange={(o) => !o && setOpen(false)}
          instances={instances}
        />
      )}
    </>
  );
}
