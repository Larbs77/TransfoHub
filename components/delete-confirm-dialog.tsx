"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motif?: string) => Promise<void>;
  title?: string;
  description?: string;
  /** When set, a non-empty motif is required before confirming. */
  requireMotif?: boolean;
  motifLabel?: string;
  motifPlaceholder?: string;
  confirmLabel?: string;
  confirmVariant?: "destructive" | "default";
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Confirmer la suppression",
  description = "Etes-vous sûr de vouloir supprimer cet élément ? Cette action est irréversible.",
  requireMotif = false,
  motifLabel = "Motif de la suppression",
  motifPlaceholder = "Expliquez pourquoi cet élément est supprimé…",
  confirmLabel = "Supprimer",
  confirmVariant = "destructive",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [motif, setMotif] = useState("");
  const [motifError, setMotifError] = useState("");

  useEffect(() => {
    if (open) {
      setMotif("");
      setMotifError("");
    }
  }, [open]);

  async function handleConfirm() {
    if (requireMotif && !motif.trim()) {
      setMotifError("Le motif de suppression est obligatoire.");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(requireMotif ? motif.trim() : undefined);
      onOpenChange(false);
    } catch (err) {
      setMotifError(
        err instanceof Error ? err.message : "Action impossible."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {requireMotif && (
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">
              {motifLabel} <span className="text-destructive">*</span>
            </label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                setMotifError("");
              }}
              placeholder={motifPlaceholder}
            />
            {motifError && (
              <p className="text-xs text-destructive">{motifError}</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
