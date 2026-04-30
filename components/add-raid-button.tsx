"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RaidFormDialog } from "./raid-form-dialog";

interface Props {
  defaultType?: string;
  defaultChantierId?: string;
  defaultComiteId?: string;
  label?: string;
}

export function AddRaidButton({ defaultType, defaultChantierId, defaultComiteId, label }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {label ?? "Ajouter"}
      </Button>
      <RaidFormDialog
        open={open}
        onOpenChange={setOpen}
        defaultType={defaultType}
        defaultChantierId={defaultChantierId}
        defaultComiteId={defaultComiteId}
      />
    </>
  );
}
