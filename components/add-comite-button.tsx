"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComiteFormDialog } from "./comite-form-dialog";
import { useCanWritePage, useUser } from "@/components/user-provider";
import type { ComiteParametreOption } from "@/lib/comite-labels";
import { isComiteNiveauOperationnel } from "@/lib/comite-niveau";

export function AddComiteButton({
  instances = [],
}: {
  instances?: ComiteParametreOption[];
}) {
  const [open, setOpen] = useState(false);
  const canWrite = useCanWritePage("/comites");
  const { chantierScope } = useUser();
  const creatable = useMemo(() => {
    const active = instances.filter((p) => p.is_active);
    if (chantierScope === "all") return active;
    return active.filter((p) => isComiteNiveauOperationnel(p.niveau));
  }, [instances, chantierScope]);

  if (!canWrite) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={creatable.length === 0}>
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
