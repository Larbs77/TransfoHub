"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RmdFormDialog } from "./rmd-form-dialog";
import { useCanWritePage } from "@/components/user-provider";

export function AddRmdButton() {
  const [open, setOpen] = useState(false);
  const canWrite = useCanWritePage("/rmds");
  if (!canWrite) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nouveau RMD
      </Button>
      {open && (
        <RmdFormDialog
          open={open}
          onOpenChange={(o) => !o && setOpen(false)}
        />
      )}
    </>
  );
}
