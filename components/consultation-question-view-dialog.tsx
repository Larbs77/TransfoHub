"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  FolderKanban,
  MessageSquareText,
  Tags,
  UserRound,
  CheckCircle2,
  AlertCircle,
  History,
  Loader2,
  FilePlus2,
  Pencil,
  Trash2,
  Zap,
  GitBranch,
} from "lucide-react";
import {
  QA_CATEGORIE_COLORS,
  QA_PRIORITE_COLORS,
  QA_STATUT_COLORS,
  isQuestionEnRetard,
} from "@/lib/consultation-labels";
import {
  formatAffecteeADisplay,
  parseAffecteeA,
} from "@/lib/consultation-affectation";
import {
  WORKFLOW_OPERATION_LABELS,
  WORKFLOW_STATUS_LABELS,
  resolveWorkflowOrigin,
  parseDecisionHistory,
} from "@/lib/workflow-shared";
import { getConsultationQuestionHistory } from "@/app/(app)/actions";

const BOA_NAVY = "#0A3C74";
const BOA_TEAL = "#00BDBB";

const FIELD_LABELS: Record<string, string> = {
  chantierId: "Chantier",
  dossier_ref: "Réf. dossier",
  question: "Question",
  categorie: "Catégorie",
  priorite: "Priorité",
  statut: "Statut",
  remontee_par: "Remontée par",
  affectee_a: "Affectée à",
  echeance: "Échéance initiale",
  echeance_actualisee: "Échéance actualisée",
  date_fin_reelle: "Date de fin réelle",
  resolution: "Réponse",
};

export type ConsultationQuestionViewData = {
  id: string;
  chantierId: string;
  dossier_ref: string;
  question: string;
  categorie: string;
  priorite: string;
  statut: string;
  remontee_par: string;
  affectee_a: string;
  echeance: Date | null;
  echeance_actualisee?: Date | null;
  date_fin_reelle?: Date | null;
  resolution: string;
  createdAt?: Date;
  updatedAt?: Date;
  chantier?: { id: string; code: string; nom: string };
};

type HistoryRow = Awaited<
  ReturnType<typeof getConsultationQuestionHistory>
>[number];

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-border/60 pb-2">
        <span
          className="flex size-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${BOA_NAVY}12` }}
        >
          <Icon className="size-3.5" style={{ color: BOA_TEAL }} />
        </span>
        <h3 className="text-sm font-semibold" style={{ color: BOA_NAVY }}>
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function ColoredBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <Badge
      variant="secondary"
      className="font-medium"
      style={{
        backgroundColor: (color || "#94a3b8") + "20",
        color: color || "#94a3b8",
      }}
    >
      {label}
    </Badge>
  );
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function displayFieldValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (key === "affectee_a") return formatAffecteeADisplay(String(value));
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

function FieldDiffs({
  oldValues,
  newValues,
  operation,
}: {
  oldValues: unknown;
  newValues: unknown;
  operation: string;
}) {
  const oldR = asRecord(oldValues);
  const newR = asRecord(newValues);

  if (operation === "create" && newR) {
    const keys = Object.keys(newR).filter(
      (k) => k !== "chantierId" && newR[k] != null && newR[k] !== ""
    );
    if (keys.length === 0) {
      return (
        <p className="text-xs text-muted-foreground">Création enregistrée.</p>
      );
    }
    return (
      <ul className="space-y-1.5 text-xs">
        {keys.map((k) => (
          <li key={k} className="rounded-md border bg-emerald-500/5 px-2.5 py-1.5">
            <span className="font-semibold text-muted-foreground">
              {FIELD_LABELS[k] ?? k}
            </span>
            <span className="mx-1 text-muted-foreground">:</span>
            <span className="break-words">{displayFieldValue(k, newR[k])}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (operation === "delete" && oldR) {
    return (
      <p className="text-xs text-destructive">
        Question supprimée
        {oldR.dossier_ref ? ` (${String(oldR.dossier_ref)})` : ""}.
      </p>
    );
  }

  if (operation === "update" && (oldR || newR)) {
    const keys = [
      ...new Set([
        ...Object.keys(oldR ?? {}),
        ...Object.keys(newR ?? {}),
      ]),
    ].filter((k) => k !== "chantierId");

    const changes = keys.filter((k) => {
      const a = displayFieldValue(k, oldR?.[k]);
      const b = displayFieldValue(k, newR?.[k]);
      return a !== b;
    });

    if (changes.length === 0) {
      return (
        <p className="text-xs text-muted-foreground">
          Aucun écart de champ détecté.
        </p>
      );
    }

    return (
      <ul className="space-y-2 text-xs">
        {changes.map((k) => (
          <li
            key={k}
            className="rounded-md border bg-muted/30 px-2.5 py-2"
          >
            <p className="mb-1 font-semibold text-[#0A3C74]">
              {FIELD_LABELS[k] ?? k}
            </p>
            <div className="grid gap-1 sm:grid-cols-2">
              <p className="rounded border border-destructive/20 bg-destructive/5 px-2 py-1 text-muted-foreground line-through decoration-destructive/40">
                {displayFieldValue(k, oldR?.[k])}
              </p>
              <p className="rounded border border-emerald-500/25 bg-emerald-500/5 px-2 py-1 font-medium">
                {displayFieldValue(k, newR?.[k])}
              </p>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">Détail non disponible.</p>
  );
}

function OpIcon({ operation }: { operation: string }) {
  if (operation === "create")
    return <FilePlus2 className="size-3.5 text-emerald-600" />;
  if (operation === "delete")
    return <Trash2 className="size-3.5 text-destructive" />;
  return <Pencil className="size-3.5 text-sky-600" />;
}

export function ConsultationQuestionViewDialog({
  open,
  onOpenChange,
  question,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: ConsultationQuestionViewData | null;
}) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (!open || !question?.id) {
      setHistory([]);
      setHistoryError("");
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError("");
    getConsultationQuestionHistory(question.id)
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setHistory([]);
          setHistoryError(
            e instanceof Error ? e.message : "Historique indisponible."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, question?.id]);

  if (!question) return null;

  const overdue = isQuestionEnRetard(
    question.echeance_actualisee ?? question.echeance,
    question.statut,
    new Date(),
    question.echeance
  );
  const affectation = parseAffecteeA(question.affectee_a);
  const chantierLabel = question.chantier
    ? `${question.chantier.code} — ${question.chantier.nom}`
    : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(94vh,900px)] w-[min(100vw-1rem,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <div className="border-b bg-gradient-to-br from-[#0A3C74]/10 via-background to-background px-6 pb-5 pt-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 pr-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium shadow-sm">
              <Eye className="size-3.5" style={{ color: BOA_TEAL }} />
              <span style={{ color: BOA_NAVY }}>Consultation</span>
            </span>
            <ColoredBadge
              label={question.statut}
              color={QA_STATUT_COLORS[question.statut] ?? "#94a3b8"}
            />
            <ColoredBadge
              label={question.priorite}
              color={QA_PRIORITE_COLORS[question.priorite] ?? "#94a3b8"}
            />
            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/35 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-700 dark:text-red-300">
                <AlertCircle className="size-3" />
                En retard
              </span>
            )}
            {question.dossier_ref && (
              <span className="rounded-full border bg-muted/50 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
                {question.dossier_ref}
              </span>
            )}
          </div>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle
              className="flex items-start gap-2 text-xl font-bold tracking-tight sm:text-2xl"
              style={{ color: BOA_NAVY }}
            >
              <HelpCircleIcon />
              <span className="min-w-0 break-words">Détail de la question</span>
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Lecture seule — historique des changements inclus.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <Section icon={FolderKanban} title="Rattachement">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Chantier">
                <p className="font-medium leading-snug" title={chantierLabel}>
                  {question.chantier ? (
                    <>
                      <span className="mr-1.5 inline-block rounded border border-[#0A3C74]/15 bg-[#0A3C74]/[0.06] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#0A3C74]">
                        {question.chantier.code}
                      </span>
                      <span className="text-muted-foreground">
                        {question.chantier.nom}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </Field>
              <Field label="Réf. dossier">
                <p className="font-mono text-sm">
                  {question.dossier_ref?.trim() || "—"}
                </p>
              </Field>
            </div>
          </Section>

          <Section icon={MessageSquareText} title="Question">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {question.question}
            </p>
          </Section>

          <Section icon={Tags} title="Classement">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Catégorie">
                <ColoredBadge
                  label={question.categorie}
                  color={QA_CATEGORIE_COLORS[question.categorie] ?? "#94a3b8"}
                />
              </Field>
              <Field label="Priorité">
                <ColoredBadge
                  label={question.priorite}
                  color={QA_PRIORITE_COLORS[question.priorite] ?? "#94a3b8"}
                />
              </Field>
              <Field label="Statut">
                <ColoredBadge
                  label={question.statut}
                  color={QA_STATUT_COLORS[question.statut] ?? "#94a3b8"}
                />
              </Field>
            </div>
          </Section>

          <Section icon={UserRound} title="Affectation & suivi">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Affectée à">
                <p className="font-medium">
                  {formatAffecteeADisplay(question.affectee_a)}
                </p>
                {affectation.kind === "org" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Équipe org. : {affectation.teamLabel} · Porteur :{" "}
                    {affectation.personLabel}
                  </p>
                )}
              </Field>
              <Field label="Remontée par">
                <p>{question.remontee_par?.trim() || "—"}</p>
              </Field>
              <Field label="Échéance initiale">
                <p>
                  {question.echeance
                    ? format(new Date(question.echeance), "dd MMMM yyyy", {
                        locale: fr,
                      })
                    : "—"}
                </p>
              </Field>
              <Field label="Échéance actualisée">
                <p
                  className={
                    overdue
                      ? "font-semibold text-red-700 dark:text-red-400"
                      : undefined
                  }
                >
                  {(question.echeance_actualisee ?? question.echeance)
                    ? format(
                        new Date(
                          (question.echeance_actualisee ??
                            question.echeance) as Date
                        ),
                        "dd MMMM yyyy",
                        { locale: fr }
                      )
                    : "—"}
                  {overdue ? " · En retard" : ""}
                </p>
              </Field>
              <Field label="Date de fin réelle">
                <p>
                  {question.date_fin_reelle
                    ? format(new Date(question.date_fin_reelle), "dd MMMM yyyy", {
                        locale: fr,
                      })
                    : "—"}
                </p>
              </Field>
              <Field label="Dates système">
                <p className="text-xs text-muted-foreground">
                  {question.createdAt
                    ? `Créée le ${format(new Date(question.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}`
                    : "—"}
                  {question.updatedAt
                    ? ` · MAJ ${format(new Date(question.updatedAt), "dd/MM/yyyy HH:mm", { locale: fr })}`
                    : ""}
                </p>
              </Field>
            </div>
          </Section>

          {(question.statut === "Résolue" ||
            question.statut === "Abandonnée" ||
            question.resolution?.trim()) && (
            <Section icon={CheckCircle2} title="Réponse">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {question.resolution?.trim() || "—"}
              </p>
            </Section>
          )}

          <Section icon={History} title="Historique des changements">
            {loadingHistory ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Chargement de l&apos;historique…
              </div>
            ) : historyError ? (
              <p className="text-sm text-destructive">{historyError}</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun événement enregistré pour cette question. Les créations /
                modifications / suppressions futures (directes ou via workflow)
                apparaîtront ici.
              </p>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-[#0A3C74]/15 pl-4">
                {history.map((ev) => {
                  const origin = resolveWorkflowOrigin(ev);
                  const opLabel =
                    WORKFLOW_OPERATION_LABELS[
                      ev.operation as keyof typeof WORKFLOW_OPERATION_LABELS
                    ] ?? ev.operation;
                  const statusLabel =
                    WORKFLOW_STATUS_LABELS[ev.status] ?? ev.status;
                  const decisions = parseDecisionHistory(ev.decisionHistory);
                  return (
                    <li key={ev.id} className="relative">
                      <span className="absolute -left-[1.35rem] top-1 flex size-5 items-center justify-center rounded-full border bg-background shadow-sm">
                        <OpIcon operation={ev.operation} />
                      </span>
                      <div className="rounded-xl border bg-background/80 p-3 shadow-sm">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#0A3C74]">
                            {opLabel}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              ev.status === "EN_ATTENTE"
                                ? "border-amber-500/40 text-amber-700"
                                : ev.status === "REJETEE"
                                  ? "border-destructive/40 text-destructive"
                                  : "border-emerald-500/40 text-emerald-700"
                            }`}
                          >
                            {statusLabel}
                          </Badge>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              origin === "direct"
                                ? "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200"
                                : "border-violet-500/30 bg-violet-500/10 text-violet-800 dark:text-violet-200"
                            }`}
                          >
                            {origin === "direct" ? (
                              <Zap className="size-3" />
                            ) : (
                              <GitBranch className="size-3" />
                            )}
                            {origin === "direct"
                              ? "Direct"
                              : "Via validation"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(ev.createdAt), "dd MMM yyyy HH:mm", {
                              locale: fr,
                            })}
                          </span>
                        </div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Par <strong>{ev.requesterName || "—"}</strong>
                          {ev.approverName &&
                          ev.approverName !== ev.requesterName
                            ? ` · Décision : ${ev.approverName}`
                            : ""}
                          {ev.motif ? ` · ${ev.motif}` : ""}
                        </p>
                        {ev.rejectMotif?.trim() && (
                          <p className="mb-2 text-xs text-destructive">
                            Motif rejet : {ev.rejectMotif}
                          </p>
                        )}
                        <FieldDiffs
                          oldValues={ev.oldValues}
                          newValues={ev.newValues}
                          operation={ev.operation}
                        />
                        {decisions.length > 1 && (
                          <div className="mt-2 border-t pt-2">
                            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                              Décisions
                            </p>
                            <ul className="space-y-1 text-[11px] text-muted-foreground">
                              {decisions.map((d, i) => (
                                <li key={`${ev.id}-d-${i}`}>
                                  {format(new Date(d.at), "dd/MM/yyyy HH:mm", {
                                    locale: fr,
                                  })}{" "}
                                  — {WORKFLOW_STATUS_LABELS[d.status] ?? d.status}{" "}
                                  ({d.actorName}
                                  {d.note ? ` · ${d.note}` : ""})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HelpCircleIcon() {
  return (
    <span
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${BOA_NAVY}12` }}
    >
      <Eye className="size-4" style={{ color: BOA_TEAL }} />
    </span>
  );
}
