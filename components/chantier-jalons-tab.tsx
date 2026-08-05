"use client";

import { Fragment, useMemo, useState } from "react";
import { format, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Milestone,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Wand2,
  MapPin,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GanttChart,
  TimerOff,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteJalon, applyJalonTemplate } from "@/app/(app)/actions";
import { JalonFormDialog } from "@/components/jalon-form-dialog";
import {
  ChantierJalonPlanningTree,
  type WorkstreamData,
} from "@/components/chantier-jalon-planning-tree";
import {
  PHASES,
  PHASE_COLORS,
  STATUT_JALON_COLORS,
  planningRetardDays,
  isPlanningClosedStatut,
} from "@/lib/jalon-labels";
import { collectJalonCoherenceIssues } from "@/lib/planning-coherence";
import type { JalonWorkflowCaps, WorkflowMode } from "@/lib/workflow-shared";
import type { PlanningDetailGouvernance } from "@/lib/planning-coherence";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface JalonData {
  id: string;
  chantierId: string;
  phase: string;
  nom: string;
  description: string;
  ordre: number;
  date_debut: Date | null;
  date_cible: Date;
  date_reelle: Date | null;
  statut: string;
  livrables: string;
  commentaire: string;
  workstreams?: WorkstreamData[];
}

interface PendingInfo {
  id: string;
  operation: string;
  motif: string;
  requesterName: string;
}

interface Props {
  jalons: JalonData[];
  chantierId: string;
  dateDebut: Date;
  dateFin: Date;
  workflowCaps?: JalonWorkflowCaps;
  pendingByEntityId?: Record<string, PendingInfo>;
  pendingCreatesCount?: number;
  detailGouvernance?: PlanningDetailGouvernance;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div
        className="flex size-9 items-center justify-center rounded-md"
        style={{ backgroundColor: color + "18" }}
      >
        <Icon className="size-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

const DEFAULT_CAPS: JalonWorkflowCaps = {
  create: "DIRECT",
  update: "DIRECT",
  delete: "DIRECT",
  canApprove: false,
  canReject: false,
  canViewRequests: false,
  canViewHistory: false,
  canViewKpi: false,
};

export function ChantierJalonsTab({
  jalons,
  chantierId,
  dateDebut,
  dateFin,
  workflowCaps = DEFAULT_CAPS,
  pendingByEntityId = {},
  pendingCreatesCount = 0,
  detailGouvernance = "libre",
}: Props) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editJalon, setEditJalon] = useState<JalonData | null>(null);
  const [defaultPhase, setDefaultPhase] = useState<string | undefined>();
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JalonData | null>(null);
  const [deleteMotif, setDeleteMotif] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState("");
  const [expandedJalons, setExpandedJalons] = useState<Record<string, boolean>>(
    {}
  );
  const [expandedWorkstreams, setExpandedWorkstreams] = useState<
    Record<string, boolean>
  >({});

  /** Défaut : tout replié à l’ouverture de l’onglet. */
  function isExpanded(id: string) {
    return expandedJalons[id] ?? false;
  }
  function toggleJalon(id: string) {
    setExpandedJalons((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? false),
    }));
  }
  function toggleWorkstream(id: string) {
    setExpandedWorkstreams((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? false),
    }));
  }
  function ensureWorkstreamOpen(id: string) {
    setExpandedWorkstreams((prev) => ({ ...prev, [id]: true }));
  }

  function expandAllTree() {
    const nextJalons: Record<string, boolean> = {};
    const nextWs: Record<string, boolean> = {};
    for (const j of jalons) {
      nextJalons[j.id] = true;
      for (const ws of j.workstreams ?? []) {
        nextWs[ws.id] = true;
      }
    }
    setExpandedJalons(nextJalons);
    setExpandedWorkstreams(nextWs);
  }

  function collapseAllTree() {
    const nextJalons: Record<string, boolean> = {};
    const nextWs: Record<string, boolean> = {};
    for (const j of jalons) {
      nextJalons[j.id] = false;
      for (const ws of j.workstreams ?? []) {
        nextWs[ws.id] = false;
      }
    }
    setExpandedJalons(nextJalons);
    setExpandedWorkstreams(nextWs);
  }

  const canCreate = workflowCaps.create !== "INTERDIT";
  const canUpdate = workflowCaps.update !== "INTERDIT";
  const canDelete = workflowCaps.delete !== "INTERDIT";
  const formMode: WorkflowMode = editJalon
    ? workflowCaps.update
    : workflowCaps.create;

  // Stable "now" to avoid SSR/client hydration mismatch
  const [now] = useState(() => new Date());

  // KPI calculations
  const total = jalons.length;
  const atteints = jalons.filter((j) => j.statut === "Atteint").length;
  const enRetard = jalons.filter(
    (j) =>
      planningRetardDays(j.date_cible, j.statut, now, {
        dateReelle: j.date_reelle,
      }) != null
  ).length;
  const prochaine = jalons
    .filter(
      (j) =>
        !isPlanningClosedStatut(j.statut) &&
        !j.date_reelle &&
        new Date(j.date_cible) >= now
    )
    .sort(
      (a, b) =>
        new Date(a.date_cible).getTime() - new Date(b.date_cible).getTime()
    )[0];

  // Group by phase
  const phaseGroups = PHASES.map((phase) => {
    const items = jalons.filter((j) => j.phase === phase);
    const phaseAtteints = items.filter((j) => j.statut === "Atteint").length;
    return { phase, items, atteints: phaseAtteints, total: items.length };
  });

  // Find the first phase that has items for default tab
  const defaultTab = phaseGroups.find((g) => g.total > 0)?.phase ?? PHASES[0];

  function ecart(j: JalonData): { days: number; label: string; color: string } | null {
    // En retard courant (ouvert + échéance dépassée) → rouge
    const retard = planningRetardDays(j.date_cible, j.statut, now, {
      dateReelle: j.date_reelle,
    });
    if (retard != null) {
      return { days: retard, label: `+${retard}j`, color: "#ef4444" };
    }

    // Terminé : écart historique vs date réelle (pas du « en retard » rouge)
    if (j.date_reelle) {
      const days = differenceInDays(
        new Date(j.date_reelle),
        new Date(j.date_cible)
      );
      if (days === 0) return { days: 0, label: "0j", color: "#22c55e" };
      if (days > 0) {
        // Achevé en retard → gris/ambre, pas rouge « en retard »
        return { days, label: `+${days}j`, color: "#64748b" };
      }
      return { days, label: `${days}j`, color: "#22c55e" };
    }

    return null;
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteError("");
    if (!deleteMotif.trim()) {
      setDeleteError(
        workflowCaps.delete === "VALIDATION"
          ? "Le motif de la demande est obligatoire."
          : "Le commentaire est obligatoire pour supprimer un jalon."
      );
      return;
    }
    setDeleting(true);
    try {
      const result = await deleteJalon(deleteTarget.id, {
        motif: deleteMotif.trim(),
      });
      setDeleteTarget(null);
      setDeleteMotif("");
      if (result.mode === "validation") {
        setToast("Demande de suppression soumise — en attente de validation.");
      }
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setDeleting(false);
    }
  }

  async function handleApplyTemplate() {
    if (!canCreate) return;
    setApplyingTemplate(true);
    try {
      await applyJalonTemplate(chantierId);
      router.refresh();
    } catch {
      // template already applied
    }
    setApplyingTemplate(false);
  }

  // Phase timeline visualization — extend range to include all jalons
  const allDates = jalons.map((j) => new Date(j.date_cible).getTime());
  const timelineStart = new Date(Math.min(new Date(dateDebut).getTime(), ...allDates));
  const timelineEnd = new Date(Math.max(new Date(dateFin).getTime(), ...allDates));
  const totalDuration = Math.max(differenceInDays(timelineEnd, timelineStart), 1);
  const todayPct = Math.min(
    Math.max((differenceInDays(now, timelineStart) / totalDuration) * 100, 0),
    100
  );
  const chantierStartPct = (differenceInDays(new Date(dateDebut), timelineStart) / totalDuration) * 100;
  const chantierEndPct = (differenceInDays(new Date(dateFin), timelineStart) / totalDuration) * 100;

  /** Jalons Atteint livrés après la date cible (retard historique enregistré). */
  const atteintsHorsDelai = useMemo(() => {
    return jalons.filter((j) => {
      if (j.statut !== "Atteint" || !j.date_reelle) return false;
      return (
        differenceInDays(new Date(j.date_reelle), new Date(j.date_cible)) > 0
      );
    }).length;
  }, [jalons]);

  /**
   * Anomalies de cohérence planning (mêmes règles que les alertes de l’arbre).
   * Permet le fil d’Ariane visuel phase → jalon → workstream → activité.
   */
  const planningAnomalies = useMemo(() => {
    const workstreamIds = new Set<string>();
    const activiteIds = new Set<string>();
    const jalonIds = new Set<string>();
    const issueCountByJalon = new Map<string, number>();
    const jalonsWithAnomalyByPhase = new Map<string, number>();

    for (const j of jalons) {
      const issues = collectJalonCoherenceIssues({
        id: j.id,
        nom: j.nom,
        date_cible: j.date_cible,
        statut: j.statut,
        workstreams: j.workstreams,
      });
      if (issues.length === 0) continue;
      jalonIds.add(j.id);
      issueCountByJalon.set(j.id, issues.length);
      jalonsWithAnomalyByPhase.set(
        j.phase,
        (jalonsWithAnomalyByPhase.get(j.phase) ?? 0) + 1
      );
      for (const issue of issues) {
        if (issue.level === "workstream") workstreamIds.add(issue.entityId);
        if (issue.level === "activite") activiteIds.add(issue.entityId);
        if (issue.level === "jalon") jalonIds.add(issue.entityId);
      }
    }

    return {
      jalons: jalonIds.size,
      workstreams: workstreamIds.size,
      activites: activiteIds.size,
      total: jalonIds.size + workstreamIds.size + activiteIds.size,
      jalonIds,
      issueCountByJalon,
      jalonsWithAnomalyByPhase,
    };
  }, [jalons]);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Total jalons" value={total} icon={Milestone} color="#6366f1" />
        <KpiCard label="Atteints" value={atteints} icon={CheckCircle2} color="#22c55e" />
        <KpiCard label="En retard" value={enRetard} icon={AlertTriangle} color="#ef4444" />
        <KpiCard
          label="Prochaine échéance"
          value={
            prochaine
              ? format(new Date(prochaine.date_cible), "dd MMM", { locale: fr })
              : "—"
          }
          icon={Clock}
          color="#3b82f6"
        />
      </div>

      {/* Phase Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Timeline des phases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-28">
            {/* Chantier expected date range background */}
            <div
              className="absolute top-0 h-6 rounded-md bg-blue-50/40 border border-dashed border-blue-500/30"
              style={{
                left: `${chantierStartPct}%`,
                width: `${Math.max(chantierEndPct - chantierStartPct, 1)}%`,
              }}
            />

            {/* Phase bands */}
            <div className="absolute inset-x-0 top-0 h-6 rounded-md overflow-visible">
              {PHASES.map((phase) => {
                const phaseJalons = jalons.filter((j) => j.phase === phase);
                if (phaseJalons.length === 0) return null;
                const firstDate = new Date(
                  Math.min(...phaseJalons.map((j) => new Date(j.date_cible).getTime()))
                );
                const lastDate = new Date(
                  Math.max(...phaseJalons.map((j) => new Date(j.date_cible).getTime()))
                );
                const leftPct = (differenceInDays(firstDate, timelineStart) / totalDuration) * 100;
                const widthPct = Math.max(
                  (differenceInDays(lastDate, firstDate) / totalDuration) * 100,
                  3
                );
                return (
                  <div
                    key={phase}
                    className="absolute h-full flex items-center justify-center text-[10px] font-medium text-white rounded-sm"
                    style={{
                      left: `${Math.max(leftPct, 0)}%`,
                      width: `${widthPct}%`,
                      backgroundColor: PHASE_COLORS[phase],
                    }}
                  >
                    {widthPct > 8 && phase}
                  </div>
                );
              })}
            </div>

            {/* Chantier start/end dashed lines */}
            <div
              className="absolute top-0 border-l border-dashed border-blue-500/60"
              style={{ left: `${chantierStartPct}%`, height: "60%" }}
            >
              <span className="absolute bottom-0 translate-y-full -translate-x-1/2 text-[9px] text-blue-500 font-medium whitespace-nowrap">
                {format(new Date(dateDebut), "dd MMM yy", { locale: fr })}
              </span>
            </div>
            <div
              className="absolute top-0 border-l border-dashed border-blue-500/60"
              style={{ left: `${chantierEndPct}%`, height: "60%" }}
            >
              <span className="absolute bottom-0 translate-y-full -translate-x-1/2 text-[9px] text-blue-500 font-medium whitespace-nowrap">
                {format(new Date(dateFin), "dd MMM yy", { locale: fr })}
              </span>
            </div>

            {/* Milestone markers */}
            <div className="absolute inset-x-0 top-7 h-8">
              {jalons.map((j) => {
                const leftPct = (differenceInDays(new Date(j.date_cible), timelineStart) / totalDuration) * 100;
                const color = STATUT_JALON_COLORS[j.statut] ?? "#94a3b8";
                return (
                  <div
                    key={j.id}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
                    title={`${j.nom} — ${j.statut} — ${format(new Date(j.date_cible), "dd MMM yyyy", { locale: fr })}`}
                  >
                    <div
                      className="size-3 rotate-45 rounded-sm border-2 border-white"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Today marker */}
            {todayPct >= 0 && todayPct <= 100 && (
              <div
                className="absolute top-0 border-l-2 border-dashed border-red-500 z-10"
                style={{ left: `${todayPct}%`, height: "60%" }}
              >
                <MapPin className="absolute -top-5 -left-[9px] size-[18px] fill-red-500 text-white drop-shadow-sm" />
              </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-0 inset-x-0 flex gap-3 text-[10px] text-muted-foreground">
              {Object.entries(STATUT_JALON_COLORS).map(([statut, color]) => (
                <span key={statut} className="flex items-center gap-1">
                  <span
                    className="inline-block size-2 rotate-45 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  {statut}
                </span>
              ))}
              <span className="flex items-center gap-1 ml-2">
                <span className="inline-block w-3 h-0 border-t border-dashed border-blue-500/60" />
                Dates prévues
              </span>
              <span className="flex items-center gap-1 ml-2">
                <MapPin className="size-2.5 fill-red-500 text-white" />
                Aujourd&apos;hui
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Tabs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Jalons par phase</CardTitle>
          <CardDescription>
            {total} jalon(s) — {atteints}/{total} atteints · arbre Workstream →
            Activité
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-0.5 rounded-md border border-[#0A3C74]/15 bg-[#0A3C74]/[0.03] p-0.5"
                role="group"
                aria-label="Déplier ou replier l'arborescence jalons"
              >
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-[#0A3C74] hover:bg-white"
                  onClick={expandAllTree}
                  disabled={total === 0}
                  title="Déplier tous les jalons, workstreams et activités"
                >
                  <ChevronsUpDown className="size-3.5" />
                  Tout déplier
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-[#0A3C74] hover:bg-white"
                  onClick={collapseAllTree}
                  disabled={total === 0}
                  title="Replier tous les jalons, workstreams et activités"
                >
                  <ChevronsDownUp className="size-3.5" />
                  Tout replier
                </Button>
              </div>
              <Button
                size="sm"
                variant="outline"
                asChild
                disabled={total === 0}
                title={
                  total === 0
                    ? "Ajoutez des jalons pour afficher le Gantt"
                    : "Ouvrir le diagramme de Gantt dans un nouvel onglet"
                }
              >
                <Link
                  href={`/chantiers/${chantierId}/gantt`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={total === 0}
                  className={
                    total === 0 ? "pointer-events-none opacity-50" : undefined
                  }
                  onClick={(e) => {
                    if (total === 0) e.preventDefault();
                  }}
                >
                  <GanttChart className="size-4" />
                  Planning GANTT
                </Link>
              </Button>
              {total === 0 && canCreate && workflowCaps.create === "DIRECT" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApplyTemplate}
                  disabled={applyingTemplate}
                >
                  {applyingTemplate ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wand2 className="size-4" />
                  )}
                  Appliquer modèle
                </Button>
              )}
              {canCreate && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditJalon(null);
                    setDefaultPhase(undefined);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  {workflowCaps.create === "VALIDATION"
                    ? "Demander un jalon"
                    : "Nouveau jalon"}
                </Button>
              )}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {/* Mentions synthèse : atteints hors délai + anomalies de cohérence */}
          {total > 0 && (
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <div
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
                  atteintsHorsDelai > 0
                    ? "border-orange-500/35 bg-orange-500/[0.07]"
                    : "border-border bg-muted/20"
                }`}
                title="Jalons au statut Atteint dont la date réelle est postérieure à la date cible"
              >
                <span
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    atteintsHorsDelai > 0
                      ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <TimerOff className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-tight text-foreground">
                    Atteints hors délai
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Jalons clôturés après leur date cible
                  </p>
                  <p
                    className={`mt-1.5 text-2xl font-bold tabular-nums ${
                      atteintsHorsDelai > 0
                        ? "text-orange-700 dark:text-orange-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {atteintsHorsDelai}
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
                  planningAnomalies.total > 0
                    ? "border-amber-500/40 bg-amber-500/[0.08]"
                    : "border-border bg-muted/20"
                }`}
                title="Incohérences de dates : activité hors workstream, workstream après jalon, plages inversées…"
              >
                <span
                  className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    planningAnomalies.total > 0
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <ShieldAlert className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-tight text-foreground">
                    Anomalies de planning
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Incohérences de dates dans l&apos;arbre
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="gap-1 border border-amber-500/25 bg-background/80 text-[11px] font-semibold tabular-nums"
                    >
                      <Milestone className="size-3 text-amber-700" />
                      {planningAnomalies.jalons} jalon
                      {planningAnomalies.jalons !== 1 ? "s" : ""}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="gap-1 border border-amber-500/25 bg-background/80 text-[11px] font-semibold tabular-nums"
                    >
                      {planningAnomalies.workstreams} workstream
                      {planningAnomalies.workstreams !== 1 ? "s" : ""}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="gap-1 border border-amber-500/25 bg-background/80 text-[11px] font-semibold tabular-nums"
                    >
                      {planningAnomalies.activites} activit
                      {planningAnomalies.activites !== 1 ? "és" : "é"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {toast && (
            <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
              {toast}
            </div>
          )}
          {pendingCreatesCount > 0 && (
            <div className="mb-3 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs">
              {pendingCreatesCount} demande(s) de création en attente de validation.
            </div>
          )}
          {total === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Aucun jalon.
              {canCreate && workflowCaps.create === "DIRECT"
                ? " Cliquez sur « Appliquer modèle » pour créer les jalons standard."
                : ""}
            </div>
          ) : (
            <Tabs defaultValue={defaultTab} className="space-y-3">
              <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
                {phaseGroups.map((group) => {
                  const anomalyCount =
                    planningAnomalies.jalonsWithAnomalyByPhase.get(
                      group.phase
                    ) ?? 0;
                  const phaseHasAnomaly = anomalyCount > 0;
                  return (
                    <TabsTrigger
                      key={group.phase}
                      value={group.phase}
                      disabled={group.total === 0}
                      title={
                        phaseHasAnomaly
                          ? `${anomalyCount} jalon(s) avec incohérence(s) de planning dans cette phase`
                          : undefined
                      }
                      className={`gap-1.5 ${
                        phaseHasAnomaly
                          ? "border border-amber-500/45 bg-amber-500/15 text-amber-950 data-[state=active]:border-amber-500/60 data-[state=active]:bg-amber-500/25 data-[state=active]:text-amber-950 dark:text-amber-100 dark:data-[state=active]:text-amber-50"
                          : ""
                      }`}
                    >
                      {phaseHasAnomaly ? (
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <div
                          className="size-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor: PHASE_COLORS[group.phase],
                          }}
                        />
                      )}
                      <span
                        style={{
                          color: group.total > 0 ? undefined : "#9ca3af",
                        }}
                      >
                        {group.phase}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`px-1.5 py-0 text-[10px] ${
                          phaseHasAnomaly
                            ? "border border-amber-500/35 bg-amber-500/20 text-amber-900 dark:text-amber-100"
                            : ""
                        }`}
                        style={
                          !phaseHasAnomaly &&
                          group.atteints === group.total &&
                          group.total > 0
                            ? {
                                backgroundColor: "#22c55e20",
                                color: "#22c55e",
                              }
                            : undefined
                        }
                      >
                        {phaseHasAnomaly
                          ? `${anomalyCount} alerte${anomalyCount > 1 ? "s" : ""}`
                          : `${group.atteints}/${group.total}`}
                      </Badge>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {phaseGroups.map((group) => (
                <TabsContent key={group.phase} value={group.phase}>
                  {group.total === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Aucun jalon pour cette phase
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Add button for this phase */}
                      {canCreate && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditJalon(null);
                              setDefaultPhase(group.phase);
                              setDialogOpen(true);
                            }}
                          >
                            <Plus className="size-3" />
                            Ajouter à {group.phase}
                          </Button>
                        </div>
                      )}

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8" />
                            <TableHead className="w-[200px]">Nom</TableHead>
                            <TableHead className="w-[100px]">Date de début</TableHead>
                            <TableHead className="w-[100px]">Date cible</TableHead>
                            <TableHead className="w-[100px]">Date réelle</TableHead>
                            <TableHead className="w-[70px] text-center">Écart</TableHead>
                            <TableHead className="w-[90px]">Statut</TableHead>
                            <TableHead className="w-[100px]">Détail</TableHead>
                            <TableHead className="w-[80px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.items.map((j) => {
                            const e = ecart(j);
                            const pending = pendingByEntityId[j.id];
                            const wsCount = j.workstreams?.length ?? 0;
                            const actCount =
                              j.workstreams?.reduce(
                                (n, w) => n + (w.activites?.length ?? 0),
                                0
                              ) ?? 0;
                            const expanded = isExpanded(j.id);
                            const retardJours = planningRetardDays(
                              j.date_cible,
                              j.statut,
                              now,
                              { dateReelle: j.date_reelle }
                            );
                            const enRetardJalon = retardJours != null;
                            const anomalyCount =
                              planningAnomalies.issueCountByJalon.get(j.id) ??
                              0;
                            const hasAnomaly = anomalyCount > 0;
                            return (
                              <Fragment key={j.id}>
                                <TableRow
                                  className={
                                    hasAnomaly
                                      ? "border-l-4 border-l-amber-500 bg-amber-500/10 dark:bg-amber-950/30"
                                      : enRetardJalon
                                        ? "bg-red-50/40 dark:bg-red-950/15"
                                        : undefined
                                  }
                                >
                                  <TableCell className="px-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      className={`size-7 ${
                                        hasAnomaly
                                          ? "text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
                                          : ""
                                      }`}
                                      onClick={() => toggleJalon(j.id)}
                                      title={
                                        expanded
                                          ? "Replier workstreams"
                                          : hasAnomaly
                                            ? `Déplier — ${anomalyCount} incohérence(s) de planning`
                                            : "Déplier workstreams"
                                      }
                                    >
                                      {expanded ? (
                                        <ChevronDown className="size-3.5" />
                                      ) : (
                                        <ChevronRight className="size-3.5" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                          className={
                                            enRetardJalon
                                              ? "inline-flex max-w-full items-center rounded-md border-2 border-red-600 bg-red-50 px-2 py-0.5 text-sm font-semibold text-red-800 dark:border-red-500 dark:bg-red-950/50 dark:text-red-100"
                                              : hasAnomaly
                                                ? "inline-flex max-w-full items-center rounded-md border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-sm font-semibold text-amber-950 dark:text-amber-100"
                                                : "text-sm font-medium"
                                          }
                                          title={
                                            enRetardJalon
                                              ? `En retard de ${retardJours} jour(s)`
                                              : hasAnomaly
                                                ? `${anomalyCount} incohérence(s) de planning — ouvrir le détail`
                                                : undefined
                                          }
                                        >
                                          {j.nom}
                                        </span>
                                        {hasAnomaly && (
                                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-100">
                                            <AlertTriangle className="size-3 text-amber-600" />
                                            {anomalyCount} alerte
                                            {anomalyCount > 1 ? "s" : ""}
                                          </span>
                                        )}
                                        {enRetardJalon && (
                                          <span className="inline-flex items-center rounded-full border border-red-600/40 bg-red-600/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-red-700 dark:text-red-300">
                                            +{retardJours}j
                                          </span>
                                        )}
                                      </div>
                                      {j.description && (
                                        <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                                          {j.description}
                                        </p>
                                      )}
                                      {pending && (
                                        <Badge
                                          variant="outline"
                                          className="mt-1 border-amber-500/50 text-[10px] text-amber-700 dark:text-amber-300"
                                        >
                                          Demande {pending.operation} en attente
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {j.date_debut
                                      ? format(
                                          new Date(j.date_debut),
                                          "dd MMM yyyy",
                                          { locale: fr }
                                        )
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {format(new Date(j.date_cible), "dd MMM yyyy", {
                                      locale: fr,
                                    })}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {j.date_reelle
                                      ? format(
                                          new Date(j.date_reelle),
                                          "dd MMM yyyy",
                                          { locale: fr }
                                        )
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {e ? (
                                      <span
                                        className="text-xs font-semibold"
                                        style={{ color: e.color }}
                                      >
                                        {e.label}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="secondary"
                                      style={{
                                        backgroundColor:
                                          (STATUT_JALON_COLORS[j.statut] ??
                                            "#94a3b8") + "20",
                                        color:
                                          STATUT_JALON_COLORS[j.statut] ??
                                          "#94a3b8",
                                      }}
                                    >
                                      {j.statut}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-[11px] text-muted-foreground">
                                    {wsCount} WS · {actCount} act.
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      {canUpdate && !pending && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0"
                                          title={
                                            workflowCaps.update === "VALIDATION"
                                              ? "Demander une modification"
                                              : "Modifier"
                                          }
                                          onClick={() => {
                                            setEditJalon(j);
                                            setDialogOpen(true);
                                          }}
                                        >
                                          <Pencil className="size-3" />
                                        </Button>
                                      )}
                                      {canDelete && !pending && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                          title={
                                            workflowCaps.delete === "VALIDATION"
                                              ? "Demander une suppression"
                                              : "Supprimer"
                                          }
                                          onClick={() => {
                                            setDeleteError("");
                                            setDeleteMotif("");
                                            setDeleteTarget(j);
                                          }}
                                        >
                                          <Trash2 className="size-3" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {expanded && (
                                  <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={9} className="bg-muted/10 py-3">
                                      <ChantierJalonPlanningTree
                                        jalon={j}
                                        workflowCaps={workflowCaps}
                                        detailGouvernance={detailGouvernance}
                                        pendingByEntityId={pendingByEntityId}
                                        onToast={setToast}
                                        workstreamOpen={expandedWorkstreams}
                                        onToggleWorkstream={toggleWorkstream}
                                        onEnsureWorkstreamOpen={
                                          ensureWorkstreamOpen
                                        }
                                      />
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <JalonFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jalon={editJalon}
        chantierId={chantierId}
        defaultPhase={defaultPhase}
        workflowMode={formMode === "INTERDIT" ? "DIRECT" : formMode}
        onResult={(r) => {
          if (r.mode === "validation") {
            setToast("Demande soumise — en attente de validation.");
          }
          router.refresh();
        }}
      />

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {workflowCaps.delete === "VALIDATION"
                ? "Demande de suppression"
                : "Supprimer le jalon"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {deleteTarget
                ? workflowCaps.delete === "VALIDATION"
                  ? `Soumettre une demande de suppression pour « ${deleteTarget.nom} » ?`
                  : `Confirmer la suppression de « ${deleteTarget.nom} » ? Un commentaire est obligatoire.`
                : ""}
            </p>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                {workflowCaps.delete === "VALIDATION"
                  ? "Motif"
                  : "Commentaire"}{" "}
                <span className="text-destructive">*</span>
              </label>
              <Input
                value={deleteMotif}
                onChange={(e) => setDeleteMotif(e.target.value)}
                placeholder="Justifiez la suppression..."
              />
            </div>
            {deleteError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteConfirm}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {workflowCaps.delete === "VALIDATION"
                ? "Soumettre"
                : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
