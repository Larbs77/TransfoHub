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
import { STATUT_JALON_LIST, STATUT_JALON_COLORS } from "@/lib/jalon-labels";

export interface ActiviteData {
  id: string;
  nom: string;
  ordre: number;
  description: string;
  date_debut: Date | string | null;
  date_fin: Date | string | null;
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
  statut: string;
  commentaire: string;
  activites: ActiviteData[];
}

export interface JalonForTree {
  id: string;
  nom: string;
  date_cible: Date | string;
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
};

type DetailPayload = {
  nom: string;
  ordre: number;
  date_debut?: string | null;
  date_fin?: string | null;
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
}: Props) {
  const router = useRouter();
  const caps = resolveDetailCaps(detailGouvernance, workflowCaps);
  const workstreams = jalon.workstreams ?? [];
  const [addingWs, setAddingWs] = useState(false);

  const issues = useMemo(
    () =>
      collectJalonCoherenceIssues({
        id: jalon.id,
        nom: jalon.nom,
        date_cible: jalon.date_cible,
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
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [addingAct, setAddingAct] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMotif, setDeleteMotif] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const activites = ws.activites ?? [];
  const alerts = issueById.get(ws.id) ?? [];

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

  return (
    <div
      className={`rounded-lg border bg-card/90 ${alerts.length ? "border-amber-500/40" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </Button>

        {editing ? (
          <DetailForm
            label="workstream"
            createMode={caps.update}
            initial={ws}
            nextOrdre={ws.ordre}
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
        ) : (
          <>
            <span className="w-5 text-xs text-muted-foreground">{ws.ordre}</span>
            <span className="min-w-[8rem] flex-1 text-sm font-medium">
              {ws.nom}
            </span>
            <Badge variant="secondary" className="text-[10px]">
              Workstream
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {fmtDate(ws.date_debut)} → {fmtDate(ws.date_fin)}
            </span>
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
            {alerts.length > 0 && (
              <AlertTriangle className="size-3.5 text-amber-600" />
            )}
            {pending && (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-[10px] text-amber-700"
              >
                Demande {pending.operation}
              </Badge>
            )}
            {canCreate && !pending && (
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                title="Ajouter activité"
                onClick={() => {
                  setOpen(true);
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
                onClick={() => {
                  setDeleteMotif("");
                  setDeleteError("");
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </>
        )}
      </div>

      {open && !editing && (
        <div className="space-y-1 border-t bg-muted/15 px-2 py-2 pl-8">
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
        className={`flex flex-wrap items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/40 ${
          hasAlert ? "bg-amber-500/5" : ""
        }`}
      >
        <span className="w-5 text-xs text-muted-foreground">{act.ordre}</span>
        <span className="min-w-[7rem] flex-1 text-sm">{act.nom}</span>
        <Badge variant="outline" className="text-[10px]">
          Activité
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {fmtDate(act.date_debut)} → {fmtDate(act.date_fin)}
        </span>
        {hasAlert && <AlertTriangle className="size-3 text-amber-600" />}
        {pending && (
          <Badge
            variant="outline"
            className="border-amber-500/50 text-[10px] text-amber-700"
          >
            Demande {pending.operation}
          </Badge>
        )}
        {canUpdate && !pending && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
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
    statut?: string;
  };
  nextOrdre: number;
  onCancel: () => void;
  onSubmit: (payload: DetailPayload, motif?: string) => Promise<void>;
}) {
  const [nom, setNom] = useState(initial?.nom ?? "");
  const [ordre, setOrdre] = useState(initial?.ordre ?? nextOrdre);
  const [dateDebut, setDateDebut] = useState(toInputDate(initial?.date_debut));
  const [dateFin, setDateFin] = useState(toInputDate(initial?.date_fin));
  const [statut, setStatut] = useState(initial?.statut ?? "Planifié");
  const [motif, setMotif] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const needsMotif = createMode === "VALIDATION";

  async function save() {
    if (!nom.trim()) return;
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

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-dashed bg-muted/20 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          value={ordre}
          onChange={(e) => setOrdre(Number(e.target.value))}
          className="h-8 w-14"
        />
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="h-8 min-w-[10rem] flex-1"
          placeholder={`Nom ${label}`}
          autoFocus
        />
        <Input
          type="date"
          value={dateDebut}
          onChange={(e) => setDateDebut(e.target.value)}
          className="h-8 w-[9.5rem]"
        />
        <Input
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
          className="h-8 w-[9.5rem]"
        />
        <select
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs"
        >
          {STATUT_JALON_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={loading || !nom.trim()}
          onClick={save}
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
        </Button>
        <Button size="icon" variant="ghost" className="size-7" onClick={onCancel}>
          <X className="size-3.5" />
        </Button>
      </div>
      {needsMotif && (
        <Input
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          className="h-8"
          placeholder="Motif de la demande (obligatoire)..."
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
