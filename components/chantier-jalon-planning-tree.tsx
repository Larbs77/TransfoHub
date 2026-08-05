"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  GitBranch,
  ListTree,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createWorkstream,
  updateWorkstream,
  deleteWorkstream,
  createActivite,
  updateActivite,
  deleteActivite,
} from "@/app/(app)/actions";
import {
  collectJalonCoherenceIssues,
  PLANNING_DETAIL_GOUVERNANCE,
  type PlanningDetailGouvernance,
} from "@/lib/planning-coherence";
import type { JalonWorkflowCaps, WorkflowMode } from "@/lib/workflow-shared";
import {
  STATUT_JALON_LIST,
  STATUT_JALON_COLORS,
  planningRetardDays,
  planningClotureEcartDays,
  toYmdLocal,
} from "@/lib/jalon-labels";
import { allChildrenAtteint } from "@/lib/planning-status-rules";

export interface ActiviteData {
  id: string;
  nom: string;
  ordre: number;
  description: string;
  date_debut: Date | string | null;
  date_fin: Date | string | null;
  date_reelle?: Date | string | null;
  statut: string;
  commentaire: string;
}

export interface WorkstreamData {
  id: string;
  nom: string;
  ordre: number;
  description: string;
  date_debut: Date | string | null;
  date_fin: Date | string | null;
  date_reelle?: Date | string | null;
  statut: string;
  commentaire: string;
  activites: ActiviteData[];
}

export interface JalonForTree {
  id: string;
  nom: string;
  date_cible: Date | string;
  statut?: string;
  workstreams?: WorkstreamData[];
}

interface PendingInfo {
  id: string;
  operation: string;
  motif: string;
  requesterName: string;
}

type Props = {
  jalon: JalonForTree;
  workflowCaps: JalonWorkflowCaps;
  detailGouvernance: PlanningDetailGouvernance;
  pendingByEntityId: Record<string, PendingInfo>;
  onToast: (msg: string) => void;
  /** Ouverture workstreams (true par défaut si clé absente). */
  workstreamOpen?: Record<string, boolean>;
  onToggleWorkstream?: (workstreamId: string) => void;
  onEnsureWorkstreamOpen?: (workstreamId: string) => void;
};

type DetailPayload = {
  nom: string;
  ordre: number;
  date_debut?: string | null;
  date_fin?: string | null;
  date_reelle?: string | null;
  statut?: string;
};

function toInputDate(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fmtDate(v: Date | string | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy", { locale: fr });
}

function RetardBadge({ days, tone }: { days: number; tone: "ws" | "act" }) {
  const cls =
    tone === "ws"
      ? "border-red-400/60 bg-red-400/10 text-red-700 dark:text-red-300"
      : "border-red-300/70 bg-red-300/15 text-red-600 dark:text-red-300";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${cls}`}
      title={`En retard de ${days} jour(s)`}
    >
      +{days}j
    </span>
  );
}

/** Écart de clôture (date réelle − fin planifiée) : + après, − avant. */
function ClotureEcartBadge({ days }: { days: number }) {
  if (days === 0) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
        title="Finalisé à la date planifiée"
      >
        0j
      </span>
    );
  }
  if (days > 0) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-slate-400/40 bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-700 dark:text-slate-300"
        title={`Finalisé ${days} j après la fin planifiée`}
      >
        +{days}j
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300"
      title={`Finalisé ${Math.abs(days)} j avant la fin planifiée`}
    >
      {days}j
    </span>
  );
}

function resolveDetailCaps(
  gouv: PlanningDetailGouvernance,
  caps: JalonWorkflowCaps
): Pick<JalonWorkflowCaps, "create" | "update" | "delete"> {
  if (gouv === PLANNING_DETAIL_GOUVERNANCE.LIBRE) {
    return { create: "DIRECT", update: "DIRECT", delete: "DIRECT" };
  }
  return { create: caps.create, update: caps.update, delete: caps.delete };
}

export function ChantierJalonPlanningTree({
  jalon,
  workflowCaps,
  detailGouvernance,
  pendingByEntityId,
  onToast,
  workstreamOpen,
  onToggleWorkstream,
  onEnsureWorkstreamOpen,
}: Props) {
  const router = useRouter();
  const caps = resolveDetailCaps(detailGouvernance, workflowCaps);
  const workstreams = jalon.workstreams ?? [];
  const [addingWs, setAddingWs] = useState(false);
  /** État local si le parent ne pilote pas l’ouverture (rétrocompat). */
  const [localWsOpen, setLocalWsOpen] = useState<Record<string, boolean>>({});

  /** Défaut : workstreams repliés (aligné onglet Jalons). */
  function isWsOpen(id: string) {
    if (workstreamOpen) return workstreamOpen[id] ?? false;
    return localWsOpen[id] ?? false;
  }
  function toggleWs(id: string) {
    if (onToggleWorkstream) {
      onToggleWorkstream(id);
      return;
    }
    setLocalWsOpen((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? false),
    }));
  }
  function ensureWsOpen(id: string) {
    if (onEnsureWorkstreamOpen) {
      onEnsureWorkstreamOpen(id);
      return;
    }
    setLocalWsOpen((prev) => ({ ...prev, [id]: true }));
  }

  const issues = useMemo(
    () =>
      collectJalonCoherenceIssues({
        id: jalon.id,
        nom: jalon.nom,
        date_cible: jalon.date_cible,
        statut: jalon.statut,
        workstreams,
      }),
    [jalon, workstreams]
  );
  const issueById = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const i of issues) {
      const list = m.get(i.entityId) ?? [];
      list.push(i.message);
      m.set(i.entityId, list);
    }
    return m;
  }, [issues]);

  const canCreate = caps.create !== "INTERDIT";
  const canUpdate = caps.update !== "INTERDIT";
  const canDelete = caps.delete !== "INTERDIT";

  return (
    <div className="ml-2 space-y-2 border-l-2 border-[#00BDBB]/35 pl-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="size-3.5" />
          <span>
            {workstreams.length} workstream(s) ·{" "}
            {workstreams.reduce((n, w) => n + (w.activites?.length ?? 0), 0)}{" "}
            activité(s)
          </span>
          {issues.length > 0 && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/50 text-amber-700 dark:text-amber-300"
            >
              <AlertTriangle className="size-3" />
              {issues.length} alerte(s) dates
            </Badge>
          )}
          {detailGouvernance === PLANNING_DETAIL_GOUVERNANCE.ALIGNEE_JALON && (
            <Badge variant="secondary" className="text-[10px]">
              Gouvernance workflow
            </Badge>
          )}
        </div>
        {canCreate && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setAddingWs(true)}
          >
            <Plus className="size-3.5" />
            {caps.create === "VALIDATION" ? "Demander WS" : "Workstream"}
          </Button>
        )}
      </div>

      {issues.length > 0 && (
        <ul className="space-y-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100">
          {issues.slice(0, 5).map((i, idx) => (
            <li key={idx}>• {i.message}</li>
          ))}
          {issues.length > 5 && <li>… et {issues.length - 5} autre(s)</li>}
        </ul>
      )}

      {workstreams.length === 0 && !addingWs && (
        <p className="text-xs text-muted-foreground">
          Aucun workstream sous ce jalon.
        </p>
      )}

      <div className="space-y-2">
        {[...workstreams]
          .sort((a, b) => a.ordre - b.ordre)
          .map((ws) => (
            <WorkstreamCard
              key={ws.id}
              ws={ws}
              open={isWsOpen(ws.id)}
              onToggleOpen={() => toggleWs(ws.id)}
              onEnsureOpen={() => ensureWsOpen(ws.id)}
              caps={caps}
              canUpdate={canUpdate}
              canDelete={canDelete}
              canCreate={canCreate}
              pending={pendingByEntityId[ws.id]}
              pendingByEntityId={pendingByEntityId}
              issueById={issueById}
              onToast={onToast}
              onRefresh={() => router.refresh()}
            />
          ))}
        {addingWs && (
          <DetailForm
            label="workstream"
            createMode={caps.create}
            nextOrdre={
              workstreams.length
                ? Math.max(...workstreams.map((w) => w.ordre)) + 1
                : 1
            }
            onCancel={() => setAddingWs(false)}
            onSubmit={async (payload, motif) => {
              const res = await createWorkstream(
                { jalonId: jalon.id, ...payload },
                motif ? { motif } : undefined
              );
              if (res.mode === "validation") {
                onToast("Demande de workstream soumise — en attente.");
              }
              setAddingWs(false);
              router.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

function WorkstreamCard({
  ws,
  open,
  onToggleOpen,
  onEnsureOpen,
  caps,
  canUpdate,
  canDelete,
  canCreate,
  pending,
  pendingByEntityId,
  issueById,
  onToast,
  onRefresh,
}: {
  ws: WorkstreamData;
  open: boolean;
  onToggleOpen: () => void;
  onEnsureOpen: () => void;
  caps: Pick<JalonWorkflowCaps, "create" | "update" | "delete">;
  canUpdate: boolean;
  canDelete: boolean;
  canCreate: boolean;
  pending?: PendingInfo;
  pendingByEntityId: Record<string, PendingInfo>;
  issueById: Map<string, string[]>;
  onToast: (m: string) => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [addingAct, setAddingAct] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMotif, setDeleteMotif] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  /** Stable "now" (évite mismatch hydratation). */
  const [now] = useState(() => new Date());
  const activites = ws.activites ?? [];
  const alerts = issueById.get(ws.id) ?? [];
  const retardJours = planningRetardDays(ws.date_fin, ws.statut, now, {
    dateReelle: ws.date_reelle,
  });
  const enRetard = retardJours != null;
  const clotureEcart = planningClotureEcartDays(ws.date_fin, ws.date_reelle);

  async function handleDelete() {
    setDeleteError("");
    if (!deleteMotif.trim()) {
      setDeleteError("Commentaire / motif obligatoire.");
      return;
    }
    setDeleting(true);
    try {
      const res = await deleteWorkstream(ws.id, { motif: deleteMotif.trim() });
      setDeleteOpen(false);
      if (res.mode === "validation") {
        onToast("Demande de suppression workstream soumise.");
      }
      onRefresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  }

  const hasAnomaly = alerts.length > 0;

  return (
    <div
      className={`rounded-lg border bg-card/90 ${
        hasAnomaly
          ? "border-amber-500/45 bg-amber-500/10 shadow-[inset_3px_0_0_0_rgb(245_158_11)] dark:bg-amber-950/30"
          : enRetard
            ? "border-red-400/55 bg-red-50/40 dark:bg-red-950/20"
            : ""
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0"
          onClick={onToggleOpen}
          title={open ? "Replier les activités" : "Déplier les activités"}
        >
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </Button>

        {editing ? (
          <div className="min-w-0 flex-1">
            <DetailForm
              label="workstream"
              createMode={caps.update}
              initial={ws}
              nextOrdre={ws.ordre}
              {...(() => {
                const check = allChildrenAtteint(activites);
                return {
                  canSetAtteint: check.ok,
                  canSetAtteintHint: check.ok
                    ? undefined
                    : `Atteint impossible : ${check.pending.length} activité(s) non atteinte(s).`,
                };
              })()}
              onCancel={() => setEditing(false)}
              onSubmit={async (payload, motif) => {
                const res = await updateWorkstream(
                  ws.id,
                  payload,
                  motif ? { motif } : undefined
                );
                if (res.mode === "validation") {
                  onToast("Demande de modification workstream soumise.");
                }
                setEditing(false);
                onRefresh();
              }}
            />
          </div>
        ) : (
          <>
            {/* Gauche : identité */}
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="w-5 shrink-0 text-xs text-muted-foreground">
                {ws.ordre}
              </span>
              <span
                className={
                  enRetard
                    ? "inline-flex min-w-0 max-w-full items-center truncate rounded-md border border-red-400 bg-red-50/90 px-1.5 py-0.5 text-sm font-semibold text-red-800 dark:border-red-400/70 dark:bg-red-950/40 dark:text-red-100"
                    : "min-w-0 truncate text-sm font-medium"
                }
                title={
                  enRetard
                    ? `${ws.nom} — en retard de ${retardJours} jour(s)`
                    : ws.nom
                }
              >
                {ws.nom}
              </span>
              {enRetard && <RetardBadge days={retardJours!} tone="ws" />}
              {hasAnomaly && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-100"
                  title={alerts.join("\n")}
                >
                  <AlertTriangle className="size-3 text-amber-600" />
                  Incohérence
                </span>
              )}
              {pending && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-500/50 text-[10px] text-amber-700"
                >
                  Demande {pending.operation}
                </Badge>
              )}
            </div>

            {/* Droite : méta + actions (toujours collés à droite) */}
            <div className="ml-auto flex shrink-0 items-center gap-2 self-center">
              <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
                <Badge variant="secondary" className="text-[10px]">
                  Workstream
                </Badge>
                <span
                  className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                  title="Date début → date fin planifiée"
                >
                  {fmtDate(ws.date_debut)} → {fmtDate(ws.date_fin)}
                </span>
                {ws.date_reelle && (
                  <span
                    className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                    title="Date de finalisation réelle"
                  >
                    <span className="text-[10px] font-medium text-[#0A3C74]">
                      Réel
                    </span>
                    {fmtDate(ws.date_reelle)}
                  </span>
                )}
                {clotureEcart != null && (
                  <ClotureEcartBadge days={clotureEcart} />
                )}
                <Badge
                  variant="secondary"
                  className="text-[10px]"
                  style={{
                    backgroundColor:
                      (STATUT_JALON_COLORS[ws.statut] ?? "#94a3b8") + "20",
                    color: STATUT_JALON_COLORS[ws.statut] ?? "#94a3b8",
                  }}
                >
                  {ws.statut}
                </Badge>
              </div>
              <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5">
                {canCreate && !pending && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    title="Ajouter activité"
                    onClick={() => {
                      onEnsureOpen();
                      setAddingAct(true);
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                )}
                {canUpdate && !pending && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    title="Modifier"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                {canDelete && !pending && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive"
                    title="Supprimer"
                    onClick={() => {
                      setDeleteMotif("");
                      setDeleteError("");
                      setDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {open && !editing && (
        <div
          className={`space-y-1 border-t px-2 py-2 pl-8 ${
            hasAnomaly ? "border-amber-500/25 bg-amber-500/5" : "bg-muted/15"
          }`}
        >
          {hasAnomaly && (
            <ul className="mb-1 space-y-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-950 dark:text-amber-100">
              {alerts.map((msg, idx) => (
                <li key={idx} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-600" />
                  <span>{msg}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <ListTree className="size-3" />
            Activités
          </p>
          {activites.length === 0 && !addingAct && (
            <p className="text-xs text-muted-foreground">Aucune activité.</p>
          )}
          {[...activites]
            .sort((a, b) => a.ordre - b.ordre)
            .map((a) => (
              <ActiviteRow
                key={a.id}
                act={a}
                caps={caps}
                canUpdate={canUpdate}
                canDelete={canDelete}
                pending={pendingByEntityId[a.id]}
                hasAlert={(issueById.get(a.id) ?? []).length > 0}
                onToast={onToast}
                onRefresh={onRefresh}
              />
            ))}
          {addingAct && (
            <DetailForm
              label="activité"
              createMode={caps.create}
              nextOrdre={
                activites.length
                  ? Math.max(...activites.map((a) => a.ordre)) + 1
                  : 1
              }
              onCancel={() => setAddingAct(false)}
              onSubmit={async (payload, motif) => {
                const res = await createActivite(
                  { workstreamId: ws.id, ...payload },
                  motif ? { motif } : undefined
                );
                if (res.mode === "validation") {
                  onToast("Demande d'activité soumise — en attente.");
                }
                setAddingAct(false);
                onRefresh();
              }}
            />
          )}
        </div>
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {caps.delete === "VALIDATION"
                ? "Demande de suppression workstream"
                : "Supprimer le workstream"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            « {ws.nom} » — {activites.length} activité(s) incluse(s).
          </p>
          <Input
            value={deleteMotif}
            onChange={(e) => setDeleteMotif(e.target.value)}
            placeholder="Commentaire / motif obligatoire..."
          />
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {caps.delete === "VALIDATION" ? "Soumettre" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActiviteRow({
  act,
  caps,
  canUpdate,
  canDelete,
  pending,
  hasAlert,
  onToast,
  onRefresh,
}: {
  act: ActiviteData;
  caps: Pick<JalonWorkflowCaps, "create" | "update" | "delete">;
  canUpdate: boolean;
  canDelete: boolean;
  pending?: PendingInfo;
  hasAlert: boolean;
  onToast: (m: string) => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMotif, setDeleteMotif] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [now] = useState(() => new Date());
  const retardJours = planningRetardDays(act.date_fin, act.statut, now, {
    dateReelle: act.date_reelle,
  });
  const enRetard = retardJours != null;
  const clotureEcart = planningClotureEcartDays(act.date_fin, act.date_reelle);

  async function handleDelete() {
    setDeleteError("");
    if (!deleteMotif.trim()) {
      setDeleteError("Commentaire / motif obligatoire.");
      return;
    }
    setDeleting(true);
    try {
      const res = await deleteActivite(act.id, { motif: deleteMotif.trim() });
      setDeleteOpen(false);
      if (res.mode === "validation") {
        onToast("Demande de suppression activité soumise.");
      }
      onRefresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <DetailForm
        label="activité"
        createMode={caps.update}
        initial={act}
        nextOrdre={act.ordre}
        onCancel={() => setEditing(false)}
        onSubmit={async (payload, motif) => {
          const res = await updateActivite(
            act.id,
            payload,
            motif ? { motif } : undefined
          );
          if (res.mode === "validation") {
            onToast("Demande de modification activité soumise.");
          }
          setEditing(false);
          onRefresh();
        }}
      />
    );
  }

  return (
    <>
      <div
        className={`flex items-center gap-2 rounded-md border px-1.5 py-1 ${
          hasAlert
            ? "border-amber-500/40 bg-amber-500/10 shadow-[inset_3px_0_0_0_rgb(245_158_11)] dark:bg-amber-950/25"
            : enRetard
              ? "border-transparent bg-red-50/50 dark:bg-red-950/20"
              : "border-transparent hover:bg-muted/40"
        }`}
      >
        {/* Gauche : identité */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="w-5 shrink-0 text-xs text-muted-foreground">
            {act.ordre}
          </span>
          <span
            className={
              enRetard
                ? "inline-flex min-w-0 max-w-full items-center truncate rounded-md border border-red-300 bg-red-50/80 px-1.5 py-0.5 text-sm font-medium text-red-700 dark:border-red-400/50 dark:bg-red-950/30 dark:text-red-100"
                : hasAlert
                  ? "min-w-0 truncate text-sm font-semibold text-amber-950 dark:text-amber-100"
                  : "min-w-0 truncate text-sm"
            }
            title={
              enRetard
                ? `${act.nom} — en retard de ${retardJours} jour(s)`
                : act.nom
            }
          >
            {act.nom}
          </span>
          {enRetard && <RetardBadge days={retardJours!} tone="act" />}
          {hasAlert && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-100"
              title="Incohérence de dates (voir les alertes du workstream / jalon)"
            >
              <AlertTriangle className="size-3 text-amber-600" />
              Incohérence
            </span>
          )}
          {pending && (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500/50 text-[10px] text-amber-700"
            >
              Demande {pending.operation}
            </Badge>
          )}
        </div>

        {/* Droite : méta + actions (toujours collés à droite) */}
        <div className="ml-auto flex shrink-0 items-center gap-2 self-center">
          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
            <Badge variant="outline" className="text-[10px]">
              Activité
            </Badge>
            <span
              className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
              title="Date début → date fin planifiée"
            >
              {fmtDate(act.date_debut)} → {fmtDate(act.date_fin)}
            </span>
            {act.date_reelle && (
              <span
                className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground"
                title="Date de finalisation réelle"
              >
                <span className="text-[10px] font-medium text-[#0A3C74]">
                  Réel
                </span>
                {fmtDate(act.date_reelle)}
              </span>
            )}
            {clotureEcart != null && (
              <ClotureEcartBadge days={clotureEcart} />
            )}
            <Badge
              variant="secondary"
              className="text-[10px]"
              style={{
                backgroundColor:
                  (STATUT_JALON_COLORS[act.statut] ?? "#94a3b8") + "20",
                color: STATUT_JALON_COLORS[act.statut] ?? "#94a3b8",
              }}
            >
              {act.statut || "Planifié"}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5 border-l border-border/60 pl-1.5">
            {canUpdate && !pending && (
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                title="Modifier"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            {canDelete && !pending && (
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-destructive"
                title="Supprimer"
                onClick={() => {
                  setDeleteMotif("");
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {caps.delete === "VALIDATION"
                ? "Demande de suppression activité"
                : "Supprimer l'activité"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">« {act.nom} »</p>
          <Input
            value={deleteMotif}
            onChange={(e) => setDeleteMotif(e.target.value)}
            placeholder="Commentaire / motif..."
          />
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {caps.delete === "VALIDATION" ? "Soumettre" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailForm({
  label,
  createMode,
  initial,
  nextOrdre,
  canSetAtteint = true,
  canSetAtteintHint,
  onCancel,
  onSubmit,
}: {
  label: string;
  createMode: WorkflowMode;
  initial?: {
    nom: string;
    ordre: number;
    date_debut?: Date | string | null;
    date_fin?: Date | string | null;
    date_reelle?: Date | string | null;
    statut?: string;
  };
  nextOrdre: number;
  /** false = option Atteint désactivée (enfants non tous Atteint) */
  canSetAtteint?: boolean;
  canSetAtteintHint?: string;
  onCancel: () => void;
  onSubmit: (payload: DetailPayload, motif?: string) => Promise<void>;
}) {
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [ordre, setOrdre] = useState(initial?.ordre ?? nextOrdre);
  const [dateDebut, setDateDebut] = useState(toInputDate(initial?.date_debut));
  const [dateFin, setDateFin] = useState(toInputDate(initial?.date_fin));
  const [dateReelle, setDateReelle] = useState(
    toInputDate(initial?.date_reelle)
  );
  const [statut, setStatut] = useState(initial?.statut ?? "Planifié");
  const [motif, setMotif] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const needsMotif = createMode === "VALIDATION";

  function handleStatutChange(next: string) {
    if (next === "Atteint" && !canSetAtteint) {
      setError(
        canSetAtteintHint ??
          "Impossible de passer à Atteint tant que les sous-éléments ne le sont pas tous."
      );
      return;
    }
    setError("");
    setStatut(next);
    if (next === "Atteint") {
      // Passage à Atteint → préremplir la date réelle si vide
      if (!dateReelle) setDateReelle(toYmdLocal());
    } else {
      // Quitter Atteint → vider la date de fin réelle
      setDateReelle("");
    }
  }

  async function save() {
    if (!nom.trim()) return;
    if (statut === "Atteint" && !canSetAtteint) {
      setError(
        canSetAtteintHint ??
          "Impossible de passer à Atteint tant que les sous-éléments ne le sont pas tous."
      );
      return;
    }
    if (needsMotif && !motif.trim()) {
      setError("Le motif de la demande est obligatoire.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(
        {
          nom: nom.trim(),
          ordre,
          date_debut: dateDebut || null,
          date_fin: dateFin || null,
          date_reelle: dateReelle || null,
          statut,
        },
        needsMotif ? motif.trim() : undefined
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  const fieldHint =
    "text-[10px] leading-snug text-muted-foreground mt-0.5 max-w-[11rem]";

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-dashed bg-muted/20 p-2.5">
      <p className="text-[11px] font-medium text-[#0A3C74]">
        {initial ? `Modifier le ${label}` : `Nouveau ${label}`}
      </p>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
        <div className="w-14 shrink-0">
          <Input
            type="number"
            value={ordre}
            onChange={(e) => setOrdre(Number(e.target.value))}
            className="h-8 w-14"
            aria-label="Ordre d'affichage"
          />
          <p className={fieldHint}>Ordre d&apos;affichage</p>
        </div>
        <div className="min-w-[10rem] flex-1">
          <Input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="h-8 w-full min-w-[10rem]"
            placeholder={`Nom du ${label}`}
            autoFocus
            aria-label={`Nom du ${label}`}
          />
          <p className={fieldHint}>Libellé du {label}</p>
        </div>
        <div className="w-[9.5rem] shrink-0">
          <Input
            type="date"
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
            className="h-8 w-[9.5rem]"
            aria-label="Date de début planifiée"
          />
          <p className={fieldHint}>Début planifié</p>
        </div>
        <div className="w-[9.5rem] shrink-0">
          <Input
            type="date"
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
            className="h-8 w-[9.5rem]"
            aria-label="Date de fin planifiée"
          />
          <p className={fieldHint}>Fin planifiée (cible)</p>
        </div>
        <div className="w-[9.5rem] shrink-0">
          <Input
            type="date"
            value={dateReelle}
            onChange={(e) => setDateReelle(e.target.value)}
            className="h-8 w-[9.5rem]"
            aria-label="Date de finalisation réelle"
          />
          <p className={fieldHint}>
            Fin réelle (auto si Atteint ; vidée sinon)
          </p>
        </div>
        <div className="w-[7.5rem] shrink-0">
          <select
            value={statut}
            onChange={(e) => handleStatutChange(e.target.value)}
            className="h-8 w-full rounded-md border bg-background px-2 text-xs"
            aria-label="Statut"
          >
            {STATUT_JALON_LIST.map((s) => (
              <option
                key={s}
                value={s}
                disabled={s === "Atteint" && !canSetAtteint && statut !== "Atteint"}
              >
                {s}
                {s === "Atteint" && !canSetAtteint && statut !== "Atteint"
                  ? " (bloqué)"
                  : ""}
              </option>
            ))}
          </select>
          <p className={fieldHint}>
            {canSetAtteint
              ? "Statut d'avancement"
              : canSetAtteintHint ??
                "Atteint bloqué tant que les enfants ne le sont pas"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={loading || !nom.trim()}
            onClick={save}
            title="Enregistrer"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Check className="size-3.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={onCancel}
            title="Annuler"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
      {needsMotif && (
        <div>
          <Input
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            className="h-8"
            placeholder="Motif de la demande (obligatoire)..."
            aria-label="Motif workflow"
          />
          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
            Justification pour le validateur (mode workflow)
          </p>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
