"use client";

import {
  useMemo,
  useState,
  useTransition,
  type ComponentType,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  approveWorkflowRequestAction,
  rejectWorkflowRequestAction,
} from "@/app/(app)/workflow/actions";
import {
  WORKFLOW_OPERATION_LABELS,
  WORKFLOW_STATUS_LABELS,
  parseDecisionHistory,
  WORKFLOW_STATUS,
  formatJalonWorkflowLabel,
  resolveWorkflowOrigin,
  type JalonWorkflowCaps,
  type WorkflowOrigin,
} from "@/lib/workflow-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  X,
  Eye,
  Loader2,
  Zap,
  GitBranch,
  Milestone,
  Building2,
  User,
  Calendar,
  MessageSquareText,
  ArrowRight,
  FilePlus2,
  Trash2,
  Pencil,
  ShieldCheck,
  Clock3,
} from "lucide-react";

export type WorkflowRequestRow = {
  id: string;
  entityType: string;
  operation: string;
  status: string;
  entityId: string | null;
  entityLabel: string;
  chantierId: string | null;
  requesterId: string;
  requesterName: string;
  approverId: string | null;
  approverName: string;
  motif: string;
  rejectMotif: string;
  oldValues: unknown;
  newValues: unknown;
  decisionHistory?: unknown;
  /** DIRECT | VALIDATION | legacy empty */
  priority?: string | null;
  createdAt: Date | string;
  processedAt: Date | string | null;
  chantier: { id: string; code: string; nom: string } | null;
};

function OriginBadge({ origin }: { origin: WorkflowOrigin }) {
  if (origin === "direct") {
    return (
      <Badge
        variant="secondary"
        className="gap-1 text-[10px] border border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-medium"
      >
        <Zap className="size-3" />
        Directe
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="gap-1 text-[10px] border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium"
    >
      <GitBranch className="size-3" />
      Via validation
    </Badge>
  );
}

function statusColor(status: string) {
  if (status === "EN_ATTENTE") return "#f59e0b";
  if (status === "APPROUVEE") return "#22c55e";
  if (status === "REJETEE") return "#ef4444";
  return "#94a3b8";
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

const FIELD_LABELS: Record<string, string> = {
  phase: "Phase",
  nom: "Nom",
  description: "Description",
  ordre: "Ordre",
  date_cible: "Date cible",
  date_reelle: "Date réelle",
  statut: "Statut",
  livrables: "Livrables",
  commentaire: "Commentaire",
};

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function ValueTable({
  data,
  tone,
}: {
  data: Record<string, unknown>;
  tone: "neutral" | "danger" | "success";
}) {
  const keys = Object.keys(data).filter(
    (k) => k !== "id" && k !== "chantierId"
  );
  const border =
    tone === "danger"
      ? "border-destructive/25"
      : tone === "success"
        ? "border-emerald-500/25"
        : "border-border";
  const head =
    tone === "danger"
      ? "bg-destructive/8 text-destructive"
      : tone === "success"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "bg-muted/60 text-muted-foreground";

  return (
    <div className={`overflow-hidden rounded-xl border ${border}`}>
      <div className={`px-3 py-2 text-[11px] font-semibold uppercase tracking-wide ${head}`}>
        {tone === "danger"
          ? "Valeurs avant"
          : tone === "success"
            ? "Valeurs après / proposées"
            : "Valeurs"}
      </div>
      <dl className="divide-y divide-border/60">
        {keys.map((k) => (
          <div
            key={k}
            className="grid grid-cols-[7.5rem_1fr] gap-2 px-3 py-2 text-sm sm:grid-cols-[9rem_1fr]"
          >
            <dt className="text-xs font-medium text-muted-foreground pt-0.5">
              {fieldLabel(k)}
            </dt>
            <dd className="text-sm font-medium break-words">
              {formatFieldValue(data[k])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DiffView({
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

  if (operation === "delete") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <Trash2 className="size-4" />
          Suppression du jalon
        </div>
        {oldR ? (
          <ValueTable data={oldR} tone="danger" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun snapshot disponible.
          </p>
        )}
      </div>
    );
  }

  if (operation === "create") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <FilePlus2 className="size-4" />
          Création du jalon
        </div>
        {newR ? (
          <ValueTable data={newR} tone="success" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune valeur proposée.
          </p>
        )}
      </div>
    );
  }

  const keys = new Set([
    ...Object.keys(oldR ?? {}),
    ...Object.keys(newR ?? {}),
  ]);
  const diffs = [...keys].filter((k) => {
    if (k === "id" || k === "chantierId") return false;
    return String(oldR?.[k] ?? "") !== String(newR?.[k] ?? "");
  });

  if (diffs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Aucune différence détectée entre les valeurs.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Pencil className="size-4" />
        {diffs.length} champ{diffs.length > 1 ? "s" : ""} modifié
        {diffs.length > 1 ? "s" : ""}
      </div>
      <div className="overflow-hidden rounded-xl border">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Champ</span>
          <span className="sr-only">→</span>
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <span className="text-destructive/80">Avant</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              Après
            </span>
          </div>
        </div>
        <div className="divide-y">
          {diffs.map((k) => (
            <div
              key={k}
              className="grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-3"
            >
              <div className="text-xs font-semibold text-muted-foreground sm:pt-1">
                {fieldLabel(k)}
              </div>
              <ArrowRight className="hidden size-4 text-muted-foreground/50 sm:mt-1 sm:block" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-sm text-destructive line-through decoration-destructive/50">
                  {formatFieldValue(oldR?.[k])}
                </div>
                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  {formatFieldValue(newR?.[k])}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetaTile({
  icon: Icon,
  label,
  children,
  title,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: ReactNode;
  /** Full text for native tooltip when truncated */
  title?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card/80 p-3 shadow-sm">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 shrink-0 opacity-70" />
        {label}
      </div>
      <div
        className="line-clamp-2 break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]"
        title={title}
      >
        {children}
      </div>
    </div>
  );
}

function decisionCommentOf(r: WorkflowRequestRow): string {
  const history = parseDecisionHistory(r.decisionHistory);
  for (let i = history.length - 1; i >= 0; i--) {
    const ev = history[i];
    if (
      (ev.status === WORKFLOW_STATUS.APPROVED ||
        ev.status === WORKFLOW_STATUS.REJECTED) &&
      ev.note?.trim()
    ) {
      return ev.note.trim();
    }
  }
  return r.rejectMotif?.trim() || "";
}

function jalonDisplayLabel(r: WorkflowRequestRow): string {
  return formatJalonWorkflowLabel({
    entityLabel: r.entityLabel,
    oldValues: r.oldValues,
    newValues: r.newValues,
  });
}

export function WorkflowRequestsClient({
  initialRequests,
  caps,
  mode,
  isValidator = true,
}: {
  initialRequests: WorkflowRequestRow[];
  caps: JalonWorkflowCaps;
  mode: "validation" | "history";
  /** false = only own requests (server already filtered) */
  isValidator?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState(
    mode === "validation" ? "EN_ATTENTE" : "all"
  );
  const [opFilter, setOpFilter] = useState("all");
  /** all | validation | direct — primary separation on history */
  const [originFilter, setOriginFilter] = useState<"all" | WorkflowOrigin>(
    "all"
  );
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<WorkflowRequestRow | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    let validation = 0;
    let direct = 0;
    for (const r of initialRequests) {
      if (resolveWorkflowOrigin(r) === "direct") direct++;
      else validation++;
    }
    return {
      all: initialRequests.length,
      validation,
      direct,
    };
  }, [initialRequests]);

  const filtered = useMemo(() => {
    let list = [...initialRequests];
    if (originFilter !== "all") {
      list = list.filter((r) => resolveWorkflowOrigin(r) === originFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (opFilter !== "all") {
      list = list.filter((r) => r.operation === opFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          jalonDisplayLabel(r).toLowerCase().includes(q) ||
          r.entityLabel.toLowerCase().includes(q) ||
          r.requesterName.toLowerCase().includes(q) ||
          r.motif.toLowerCase().includes(q) ||
          (r.chantier?.code ?? "").toLowerCase().includes(q) ||
          (r.chantier?.nom ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [initialRequests, originFilter, statusFilter, opFilter, search]);

  function openApprove(r: WorkflowRequestRow) {
    setDetail(r);
    setApproveComment("");
    setError("");
    setApproveOpen(true);
  }

  function handleApprove() {
    if (!detail) return;
    setError("");
    if (!approveComment.trim()) {
      setError("Le commentaire de décision est obligatoire.");
      return;
    }
    startTransition(async () => {
      try {
        await approveWorkflowRequestAction(detail.id, approveComment.trim());
        setApproveOpen(false);
        setApproveComment("");
        setDetail(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function handleReject(id: string) {
    setError("");
    if (!rejectMotif.trim()) {
      setError("Le commentaire de décision est obligatoire.");
      return;
    }
    startTransition(async () => {
      try {
        await rejectWorkflowRequestAction(id, rejectMotif.trim());
        setRejectOpen(false);
        setRejectMotif("");
        setDetail(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "validation"
              ? "Centre de Validation"
              : "Historique des demandes"}
          </CardTitle>
          <CardDescription>
            {mode === "validation"
              ? isValidator
                ? "Traitez les demandes de création, modification et suppression de jalons. Un commentaire est obligatoire à chaque décision."
                : "Vos demandes de modification (vous ne pouvez pas traiter celles des autres)."
              : isValidator
                ? "Historique permanent — séparez les actions directes des demandes passées en validation."
                : "Historique de vos propres demandes uniquement."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isValidator && (
            <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs">
              Visibilité limitée : seules vos demandes sont affichées.
            </div>
          )}

          {/* History: tabs separate direct vs validation (most efficient UX) */}
          {mode === "history" && (
            <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
              {(
                [
                  {
                    key: "all" as const,
                    label: "Toutes",
                    count: counts.all,
                  },
                  {
                    key: "validation" as const,
                    label: "Via validation",
                    count: counts.validation,
                  },
                  {
                    key: "direct" as const,
                    label: "Actions directes",
                    count: counts.direct,
                  },
                ] as const
              ).map((tab) => {
                const active = originFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setOriginFilter(tab.key)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? tab.key === "direct"
                          ? "bg-sky-500/20 text-sky-800 dark:text-sky-200 shadow-sm"
                          : tab.key === "validation"
                            ? "bg-violet-500/15 text-violet-800 dark:text-violet-200 shadow-sm"
                            : "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                    }`}
                  >
                    {tab.key === "direct" && <Zap className="size-3.5" />}
                    {tab.key === "validation" && (
                      <GitBranch className="size-3.5" />
                    )}
                    {tab.label}
                    <span
                      className={`rounded-full px-1.5 py-0 text-[10px] tabular-nums ${
                        active ? "bg-background/80" : "bg-muted"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            {mode === "history" && (
              <Select
                value={originFilter}
                onValueChange={(v) =>
                  setOriginFilter(v as "all" | WorkflowOrigin)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Origine" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes origines</SelectItem>
                  <SelectItem value="validation">Via validation</SelectItem>
                  <SelectItem value="direct">Actions directes</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="EN_ATTENTE">En attente</SelectItem>
                <SelectItem value="APPROUVEE">Approuvée</SelectItem>
                <SelectItem value="REJETEE">Rejetée</SelectItem>
              </SelectContent>
            </Select>
            <Select value={opFilter} onValueChange={setOpFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Opération" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes opérations</SelectItem>
                <SelectItem value="create">Création</SelectItem>
                <SelectItem value="update">Modification</SelectItem>
                <SelectItem value="delete">Suppression</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Jalon</th>
                  <th className="px-3 py-2 text-left font-medium">Origine</th>
                  <th className="px-3 py-2 text-left font-medium">Chantier</th>
                  <th className="px-3 py-2 text-left font-medium">Demandeur</th>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Statut</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const origin = resolveWorkflowOrigin(r);
                  return (
                  <tr
                    key={r.id}
                    className={`border-b last:border-0 hover:bg-muted/30 ${
                      origin === "direct"
                        ? "bg-sky-500/[0.04]"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-xs">
                      {WORKFLOW_OPERATION_LABELS[
                        r.operation as keyof typeof WORKFLOW_OPERATION_LABELS
                      ] ?? r.operation}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {jalonDisplayLabel(r)}
                    </td>
                    <td className="px-3 py-2">
                      <OriginBadge origin={origin} />
                    </td>
                    <td
                      className="max-w-[9rem] px-3 py-2 text-xs text-muted-foreground"
                      title={
                        r.chantier
                          ? `${r.chantier.code} — ${r.chantier.nom}`
                          : undefined
                      }
                    >
                      <span className="block truncate">
                        {r.chantier ? r.chantier.code : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.requesterName}</td>
                    <td className="px-3 py-2 text-xs">
                      {format(new Date(r.createdAt), "dd MMM yyyy HH:mm", {
                        locale: fr,
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: statusColor(r.status) + "22",
                          color: statusColor(r.status),
                        }}
                      >
                        {origin === "direct" && r.status === "APPROUVEE"
                          ? "Auto-approuvée"
                          : (WORKFLOW_STATUS_LABELS[r.status] ?? r.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          title="Consulter"
                          onClick={() => {
                            setError("");
                            setDetail(r);
                          }}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        {r.status === "EN_ATTENTE" && caps.canApprove && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-green-600"
                            title="Approuver"
                            disabled={isPending}
                            onClick={() => openApprove(r)}
                          >
                            <Check className="size-3.5" />
                          </Button>
                        )}
                        {r.status === "EN_ATTENTE" && caps.canReject && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-destructive"
                            title="Rejeter"
                            disabled={isPending}
                            onClick={() => {
                              setDetail(r);
                              setRejectOpen(true);
                              setRejectMotif("");
                            }}
                          >
                            <X className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      Aucune demande
                      {originFilter === "direct"
                        ? " directe"
                        : originFilter === "validation"
                          ? " via validation"
                          : ""}
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!detail && !rejectOpen && !approveOpen}
        onOpenChange={(o) => !o && setDetail(null)}
      >
        <DialogContent className="flex max-h-[min(92vh,880px)] w-[min(100vw-1.5rem,52rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          {detail && (() => {
            const origin = resolveWorkflowOrigin(detail);
            const statusLabel =
              origin === "direct" && detail.status === "APPROUVEE"
                ? "Auto-approuvée"
                : (WORKFLOW_STATUS_LABELS[detail.status] ?? detail.status);
            const opLabel =
              WORKFLOW_OPERATION_LABELS[
                detail.operation as keyof typeof WORKFLOW_OPERATION_LABELS
              ] ?? detail.operation;
            const OpIcon =
              detail.operation === "create"
                ? FilePlus2
                : detail.operation === "delete"
                  ? Trash2
                  : Pencil;
            const history = parseDecisionHistory(detail.decisionHistory);
            const decisionNote = decisionCommentOf(detail);

            return (
              <>
                {/* Header band */}
                <div
                  className={`relative border-b px-6 pb-5 pt-6 ${
                    origin === "direct"
                      ? "bg-gradient-to-br from-sky-500/12 via-background to-background"
                      : "bg-gradient-to-br from-[#0A3C74]/10 via-background to-background"
                  }`}
                >
                  <div className="pr-8">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-xs font-medium shadow-sm">
                        <OpIcon className="size-3.5 text-primary" />
                        {opLabel}
                      </span>
                      <OriginBadge origin={origin} />
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-semibold"
                        style={{
                          backgroundColor: statusColor(detail.status) + "22",
                          color: statusColor(detail.status),
                        }}
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    <DialogHeader className="min-w-0 space-y-1 text-left">
                      <DialogTitle className="text-xl font-bold tracking-tight break-words [overflow-wrap:anywhere] sm:text-2xl">
                        {jalonDisplayLabel(detail)}
                      </DialogTitle>
                      <p
                        className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]"
                        title={
                          detail.chantier
                            ? `${detail.chantier.code} — ${detail.chantier.nom}`
                            : undefined
                        }
                      >
                        <span className="line-clamp-2">
                          {detail.chantier
                            ? `${detail.chantier.code} — ${detail.chantier.nom}`
                            : "Chantier non renseigné"}
                        </span>
                        <span className="mt-0.5 block text-muted-foreground/90">
                          Demandé le{" "}
                          {format(
                            new Date(detail.createdAt),
                            "dd MMMM yyyy à HH:mm",
                            { locale: fr }
                          )}
                        </span>
                      </p>
                    </DialogHeader>
                  </div>
                </div>

                {/* Body */}
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
                    <MetaTile
                      icon={Milestone}
                      label="Jalon"
                      title={jalonDisplayLabel(detail)}
                    >
                      {jalonDisplayLabel(detail)}
                    </MetaTile>
                    <MetaTile
                      icon={Building2}
                      label="Chantier"
                      title={
                        detail.chantier
                          ? `${detail.chantier.code} — ${detail.chantier.nom}`
                          : undefined
                      }
                    >
                      {detail.chantier
                        ? `${detail.chantier.code} — ${detail.chantier.nom}`
                        : "—"}
                    </MetaTile>
                    <MetaTile
                      icon={User}
                      label="Demandeur"
                      title={detail.requesterName || undefined}
                    >
                      {detail.requesterName || "—"}
                    </MetaTile>
                    <MetaTile icon={Calendar} label="Date de création">
                      {format(new Date(detail.createdAt), "dd MMM yyyy HH:mm", {
                        locale: fr,
                      })}
                    </MetaTile>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <MessageSquareText className="size-3.5" />
                        Motif demandeur
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {detail.motif?.trim() || (
                          <span className="text-muted-foreground italic">
                            Aucun motif
                          </span>
                        )}
                      </p>
                    </div>

                    <div
                      className={`rounded-xl border p-4 ${
                        detail.status === "REJETEE"
                          ? "border-destructive/25 bg-destructive/5"
                          : decisionNote
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "bg-muted/20"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <ShieldCheck className="size-3.5" />
                        {detail.status === "REJETEE"
                          ? "Commentaire de rejet"
                          : origin === "direct"
                            ? "Commentaire (action directe)"
                            : "Commentaire de décision"}
                      </div>
                      {decisionNote ? (
                        <>
                          <p
                            className={`text-sm leading-relaxed whitespace-pre-wrap ${
                              detail.status === "REJETEE"
                                ? "text-destructive"
                                : ""
                            }`}
                          >
                            {decisionNote}
                          </p>
                          {detail.approverName && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Par {detail.approverName}
                              {detail.processedAt
                                ? ` · ${format(
                                    new Date(detail.processedAt),
                                    "dd MMM yyyy HH:mm",
                                    { locale: fr }
                                  )}`
                                : ""}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          {detail.status === "EN_ATTENTE"
                            ? "En attente de décision du validateur."
                            : "Aucun commentaire de décision."}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold tracking-tight">
                        Comparatif des valeurs
                      </h3>
                      <span className="text-[11px] text-muted-foreground">
                        Avant / après
                      </span>
                    </div>
                    <DiffView
                      oldValues={detail.oldValues}
                      newValues={detail.newValues}
                      operation={detail.operation}
                    />
                  </div>

                  {history.length > 0 && (
                    <div className="rounded-xl border bg-card p-4 shadow-sm">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight">
                        <Clock3 className="size-4 text-muted-foreground" />
                        Historique des décisions
                      </h3>
                      <ol className="relative space-y-0 border-l-2 border-border ml-2">
                        {history.map((ev, i) => (
                          <li key={`${ev.at}-${i}`} className="relative pb-4 pl-5 last:pb-0">
                            <span
                              className="absolute -left-[7px] top-1 size-3 rounded-full border-2 border-background"
                              style={{
                                backgroundColor: statusColor(ev.status),
                              }}
                            />
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                                style={{
                                  backgroundColor:
                                    statusColor(ev.status) + "22",
                                  color: statusColor(ev.status),
                                }}
                              >
                                {WORKFLOW_STATUS_LABELS[ev.status] ??
                                  ev.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(ev.at), "dd MMM yyyy HH:mm", {
                                  locale: fr,
                                })}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-medium">
                              {ev.actorName}
                            </p>
                            {ev.note && (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {ev.note}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <DialogFooter className="gap-2 border-t bg-muted/20 px-6 py-4 sm:justify-between">
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    ID · {detail.id.slice(0, 8)}…
                  </p>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" onClick={() => setDetail(null)}>
                      Fermer
                    </Button>
                    {detail.status === "EN_ATTENTE" && caps.canReject && (
                      <Button
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          setRejectOpen(true);
                          setRejectMotif("");
                          setError("");
                        }}
                      >
                        <X className="size-4" />
                        Rejeter
                      </Button>
                    )}
                    {detail.status === "EN_ATTENTE" && caps.canApprove && (
                      <Button
                        className="bg-[#0A3C74] hover:bg-[#0A3C74]/90"
                        disabled={isPending}
                        onClick={() => openApprove(detail)}
                      >
                        <Check className="size-4" />
                        Approuver
                      </Button>
                    )}
                  </div>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog
        open={approveOpen}
        onOpenChange={(o) => {
          setApproveOpen(o);
          if (!o) setApproveComment("");
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approuver la demande</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Commentaire de décision{" "}
              <span className="text-destructive">*</span>
            </label>
            <Input
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="Justifiez votre approbation..."
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveOpen(false)}>
              Annuler
            </Button>
            <Button disabled={isPending} onClick={handleApprove}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmer l&apos;approbation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeter la demande</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Commentaire de décision{" "}
              <span className="text-destructive">*</span>
            </label>
            <Input
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              placeholder="Indiquez la raison du rejet..."
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => detail && handleReject(detail.id)}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
