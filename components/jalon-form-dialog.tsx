"use client";

import { useState, useEffect } from "react";
import { createJalon, updateJalon } from "@/app/(app)/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Milestone,
  Pencil,
  FilePlus2,
  ShieldAlert,
  Info,
  CalendarRange,
  ClipboardList,
  MessageSquareText,
} from "lucide-react";
import { PHASES, STATUT_JALON_LIST } from "@/lib/jalon-labels";
import type { WorkflowMode } from "@/lib/workflow-shared";

interface JalonData {
  id: string;
  chantierId: string;
  phase: string;
  nom: string;
  description: string;
  ordre: number;
  date_cible: Date;
  date_reelle: Date | null;
  statut: string;
  livrables: string;
  commentaire: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jalon?: JalonData | null;
  chantierId: string;
  defaultPhase?: string;
  /** DIRECT | VALIDATION | INTERDIT for create or update */
  workflowMode?: WorkflowMode;
  onResult?: (result: { mode: "direct" | "validation" }) => void;
}

function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toISOString().slice(0, 10);
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
      {required && <span className="ml-0.5 text-destructive">*</span>}
    </label>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-3.5" />
        </span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function JalonFormDialog({
  open,
  onOpenChange,
  jalon,
  chantierId,
  defaultPhase,
  workflowMode = "DIRECT",
  onResult,
}: Props) {
  const isEdit = !!jalon;
  /** Create still uses full validation mode when role is VALIDATION */
  const createNeedsValidation = !isEdit && workflowMode === "VALIDATION";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [motif, setMotif] = useState("");

  const [phase, setPhase] = useState(jalon?.phase ?? defaultPhase ?? "Exécution");
  const [nom, setNom] = useState(jalon?.nom ?? "");
  const [description, setDescription] = useState(jalon?.description ?? "");
  const [ordre, setOrdre] = useState(jalon?.ordre ?? 0);
  const [dateCible, setDateCible] = useState(toDateInput(jalon?.date_cible));
  const [dateReelle, setDateReelle] = useState(toDateInput(jalon?.date_reelle));
  const [statut, setStatut] = useState(jalon?.statut ?? "Planifié");
  const [livrables, setLivrables] = useState(jalon?.livrables ?? "");
  const [commentaire, setCommentaire] = useState(jalon?.commentaire ?? "");

  const originalDateCible = isEdit ? toDateInput(jalon?.date_cible) : "";
  /** Only a change of date_cible triggers validation on edit */
  const dateCibleChanged = isEdit && dateCible !== originalDateCible;
  const validationTriggered =
    createNeedsValidation ||
    (isEdit && workflowMode === "VALIDATION" && dateCibleChanged);
  const needsMotif =
    validationTriggered || (isEdit && workflowMode === "DIRECT");
  const motifIsRequest = validationTriggered;

  useEffect(() => {
    if (open) {
      setPhase(jalon?.phase ?? defaultPhase ?? "Exécution");
      setNom(jalon?.nom ?? "");
      setDescription(jalon?.description ?? "");
      setOrdre(jalon?.ordre ?? 0);
      setDateCible(toDateInput(jalon?.date_cible));
      setDateReelle(toDateInput(jalon?.date_reelle));
      setStatut(jalon?.statut ?? "Planifié");
      setLivrables(jalon?.livrables ?? "");
      setCommentaire(jalon?.commentaire ?? "");
      setMotif("");
      setError("");
    }
  }, [open, jalon, defaultPhase]);

  function handleStatutChange(newStatut: string) {
    setStatut(newStatut);
    if (newStatut === "Atteint" && !dateReelle) {
      setDateReelle(new Date().toISOString().slice(0, 10));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (needsMotif && !motif.trim()) {
      setError(
        motifIsRequest
          ? dateCibleChanged
            ? "Le motif est obligatoire pour demander un changement de date cible."
            : "Le motif de la demande est obligatoire."
          : "Le commentaire est obligatoire pour modifier un jalon."
      );
      return;
    }
    setLoading(true);
    const data = {
      chantierId,
      // Phase immutable on edit (keep original even if state were tampered)
      phase: isEdit && jalon ? jalon.phase : phase,
      nom,
      description,
      ordre,
      date_cible: dateCible,
      date_reelle: dateReelle || null,
      statut,
      livrables,
      commentaire,
    };
    try {
      const opts = needsMotif ? { motif: motif.trim() } : undefined;
      const result = isEdit
        ? await updateJalon(jalon.id, data, opts)
        : await createJalon(data, opts);
      onResult?.({ mode: result.mode });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const title = isEdit
    ? dateCibleChanged && workflowMode === "VALIDATION"
      ? "Demande de modification de date"
      : "Modifier le jalon"
    : createNeedsValidation
      ? "Demande de création de jalon"
      : "Nouveau jalon";

  const subtitle = isEdit
    ? dateCibleChanged && workflowMode === "VALIDATION"
      ? "Seul le changement de date cible est soumis à validation. Les autres champs sont enregistrés immédiatement."
      : workflowMode === "DIRECT"
        ? "Modification directe — un commentaire de traçabilité est requis."
        : workflowMode === "VALIDATION"
          ? "Vous pouvez modifier les informations librement. Seule la date cible nécessite une validation."
          : "Mettez à jour les informations du jalon."
    : createNeedsValidation
      ? "La création sera soumise à validation."
      : "Renseignez les informations du nouveau jalon.";

  const HeaderIcon = isEdit
    ? dateCibleChanged && workflowMode === "VALIDATION"
      ? ShieldAlert
      : Pencil
    : FilePlus2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,840px)] w-[min(100vw-1.5rem,44rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        {/* Header */}
        <div
          className={`border-b px-6 pb-5 pt-6 ${
            motifIsRequest
              ? "bg-gradient-to-br from-amber-500/12 via-background to-background"
              : isEdit && workflowMode === "DIRECT"
                ? "bg-gradient-to-br from-sky-500/12 via-background to-background"
                : "bg-gradient-to-br from-[#0A3C74]/10 via-background to-background"
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium shadow-sm">
              <HeaderIcon className="size-3.5 text-primary" />
              {isEdit ? "Modification" : "Création"}
            </span>
            {motifIsRequest && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                {dateCibleChanged
                  ? "Validation date cible"
                  : "Soumis à validation"}
              </span>
            )}
            {isEdit && workflowMode === "VALIDATION" && !dateCibleChanged && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                Autres champs libres
              </span>
            )}
            {isEdit && workflowMode === "DIRECT" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/35 bg-sky-500/15 px-2.5 py-1 text-[10px] font-semibold text-sky-800 dark:text-sky-200">
                Application immédiate
              </span>
            )}
            {isEdit && jalon && (
              <span
                className="max-w-full truncate rounded-full border bg-muted/50 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
                title={`${jalon.phase} \\ ${jalon.nom}`}
              >
                {jalon.phase} \ {jalon.nom}
              </span>
            )}
          </div>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-start gap-2 text-xl font-bold tracking-tight sm:text-2xl">
              <Milestone className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="min-w-0 break-words">{title}</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {subtitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {isEdit && workflowMode === "VALIDATION" && !dateCibleChanged && (
              <div className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3.5 py-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <p className="leading-relaxed text-foreground/90">
                  Les champs hors <strong>date cible</strong> sont enregistrés
                  sans validation. Modifier la date cible déclenchera une
                  demande de validation.
                </p>
              </div>
            )}
            {isEdit && workflowMode === "VALIDATION" && dateCibleChanged && (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-3 text-sm text-amber-950 dark:text-amber-50">
                <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="leading-relaxed">
                  Vous avez modifié la <strong>date cible</strong> (
                  {originalDateCible || "—"} → {dateCible || "—"}). Une{" "}
                  <strong>demande de validation</strong> sera créée pour cette
                  date. Les autres champs seront enregistrés tout de suite.
                </p>
              </div>
            )}
            {createNeedsValidation && (
              <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-3.5 py-3 text-sm text-amber-950 dark:text-amber-50">
                <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="leading-relaxed">
                  La création de jalon est soumise à validation pour votre rôle.
                </p>
              </div>
            )}
            {isEdit && workflowMode === "DIRECT" && (
              <div className="flex gap-3 rounded-xl border border-sky-500/30 bg-sky-500/8 px-3.5 py-3 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
                <p className="leading-relaxed text-foreground/90">
                  La modification sera appliquée immédiatement. Le commentaire
                  est enregistré pour l&apos;audit.
                </p>
              </div>
            )}

            <Section icon={ClipboardList} title="Identité du jalon">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <FieldLabel required>Phase</FieldLabel>
                  {isEdit ? (
                    <Input
                      value={phase}
                      readOnly
                      disabled
                      className="cursor-not-allowed bg-muted/50 text-muted-foreground"
                      title="La phase d'un jalon ne peut pas être modifiée"
                    />
                  ) : (
                    <Select value={phase} onValueChange={setPhase}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHASES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <FieldLabel required>Nom du jalon</FieldLabel>
                  <Input
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Go/No-Go, UAT, Go-Live..."
                    required
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <FieldLabel>Description</FieldLabel>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description du jalon"
                />
              </div>
            </Section>

            <Section icon={CalendarRange} title="Planning & statut">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <FieldLabel required>Date cible</FieldLabel>
                  <Input
                    type="date"
                    value={dateCible}
                    onChange={(e) => setDateCible(e.target.value)}
                    required
                    className={
                      dateCibleChanged && workflowMode === "VALIDATION"
                        ? "border-amber-500/50 ring-1 ring-amber-500/30"
                        : undefined
                    }
                  />
                  {isEdit && workflowMode === "VALIDATION" && (
                    <p className="text-[11px] text-muted-foreground">
                      {dateCibleChanged
                        ? "Changement de date → validation requise"
                        : "Modifier cette date soumettra une demande de validation"}
                    </p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel>Date réelle</FieldLabel>
                  <Input
                    type="date"
                    value={dateReelle}
                    onChange={(e) => setDateReelle(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel required>Statut</FieldLabel>
                  <Select value={statut} onValueChange={handleStatutChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUT_JALON_LIST.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel>Ordre</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    value={ordre}
                    onChange={(e) => setOrdre(Number(e.target.value))}
                  />
                </div>
              </div>
            </Section>

            <Section icon={Milestone} title="Compléments">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <FieldLabel>Livrables</FieldLabel>
                  <Input
                    value={livrables}
                    onChange={(e) => setLivrables(e.target.value)}
                    placeholder="Documents, livrables attendus..."
                  />
                </div>
                <div className="grid gap-1.5">
                  <FieldLabel>Commentaire (jalon)</FieldLabel>
                  <Input
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    placeholder="Notes additionnelles..."
                  />
                </div>
              </div>
            </Section>

            {needsMotif && (
              <Section
                icon={MessageSquareText}
                title={
                  motifIsRequest
                    ? dateCibleChanged
                      ? "Justification du changement de date"
                      : "Justification de la demande"
                    : "Commentaire de traçabilité"
                }
              >
                <div className="grid gap-1.5">
                  <FieldLabel required>
                    {motifIsRequest ? "Motif de la demande" : "Commentaire"}
                  </FieldLabel>
                  <textarea
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    required
                    rows={3}
                    placeholder={
                      motifIsRequest
                        ? dateCibleChanged
                          ? "Expliquez pourquoi la date cible doit être modifiée..."
                          : "Expliquez pourquoi cette demande est nécessaire..."
                        : "Expliquez la modification apportée..."
                    }
                    className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-[88px] w-full rounded-lg border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {motifIsRequest
                      ? "Visible par les validateurs et dans l'historique workflow."
                      : "Enregistré dans l'historique pour l'audit."}
                  </p>
                </div>
              </Section>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-between">
            <p className="hidden max-w-sm text-xs text-muted-foreground sm:block">
              {isEdit && dateCibleChanged && workflowMode === "VALIDATION"
                ? "Autres champs enregistrés tout de suite · date cible en attente de validation."
                : motifIsRequest
                  ? "La demande sera traitée par un validateur."
                  : "Vérifiez les informations avant d'enregistrer."}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className={
                  motifIsRequest
                    ? "bg-amber-600 hover:bg-amber-600/90"
                    : "bg-[#0A3C74] hover:bg-[#0A3C74]/90"
                }
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {motifIsRequest
                  ? dateCibleChanged
                    ? "Enregistrer + demander validation date"
                    : "Soumettre la demande"
                  : isEdit
                    ? "Enregistrer"
                    : "Créer"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
