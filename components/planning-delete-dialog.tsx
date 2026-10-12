"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DELETE_KEYWORD = "supprimer";

type DeleteStep = "comment" | "keyword" | "confirm";

export type PlanningDeleteKind = "jalon" | "workstream" | "activite";

const KIND_LABEL: Record<PlanningDeleteKind, string> = {
  jalon: "jalon",
  workstream: "workstream",
  activite: "activité",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** VALIDATION = existing 1-screen request. DIRECT = 3-step wizard. */
  mode: "DIRECT" | "VALIDATION";
  kind: PlanningDeleteKind;
  itemName: string;
  /** Extra sentence for cascade (jalon / workstream). */
  cascadeHint?: string;
  pending?: boolean;
  error?: string;
  onConfirm: (motif: string) => void | Promise<void>;
}

export function PlanningDeleteDialog({
  open,
  onOpenChange,
  mode,
  kind,
  itemName,
  cascadeHint,
  pending = false,
  error,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<DeleteStep>("comment");
  const [motif, setMotif] = useState("");
  const [keyword, setKeyword] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("comment");
      setMotif("");
      setKeyword("");
      setLocalError("");
    }
  }, [open]);

  const kindLabel = KIND_LABEL[kind];
  const displayError = localError || error;

  function close() {
    if (pending) return;
    onOpenChange(false);
  }

  async function submit() {
    setLocalError("");
    const text = motif.trim();
    if (!text) {
      setLocalError(
        mode === "VALIDATION"
          ? "Le motif de la demande est obligatoire."
          : "Le commentaire est obligatoire pour supprimer."
      );
      return;
    }
    if (mode === "DIRECT" && keyword.trim() !== DELETE_KEYWORD) {
      setLocalError(`Tapez exactement « ${DELETE_KEYWORD} ».`);
      return;
    }
    await onConfirm(text);
  }

  if (mode === "VALIDATION") {
    return (
      <Dialog open={open} onOpenChange={(o) => (!pending ? onOpenChange(o) : undefined)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Demande de suppression</DialogTitle>
            <DialogDescription>
              Soumettre une demande de suppression pour « {itemName} » ?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">
              Motif <span className="text-destructive">*</span>
            </label>
            <Input
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                setLocalError("");
              }}
              placeholder="Justifiez la suppression..."
              disabled={pending}
            />
          </div>
          {displayError ? (
            <p className="text-sm text-destructive" role="alert">
              {displayError}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={close}>
              Annuler
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => void submit()}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-5" />
            Supprimer {kind === "activite" ? "l'activité" : `le ${kindLabel}`}
          </DialogTitle>
          <DialogDescription>
            « {itemName} » — suppression définitive, sans passage par le
            workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {(
            [
              ["comment", "1 · Commentaire"],
              ["keyword", "2 · Validation"],
              ["confirm", "3 · Confirmation"],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className={
                step === key
                  ? "rounded-md bg-destructive px-2 py-1.5 text-center font-semibold text-destructive-foreground"
                  : "rounded-md bg-muted px-2 py-1.5 text-center text-muted-foreground"
              }
            >
              {label}
            </div>
          ))}
        </div>

        {step === "comment" && (
          <div className="space-y-3">
            <p className="rounded-lg border bg-muted/40 p-3 text-sm">
              Indiquez pourquoi vous supprimez ce {kindLabel}. Le commentaire
              est conservé dans l&apos;historique.
            </p>
            <Input
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                setLocalError("");
              }}
              placeholder="Commentaire obligatoire…"
              disabled={pending}
              autoComplete="off"
            />
          </div>
        )}

        {step === "keyword" && (
          <div className="space-y-3">
            <p className="rounded-lg border bg-muted/40 p-3 text-sm">
              Tapez exactement
              <strong className="mx-1 font-mono text-destructive">
                {DELETE_KEYWORD}
              </strong>
              pour continuer.
            </p>
            <Input
              className="font-mono"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setLocalError("");
              }}
              placeholder={DELETE_KEYWORD}
              autoComplete="off"
              disabled={pending}
            />
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Ce qui va se passer</p>
            <p>
              Le {kindLabel} «{" "}
              <span className="font-semibold">{itemName}</span> » sera
              supprimé définitivement. Cette action ne peut pas être annulée.
            </p>
            {cascadeHint ? <p>{cascadeHint}</p> : null}
          </div>
        )}

        {displayError ? (
          <p className="text-sm text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" disabled={pending} onClick={close}>
            Annuler
          </Button>
          <div className="flex gap-2">
            {step !== "comment" && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setLocalError("");
                  if (step === "confirm") setStep("keyword");
                  else {
                    setStep("comment");
                    setKeyword("");
                  }
                }}
              >
                Retour
              </Button>
            )}
            {step === "comment" && (
              <Button
                type="button"
                disabled={pending || !motif.trim()}
                onClick={() => setStep("keyword")}
              >
                Suivant
              </Button>
            )}
            {step === "keyword" && (
              <Button
                type="button"
                disabled={pending || keyword.trim() !== DELETE_KEYWORD}
                onClick={() => setStep("confirm")}
              >
                Suivant
              </Button>
            )}
            {step === "confirm" && (
              <Button
                type="button"
                variant="destructive"
                disabled={
                  pending ||
                  !motif.trim() ||
                  keyword.trim() !== DELETE_KEYWORD
                }
                onClick={() => void submit()}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Supprimer définitivement
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
