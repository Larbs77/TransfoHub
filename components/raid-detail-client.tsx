"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { readRaidListReturnUrl } from "@/lib/raid-list-query";
import { parseMentionBody } from "@/lib/raid-mentions";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  MessageSquare,
  UserPlus,
  UserCheck,
  GitBranch,
  History,
  Loader2,
  Send,
  Shield,
  Calendar,
  Building2,
  Users,
  Sparkles,
  CircleDot,
  CheckCircle2,
  AlertTriangle,
  Info,
  Gavel,
  Pencil,
  Share2,
  Link2,
  X,
  ChevronDown,
  Search,
  Check,
  Crown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  RAID_TYPE_COLORS,
  RAID_TYPE_LABELS,
  RAID_AUDIT_FIELD_LABELS,
  getStatutColor,
  getStatutsForType,
  evaluateRaidRisque,
  formatRisqueLienLabel,
  risqueAActionsLieesOuvertes,
  CRITICITE_COLORS,
  CRITICITE_FG,
  PROBABILITE_LABELS,
  IMPACT_LABELS,
  isRaidClosed,
  isRaidOverdue,
  raidEffectiveEcheance,
  type RaidFieldOptionItem,
  type StatusConfigItem,
} from "@/lib/raid-labels";
import { Input } from "@/components/ui/input";
import {
  DOMAINE_COLORS,
  DOMAINE_LABELS,
  PRIORITE_CHANTIER_COLORS,
  PRIORITE_CHANTIER_LABELS,
  STATUT_CHANTIER_COLORS,
  STATUT_CHANTIER_LABELS,
} from "@/lib/chantier-labels";
import { UserAvatar } from "@/components/user-avatar";
import { RaidFormDialog } from "@/components/raid-form-dialog";
import {
  addRaidComment,
  changeRaidStatus,
  assignRaidToRessource,
  autoAssignRaidToMe,
  getRaidAssignmentContext,
  getRaidDetail,
  shareRaidWithEquipes,
  unshareRaidEquipe,
} from "@/app/(app)/raid/[id]/actions";
import type { RaidAssignmentContext } from "@/lib/raid-assign";

type AuditLog = {
  id: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  summary: string;
  actorName: string;
  createdAt: Date | string;
};

type MentionRef = {
  ressourceId: string;
  ressource: { id: string; nom_complet: string };
};

type Comment = {
  id: string;
  body: string;
  is_system: boolean;
  authorName: string;
  authorUserId?: string | null;
  authorRessourceId?: string | null;
  createdAt: Date | string;
  mentions?: MentionRef[];
};

type Partage = {
  id: string;
  equipeId: string;
  sharedByName: string;
  equipe: {
    id: string;
    name: string;
    type?: string | null;
    chantier: { id: string; code: string; nom: string } | null;
  };
};

type MentionCandidate = {
  id: string;
  nom_complet: string;
  role: string;
  equipeName: string;
  hasAccount: boolean;
};

type ShareTarget = {
  id: string;
  name: string;
  chantierCode: string;
  chantierNom: string;
  domaine: string;
  statut: string;
  priorite: string;
  avancement: number;
  membres: number;
  directeur: string;
  dateDebut: string;
  dateFin: string;
};

type RaidDetail = {
  id: string;
  code: string;
  type: string;
  intitule: string;
  description: string;
  categorie: string;
  domaine: string;
  probabilite: number | null;
  impact: number | null;
  niveau_maitrise?: string | null;
  strategie: string;
  mitigation: string;
  responsable: string;
  responsableRessourceId: string | null;
  statut: string;
  date_identification: Date | string | null;
  date_revision: Date | string | null;
  date_echeance: Date | string | null;
  date_echeance_actualisee?: Date | string | null;
  date_fin_reelle?: Date | string | null;
  commentaires: string;
  deletedAt?: Date | string | null;
  deletedByName?: string | null;
  deleteMotif?: string | null;
  createdByName: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  chantier: { id: string; code: string; nom: string; domaine: string } | null;
  comite: {
    id: string;
    instance: string;
    numero: number;
    date: Date | string;
  } | null;
  responsableRessource: {
    id: string;
    nom_complet: string;
    organisation: string;
    email: string;
    equipeHierarchie: { id: string; name: string } | null;
  } | null;
  equipe: { id: string; name: string; type?: string | null } | null;
  risqueLie?: { id: string; code: string; intitule: string } | null;
  actionsLiees?: Array<{
    id: string;
    code: string;
    description: string;
    intitule: string;
    statut: string;
  }>;
  partages?: Partage[];
  raidComments: Comment[];
  auditLogs: AuditLog[];
  risqueLieId?: string | null;
  comiteId?: string | null;
};

type RessourceOption = {
  id: string;
  nom_complet: string;
  organisation: string;
};

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy HH:mm", { locale: fr });
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy", { locale: fr });
}

function typeIcon(type: string) {
  switch (type) {
    case "Risque":
      return AlertTriangle;
    case "Action":
      return CheckCircle2;
    case "Décision":
      return Gavel;
    default:
      return Info;
  }
}

function actionColor(action: string): string {
  switch (action) {
    case "created":
      return "#0A3C74";
    case "status_changed":
      return "#00BDBB";
    case "assigned":
    case "auto_assigned":
      return "#2563eb";
    case "unassigned":
      return "#f59e0b";
    case "commented":
      return "#7c3aed";
    case "field_updated":
      return "#0369a1";
    case "shared":
      return "#0A3C74";
    case "unshared":
      return "#b45309";
    default:
      return "#6b7280";
  }
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    created: "Création",
    status_changed: "Statut",
    assigned: "Assignation",
    auto_assigned: "Auto-assignation",
    unassigned: "Désassignation",
    commented: "Commentaire",
    field_updated: "Modification",
    shared: "Partage",
    unshared: "Partage retiré",
  };
  return map[action] ?? action;
}

export function RaidDetailClient({
  raid: initial,
  canCollaborate: canCollaborateProp,
  canAssign: canAssignProp = false,
  canEdit: canEditProp = false,
  canComment: canCommentProp = false,
  canShare: canShareProp = false,
  accessViaShareOnly: accessViaShareOnlyProp = false,
  mentionCandidates: mentionCandidatesProp,
  shareTargets: shareTargetsProp,
  currentUser,
  ressources,
  statusConfigs = [],
  fieldOptions = [],
  returnTo = null,
  nowMs,
}: {
  raid: RaidDetail;
  canCollaborate: boolean;
  /** Admin / Bureau Programme / Directeur-Suppléant-PMO chantier */
  canAssign?: boolean;
  canEdit?: boolean;
  canComment?: boolean;
  canShare?: boolean;
  accessViaShareOnly?: boolean;
  mentionCandidates: MentionCandidate[];
  shareTargets: ShareTarget[];
  currentUser: {
    userId: string;
    ressourceId: string | null;
    displayName: string;
  };
  ressources: RessourceOption[];
  statusConfigs?: StatusConfigItem[];
  fieldOptions?: RaidFieldOptionItem[];
  returnTo?: string | null;
  nowMs: number;
}) {
  const router = useRouter();
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [raid, setRaid] = useState(initial);
  const [canCollaborate, setCanCollaborate] = useState(canCollaborateProp);
  const [canAssign, setCanAssign] = useState(canAssignProp);
  const [canEdit, setCanEdit] = useState(canEditProp);
  const [canComment, setCanComment] = useState(canCommentProp);
  const [canShare, setCanShare] = useState(canShareProp);
  const [accessViaShareOnly, setAccessViaShareOnly] = useState(
    accessViaShareOnlyProp
  );
  const [mentionCandidates, setMentionCandidates] = useState(
    mentionCandidatesProp
  );
  const [shareTargets, setShareTargets] = useState(shareTargetsProp);
  const [comment, setComment] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [commentCursor, setCommentCursor] = useState(0);
  const [mentionSuppressed, setMentionSuppressed] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatut, setNewStatut] = useState(raid.statut);
  const [statusComment, setStatusComment] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState(
    raid.responsableRessourceId ?? "__none__"
  );
  const [assignQuery, setAssignQuery] = useState("");
  const [assignMode, setAssignMode] = useState<"keep" | "move">("keep");
  const [assignChantierId, setAssignChantierId] = useState<string | null>(null);
  const [assignCtx, setAssignCtx] = useState<RaidAssignmentContext | null>(null);
  const [assignCtxError, setAssignCtxError] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [circulationOpen, setCirculationOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePick, setSharePick] = useState<string[]>([]);
  const [shareQuery, setShareQuery] = useState("");
  const [unshareId, setUnshareId] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRaid(initial);
    setCanCollaborate(canCollaborateProp);
    setCanAssign(canAssignProp);
    setCanEdit(canEditProp);
    setCanComment(canCommentProp);
    setCanShare(canShareProp);
    setAccessViaShareOnly(accessViaShareOnlyProp);
    setMentionCandidates(mentionCandidatesProp);
    setShareTargets(shareTargetsProp);
  }, [
    initial,
    canCollaborateProp,
    canAssignProp,
    canEditProp,
    canCommentProp,
    canShareProp,
    accessViaShareOnlyProp,
    mentionCandidatesProp,
    shareTargetsProp,
  ]);

  const typeColor = RAID_TYPE_COLORS[raid.type] ?? "#6b7280";
  const TypeIcon = typeIcon(raid.type);
  const isDeleted = !!raid.deletedAt;
  const closed = isRaidClosed(raid.statut) || isDeleted;
  const isMine =
    currentUser.ressourceId &&
    raid.responsableRessourceId === currentUser.ressourceId;
  const unassigned = !raid.responsableRessourceId;
  const statuts = getStatutsForType(raid.type);

  const { niveauRisque, criticite: critLabel } = evaluateRaidRisque(raid);
  const actionsLiees = raid.actionsLiees ?? [];
  const warnActionsOuvertes =
    raid.type === "Risque" &&
    isRaidClosed(raid.statut) &&
    risqueAActionsLieesOuvertes(actionsLiees);
  const warnClotureStatut =
    raid.type === "Risque" &&
    isRaidClosed(newStatut) &&
    risqueAActionsLieesOuvertes(actionsLiees);

  const timeline = useMemo(() => {
    return [...raid.auditLogs].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [raid.auditLogs]);

  const auditNewestFirst = useMemo(() => {
    return [...raid.auditLogs].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [raid.auditLogs]);

  const partages = raid.partages ?? [];
  const backHref = returnTo || readRaidListReturnUrl(raid.type);
  const echeance = raidEffectiveEcheance(
    raid.date_echeance_actualisee,
    raid.date_echeance
  );
  const overdue = isRaidOverdue(
    raid.statut,
    raid.date_echeance_actualisee,
    raid.date_echeance,
    new Date(nowMs)
  );

  const mentionNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of mentionCandidates) map.set(c.id, c.nom_complet);
    for (const commentRow of raid.raidComments) {
      for (const m of commentRow.mentions ?? []) {
        if (m.ressource?.nom_complet) map.set(m.ressourceId, m.ressource.nom_complet);
      }
    }
    return map;
  }, [mentionCandidates, raid.raidComments]);

  const participants = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    const add = (name: string | null | undefined) => {
      const n = (name ?? "").trim();
      if (!n) return;
      const key = n.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(n);
    };
    add(raid.responsableRessource?.nom_complet || raid.responsable);
    for (const c of raid.raidComments) {
      if (!c.is_system) add(c.authorName);
      for (const m of c.mentions ?? []) add(m.ressource?.nom_complet);
    }
    return names;
  }, [raid]);

  const mentionQuery = useMemo(() => {
    const upto = comment.slice(0, commentCursor);
    const match = upto.match(/(^|[\s\n])@([^\n@]*)$/);
    if (!match) return null;
    const query = match[2] ?? "";
    return { start: upto.length - query.length - 1, query };
  }, [comment, commentCursor]);

  const mentionHits = useMemo(() => {
    if (mentionSuppressed || !mentionQuery) return [];
    const q = mentionQuery.query.trim().toLowerCase();
    return mentionCandidates
      .filter((c) => {
        if (!q) return true;
        return (
          c.nom_complet.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.equipeName.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [mentionQuery, mentionCandidates, mentionSuppressed]);

  function insertMention(candidate: MentionCandidate) {
    const textarea = commentRef.current;
    const cursor = textarea?.selectionStart ?? comment.length;
    const upto = comment.slice(0, cursor);
    const match = upto.match(/(^|[\s\n])@([^\n@]*)$/);
    const start = match ? upto.length - (match[2]?.length ?? 0) - 1 : cursor;
    const next = `${comment.slice(0, start)}@${candidate.nom_complet} ${comment.slice(cursor)}`;
    setComment(next);
    setMentionIds((ids) =>
      ids.includes(candidate.id) ? ids : [...ids, candidate.id]
    );
    setMentionIndex(0);
    requestAnimationFrame(() => {
      const pos = start + candidate.nom_complet.length + 2;
      textarea?.focus();
      textarea?.setSelectionRange(pos, pos);
    });
  }

  function publishComment() {
    const body = comment.trim();
    if (!body) return;
    const ids = mentionIds.filter((id) => {
      const name = mentionNames.get(id);
      return !!name && body.includes(`@${name}`);
    });
    run(async () => {
      await addRaidComment(raid.id, body, ids);
      setComment("");
      setMentionIds([]);
    });
  }

  const filteredShareTargets = shareTargets
    .filter((t) => {
      const q = shareQuery.trim().toLowerCase();
      if (!q) return true;
      const domaine = (DOMAINE_LABELS[t.domaine] ?? t.domaine).toLowerCase();
      const statut = (STATUT_CHANTIER_LABELS[t.statut] ?? t.statut).toLowerCase();
      const priorite = (
        PRIORITE_CHANTIER_LABELS[t.priorite] ?? t.priorite
      ).toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.chantierCode.toLowerCase().includes(q) ||
        t.chantierNom.toLowerCase().includes(q) ||
        (t.directeur ?? "").toLowerCase().includes(q) ||
        domaine.includes(q) ||
        statut.includes(q) ||
        priorite.includes(q)
      );
    })
    .sort((a, b) =>
      a.chantierCode.localeCompare(b.chantierCode, "fr", { numeric: true })
    );
  const pickedTargets = shareTargets.filter((t) => sharePick.includes(t.id));

  /** Reload full detail from server so UI updates without a manual browser refresh. */
  async function reloadDetail() {
    const payload = await getRaidDetail(raid.id);
    if (payload?.raid) {
      const next = JSON.parse(JSON.stringify(payload.raid)) as RaidDetail;
      setRaid(next);
      setNewStatut(next.statut);
      setAssignTo(next.responsableRessourceId ?? "__none__");
      setCanCollaborate(payload.canCollaborate);
      setCanAssign(payload.canAssign);
      setCanEdit(payload.canEdit);
      setCanComment(payload.canComment);
      setCanShare(payload.canShare);
      setAccessViaShareOnly(payload.accessViaShareOnly);
      setMentionCandidates(payload.mentionCandidates);
      setShareTargets(payload.shareTargets);
    }
    router.refresh();
  }

  function openAssignDialog() {
    setAssignTo(raid.responsableRessourceId ?? "__none__");
    setAssignQuery("");
    setAssignMode("keep");
    setAssignChantierId(null);
    setAssignCtx(null);
    setAssignCtxError(null);
    setAssignOpen(true);
    setAssignLoading(true);
    getRaidAssignmentContext(raid.id)
      .then((ctx) => setAssignCtx(ctx))
      .catch((e: unknown) =>
        setAssignCtxError(e instanceof Error ? e.message : "Erreur")
      )
      .finally(() => setAssignLoading(false));
  }

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        await reloadDetail();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const assignPeople = assignCtx?.ressources ?? [];
  const assignFiltered = assignPeople.filter((person) => {
    const q = assignQuery.trim().toLowerCase();
    if (!q) return true;
    const chantiers = person.chantiers
      .map((c) => `${c.code} ${c.nom} ${c.role}`)
      .join(" ");
    return (
      person.nom_complet.toLowerCase().includes(q) ||
      person.organisation.toLowerCase().includes(q) ||
      (person.equipeInstitutionnelle ?? "").toLowerCase().includes(q) ||
      chantiers.toLowerCase().includes(q)
    );
  });
  const selectedAssignee =
    assignTo === "__none__"
      ? null
      : (assignPeople.find((person) => person.id === assignTo) ?? null);
  const currentChantierId =
    assignCtx?.currentChantier?.id ?? raid.chantier?.id ?? null;
  const onCurrentTeam = !!(
    selectedAssignee &&
    currentChantierId &&
    selectedAssignee.chantiers.some((c) => c.id === currentChantierId)
  );
  const otherChantiers =
    selectedAssignee?.chantiers.filter((c) => c.id !== currentChantierId) ?? [];
  const showChantierChoice = !!(
    assignCtx?.restricted &&
    selectedAssignee &&
    !onCurrentTeam
  );
  const moveBlocked = !!assignCtx?.governanceLock;
  const assignSaveDisabled =
    isPending ||
    assignLoading ||
    !!assignCtxError ||
    (showChantierChoice &&
      !moveBlocked &&
      assignMode === "move" &&
      !assignChantierId);

  return (
    <div className="min-h-screen bg-background">
      {/* Light, airy header — soft BOA wash */}
      <div className="relative overflow-hidden border-b border-[#0A3C74]/10 bg-gradient-to-br from-white via-[#f4fafb] to-[#e8f7f7] dark:from-background dark:via-background dark:to-muted/40">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-24 size-72 rounded-full bg-[#00BDBB]/10 blur-3xl" />
          <div className="absolute -left-16 bottom-0 size-56 rounded-full bg-[#0A3C74]/[0.06] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#0A3C74]/15 bg-white/80 text-[#0A3C74] shadow-sm hover:bg-white hover:text-[#0A3C74]"
              onClick={() => router.push(backHref)}
            >
              <ArrowLeft className="size-4" />
              Retour
            </Button>
            <Badge
              variant="outline"
              className="font-mono text-xs font-bold tracking-wide border-[#0A3C74]/25 bg-white/90 text-[#0A3C74] shadow-sm dark:bg-card dark:text-foreground"
              title="Code RAID"
            >
              {raid.code}
            </Badge>
            <Badge
              className="gap-1.5 text-xs font-semibold shadow-sm"
              style={{ backgroundColor: typeColor, color: "white" }}
            >
              <TypeIcon className="size-3.5" />
              {RAID_TYPE_LABELS[raid.type] ?? raid.type}
            </Badge>
            <Badge
              className="text-xs font-semibold shadow-sm"
              style={{
                backgroundColor: getStatutColor(raid.type, raid.statut),
                color: "white",
              }}
            >
              {raid.statut || "Sans statut"}
            </Badge>
            {isRaidClosed(raid.statut) && (
              <Badge
                variant="secondary"
                className="text-xs bg-slate-100 text-slate-600 dark:bg-muted"
              >
                Clôturé
              </Badge>
            )}
            {isDeleted && (
              <Badge variant="destructive" className="text-xs">
                Supprimée
              </Badge>
            )}
            {unassigned && (
              <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-xs dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
                Non assigné
              </Badge>
            )}
            {isMine && (
              <Badge className="bg-teal-50 text-teal-800 border border-teal-200 text-xs gap-1 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-800">
                <UserCheck className="size-3" />
                Assigné à moi
              </Badge>
            )}
            {echeance && (
              <Badge
                className={`text-xs gap-1 ${
                  overdue
                    ? "bg-destructive text-white"
                    : "bg-white text-[#0A3C74] border border-[#0A3C74]/20"
                }`}
              >
                <Calendar className="size-3" />
                Échéance {fmtDate(echeance)}
                {overdue ? " · En retard" : ""}
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto border-[#0A3C74]/15 bg-white/80 text-[#0A3C74]"
              onClick={() => {
                const url = `${window.location.origin}/raid/${raid.id}`;
                void navigator.clipboard.writeText(url).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                });
              }}
            >
              <Link2 className="size-3.5" />
              {copied ? "Lien copié" : "Copier le lien"}
            </Button>
          </div>
          <h1 className="max-w-4xl text-2xl font-bold tracking-tight text-[#0A3C74] dark:text-foreground md:text-3xl">
            {raid.intitule}
          </h1>

          {/* Assigné (same chip style as équipe liée) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              <UserCheck className="size-3.5 text-[#00BDBB]" />
              Assigné
            </span>
            {raid.responsableRessource?.nom_complet || raid.responsable ? (
              <span
                className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-[#0A3C74]/12 bg-white/80 px-3 py-1.5 text-sm shadow-sm dark:bg-card"
                title={
                  raid.responsableRessource?.nom_complet ||
                  raid.responsable ||
                  undefined
                }
              >
                <span className="font-medium text-[#0A3C74] dark:text-foreground break-words">
                  {raid.responsableRessource?.nom_complet || raid.responsable}
                </span>
                {isMine ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-teal-500/40 text-teal-800 dark:text-teal-200"
                  >
                    Moi
                  </Badge>
                ) : null}
              </span>
            ) : (
              <span className="rounded-lg border border-dashed border-slate-300 bg-white/50 px-3 py-1.5 text-sm text-muted-foreground dark:border-muted">
                Non assigné
              </span>
            )}
          </div>

          {/* Linked team (info only) */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              <Users className="size-3.5 text-[#00BDBB]" />
              Équipe liée
            </span>
            {raid.equipe?.name ? (
              <span
                className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-[#0A3C74]/12 bg-white/80 px-3 py-1.5 text-sm shadow-sm dark:bg-card"
                title={raid.equipe.name}
              >
                <span className="font-medium text-[#0A3C74] dark:text-foreground break-words">
                  {raid.equipe.name}
                </span>
                {raid.equipe.type === "fonctionnelle" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-teal-500/40 text-teal-800 dark:text-teal-200"
                  >
                    Fonctionnelle
                  </Badge>
                ) : raid.equipe.type === "institutionnelle" ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-primary/30 text-primary"
                  >
                    Institutionnelle
                  </Badge>
                ) : null}
              </span>
            ) : (
              <span className="rounded-lg border border-dashed border-slate-300 bg-white/50 px-3 py-1.5 text-sm text-muted-foreground dark:border-muted">
                Aucune équipe liée
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              <Share2 className="size-3.5 text-[#00BDBB]" />
              Partagé avec
            </span>
            {partages.length === 0 ? (
              <span className="rounded-lg border border-dashed border-slate-300 bg-white/50 px-3 py-1.5 text-sm text-muted-foreground dark:border-muted">
                Aucune équipe
              </span>
            ) : (
              partages.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#0A3C74]/12 bg-white/80 px-2.5 py-1 text-sm shadow-sm dark:bg-card"
                >
                  <span className="font-medium text-[#0A3C74] dark:text-foreground">
                    {p.equipe.chantier
                      ? `${p.equipe.chantier.code} — ${p.equipe.chantier.nom}`
                      : p.equipe.name}
                  </span>
                  {canShare && (
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Retirer le partage"
                      onClick={() => setUnshareId(p.equipeId)}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </span>
              ))
            )}
            {canShare && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-[#00BDBB]/40 text-[#0A3C74]"
                onClick={() => {
                  setSharePick([]);
                  setShareQuery("");
                  setShareOpen(true);
                }}
              >
                <Share2 className="size-3.5" />
                Partager
              </Button>
            )}
          </div>

          {participants.length > 0 && (
            <p className="mt-2 text-xs text-slate-600 dark:text-muted-foreground">
              <span className="font-semibold uppercase tracking-wide">
                Participants
              </span>
              {" · "}
              {participants.join(" · ")}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-muted-foreground">
            {raid.chantier && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-3.5 text-[#00BDBB]" />
                <Link
                  href={`/chantiers/${raid.chantier.id}`}
                  className="font-medium text-[#0A3C74] underline-offset-2 hover:underline dark:text-foreground"
                >
                  {raid.chantier.code} — {raid.chantier.nom}
                </Link>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 text-[#00BDBB]" />
              Créé le {fmtDate(raid.createdAt)}
              {raid.createdByName ? ` par ${raid.createdByName}` : ""}
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        {accessViaShareOnly && (
          <div className="rounded-lg border border-[#00BDBB]/40 bg-[#00BDBB]/10 px-4 py-3 text-sm text-[#0A3C74] dark:text-foreground">
            Partagé avec votre équipe — consultation et discussion.
          </div>
        )}
        {error && (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}
        {isDeleted && (
          <div
            className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Entrée supprimée
              {raid.deletedAt
                ? ` le ${format(new Date(raid.deletedAt), "dd/MM/yyyy", { locale: fr })}`
                : ""}
              {raid.deletedByName ? ` par ${raid.deletedByName}` : ""}
              {raid.deleteMotif ? ` — ${raid.deleteMotif}` : ""}.
              Elle n&apos;apparaît plus dans les listes actives.
            </p>
          </div>
        )}
        {warnActionsOuvertes && (
          <div
            className="flex gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p>
              Attention : des actions liées ne sont pas encore clôturées.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="space-y-6 lg:col-span-2">
            <Card className="overflow-hidden border-0 shadow-md ring-1 ring-black/5 dark:ring-white/10">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-base">Description</CardTitle>
                <CardDescription>
                  Contexte et détail de l&apos;élément
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {raid.description?.trim() || (
                    <span className="italic text-muted-foreground">
                      Aucune description.
                    </span>
                  )}
                </p>
                <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-sm">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Note de suivi
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {raid.commentaires?.trim() || (
                      <span className="italic text-muted-foreground">
                        Aucune note. Elle se saisit dans le formulaire de modification.
                      </span>
                    )}
                  </p>
                </div>
                {raid.type === "Risque" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Probabilité
                      </p>
                      <p className="mt-1 font-medium">
                        {raid.probabilite
                          ? PROBABILITE_LABELS[raid.probabilite] ??
                            raid.probabilite
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Impact
                      </p>
                      <p className="mt-1 font-medium">
                        {raid.impact
                          ? IMPACT_LABELS[raid.impact] ?? raid.impact
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Niveau de risque
                      </p>
                      <p className="mt-1 font-medium">{niveauRisque ?? "—"}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Calculé automatiquement — non modifiable
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Niveau de maîtrise
                      </p>
                      <p className="mt-1 font-medium">
                        {raid.niveau_maitrise?.trim() || "—"}
                      </p>
                    </div>
                    {critLabel && (
                      <div className="rounded-lg border bg-muted/20 p-3 sm:col-span-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Criticité
                        </p>
                        <Badge
                          className="mt-1"
                          style={{
                            backgroundColor:
                              CRITICITE_COLORS[critLabel] ?? "#6b7280",
                            color: CRITICITE_FG,
                          }}
                        >
                          {critLabel}
                        </Badge>
                      </div>
                    )}
                    {raid.strategie && (
                      <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3 text-sm">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Stratégie
                        </p>
                        <p className="mt-1">{raid.strategie}</p>
                      </div>
                    )}
                    {raid.mitigation && (
                      <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-3 text-sm">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Mitigation
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">
                          {raid.mitigation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {raid.type === "Action" && raid.risqueLie ? (
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Risque lié
                    </p>
                    <Link
                      href={`/raid/${raid.risqueLie.id}`}
                      className="mt-1 inline-block font-medium text-primary hover:underline"
                    >
                      {formatRisqueLienLabel(
                        raid.risqueLie.code,
                        raid.risqueLie.intitule
                      )}
                    </Link>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {raid.type === "Risque" ? (
              <Card className="overflow-hidden border-0 shadow-md ring-1 ring-black/5 dark:ring-white/10">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-base">Actions liées</CardTitle>
                  <CardDescription>
                    Actions du RAID rattachées à ce risque
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {actionsLiees.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      Aucune action liée.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {actionsLiees.map((a) => (
                        <li key={a.id} className="px-3 py-2.5">
                          <Link
                            href={`/raid/${a.id}`}
                            className="font-mono text-xs font-semibold text-[#0A3C74] hover:underline dark:text-foreground"
                          >
                            {a.code}
                          </Link>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">
                            {a.description?.trim() || (
                              <span className="italic text-muted-foreground">
                                {a.intitule}
                              </span>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* Comments */}
            <Card className="border-0 shadow-md ring-1 ring-black/5 dark:ring-white/10">
              <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-primary" />
                  <CardTitle className="text-base">
                    Conversation
                  </CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {raid.raidComments.length}
                  </Badge>
                </div>
                <CardDescription>
                  Discussion de l&apos;équipe. Un message ne vous assigne pas
                  l&apos;entrée. Tapez @ pour mentionner quelqu&apos;un.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {raid.raidComments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucun message pour le moment. Lancez la discussion.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {raid.raidComments.map((c) => {
                      const mine =
                        (!!c.authorUserId &&
                          c.authorUserId === currentUser.userId) ||
                        (!!c.authorRessourceId &&
                          c.authorRessourceId === currentUser.ressourceId);
                      if (c.is_system) {
                        const statusLog = raid.auditLogs.find(
                          (log) =>
                            log.action === "status_changed" &&
                            Math.abs(
                              new Date(log.createdAt).getTime() -
                                new Date(c.createdAt).getTime()
                            ) < 8000
                        );
                        return (
                          <li key={c.id} className="flex justify-center">
                            <div className="max-w-xl rounded-full border border-teal-500/25 bg-teal-500/5 px-4 py-2 text-center text-xs text-muted-foreground">
                              <p className="font-medium text-foreground">
                                {statusLog
                                  ? `Statut : « ${statusLog.oldValue || "—"} » → « ${statusLog.newValue || "—"} »`
                                  : "Changement de statut"}
                                {" · "}
                                {c.authorName || "—"}
                                {" · "}
                                {fmt(c.createdAt)}
                              </p>
                              {c.body?.trim() ? (
                                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
                                  {c.body}
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      }
                      const authorTeam = mentionCandidates.find(
                        (m) => m.id === c.authorRessourceId
                      )?.equipeName;
                      return (
                        <li
                          key={c.id}
                          className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
                        >
                          <UserAvatar
                            name={c.authorName || "?"}
                            size="sm"
                            color={mine ? "#00BDBB" : "#0A3C74"}
                          />
                          <div
                            className={`max-w-[85%] rounded-xl border px-4 py-3 ${
                              mine
                                ? "border-[#0A3C74]/15 bg-[#0A3C74]/5"
                                : "bg-card"
                            }`}
                          >
                            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {c.authorName || "—"}
                              </span>
                              {authorTeam ? (
                                <>
                                  <span>·</span>
                                  <span>{authorTeam}</span>
                                </>
                              ) : null}
                              <span>·</span>
                              <span>{fmt(c.createdAt)}</span>
                            </div>
                            <MentionBody
                              body={c.body}
                              names={mentionNames}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {canComment && (
                  <div className="relative space-y-2 border-t pt-4">
                    <label className="text-sm font-medium" htmlFor="raid-comment">
                      Écrire un message
                    </label>
                    {mentionHits.length > 0 && (
                      <ul className="absolute bottom-full z-20 mb-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
                        {mentionHits.map((c, i) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className={`flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-sm ${
                                i === mentionIndex
                                  ? "bg-accent"
                                  : "hover:bg-accent/60"
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                insertMention(c);
                              }}
                            >
                              <span className="font-medium">
                                {c.nom_complet}
                                {!c.hasAccount ? (
                                  <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                                    pas de compte — pas de notification
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {[c.role, c.equipeName].filter(Boolean).join(" · ") ||
                                  "Équipe"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <textarea
                      id="raid-comment"
                      ref={commentRef}
                      className="flex min-h-[88px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                      placeholder="Écrire un message… @ pour mentionner"
                      value={comment}
                      disabled={isPending}
                      onChange={(e) => {
                        setComment(e.target.value);
                        setCommentCursor(e.target.selectionStart ?? 0);
                        setMentionIndex(0);
                        setMentionSuppressed(false);
                      }}
                      onSelect={(e) =>
                        setCommentCursor(
                          (e.target as HTMLTextAreaElement).selectionStart ?? 0
                        )
                      }
                      onKeyDown={(e) => {
                        if (mentionHits.length > 0) {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setMentionIndex((i) =>
                              Math.min(i + 1, mentionHits.length - 1)
                            );
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setMentionIndex((i) => Math.max(i - 1, 0));
                            return;
                          }
                          if (e.key === "Enter" || e.key === "Tab") {
                            e.preventDefault();
                            const pick = mentionHits[mentionIndex] ?? mentionHits[0];
                            if (pick) insertMention(pick);
                            return;
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setMentionSuppressed(true);
                            return;
                          }
                        }
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (!isPending && comment.trim()) publishComment();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Entrée envoie · Maj+Entrée saute une ligne
                      </p>
                      <Button
                        size="sm"
                        disabled={isPending || !comment.trim()}
                        onClick={publishComment}
                      >
                        {isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                        Publier
                      </Button>
                    </div>
                  </div>
                )}
                {!canComment && (
                  <p className="text-xs text-muted-foreground">
                    Vous pouvez consulter cette entrée. La discussion est ouverte
                    à l&apos;équipe responsable et aux équipes avec lesquelles
                    elle est partagée.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar actions */}
          <div className="space-y-4">
            <Card className="border-0 shadow-md ring-1 ring-black/5 dark:ring-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {canEdit && (
                  <Button
                    className="justify-start gap-2"
                    style={{ backgroundColor: "#0A3C74" }}
                    disabled={isPending}
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="size-4" />
                    Modifier
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => setCirculationOpen(true)}
                >
                  <GitBranch className="size-4 text-primary" />
                  Voir la circulation
                </Button>
                {canCollaborate && (
                  <Button
                    className="justify-start gap-2"
                    style={{ backgroundColor: "#0A3C74" }}
                    disabled={isPending || closed}
                    onClick={() => {
                      setNewStatut(raid.statut);
                      setStatusComment("");
                      setStatusOpen(true);
                    }}
                  >
                    <CircleDot className="size-4" />
                    Changer le statut
                  </Button>
                )}
                {canAssign && (
                  <Button
                    variant="secondary"
                    className="justify-start gap-2"
                    disabled={isPending || closed}
                    onClick={openAssignDialog}
                  >
                    <UserPlus className="size-4" />
                    Assigner / Réassigner
                  </Button>
                )}
                {canCollaborate && (
                  <Button
                    variant="outline"
                    className="justify-start gap-2 border-teal-600/40 text-teal-800 dark:text-teal-300"
                    disabled={
                      isPending ||
                      closed ||
                      (!!raid.responsableRessourceId && !canAssign) ||
                      !!isMine
                    }
                    onClick={() =>
                      run(async () => {
                        await autoAssignRaidToMe(raid.id);
                      })
                    }
                    title={
                      raid.responsableRessourceId && !isMine && !canAssign
                        ? "Déjà assigné — réaffectation réservée Admin / Bureau Programme / DC-PMO"
                        : undefined
                    }
                  >
                    <Sparkles className="size-4" />
                    M&apos;auto-assigner
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md ring-1 ring-black/5 dark:ring-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Métadonnées
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <MetaRow label="Catégorie" value={raid.categorie || "—"} />
                <MetaRow label="Domaine" value={raid.domaine || "—"} />
                <MetaRow
                  label="Identification"
                  value={fmtDate(raid.date_identification)}
                />
                <MetaRow
                  label="Révision"
                  value={fmtDate(raid.date_revision)}
                />
                <MetaRow
                  label="Échéance initiale"
                  value={fmtDate(raid.date_echeance)}
                />
                <MetaRow
                  label="Échéance actualisée"
                  value={fmtDate(
                    raid.date_echeance_actualisee ?? raid.date_echeance
                  )}
                />
                {raid.date_fin_reelle && (
                  <MetaRow
                    label="Fin réelle"
                    value={fmtDate(raid.date_fin_reelle)}
                  />
                )}
                <MetaRow
                  label="Dernière MAJ"
                  value={fmt(raid.updatedAt)}
                />
              </CardContent>
            </Card>

            {unassigned && canCollaborate && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
                <p className="font-semibold flex items-center gap-2">
                  <Shield className="size-4" />
                  Non assigné
                </p>
                <p className="mt-1 text-xs opacity-90">
                  Un changement de statut vous auto-assignera cette entrée.
                  Les commentaires ne le font pas. La réaffectation manuelle
                  est réservée à l&apos;Admin, au Bureau Programme, ou au
                  Directeur / Suppléant / PMO du chantier.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Audit trail — card list (no horizontal scroll, text wraps) */}
        <Card className="border-0 shadow-md ring-1 ring-black/5 dark:ring-white/10">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-wrap items-center gap-2">
              <History className="size-4 shrink-0 text-primary" />
              <CardTitle className="text-base">Journal d&apos;audit</CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                {auditNewestFirst.length} événement(s)
              </Badge>
            </div>
            <CardDescription>
              {auditNewestFirst[0]
                ? `Dernier événement : ${auditNewestFirst[0].summary}`
                : "Historique immuable de toutes les modifications"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-3"
              onClick={() => setAuditOpen((v) => !v)}
            >
              <ChevronDown
                className={`size-4 transition-transform ${auditOpen ? "rotate-180" : ""}`}
              />
              {auditOpen ? "Masquer le journal" : "Afficher le journal"}
            </Button>
            {!auditOpen ? null : auditNewestFirst.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucun événement enregistré.
              </p>
            ) : (
              <ul className="space-y-3">
                {auditNewestFirst.map((log) => {
                  const hasDiff =
                    (log.oldValue && log.oldValue !== "—") ||
                    (log.newValue && log.newValue !== "—");
                  return (
                    <li
                      key={log.id}
                      className="rounded-xl border bg-card px-3 py-3 shadow-sm sm:px-4"
                    >
                      <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
                        <Badge
                          className="shrink-0 text-[10px] font-medium"
                          style={{
                            backgroundColor: actionColor(log.action),
                            color: "white",
                          }}
                        >
                          {actionLabel(log.action)}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {fmt(log.createdAt)}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-semibold text-foreground break-words">
                          {log.actorName || "—"}
                        </span>
                        {log.field ? (
                          <Badge
                            variant="outline"
                            className="max-w-full break-all text-[10px] font-normal"
                          >
                            {RAID_AUDIT_FIELD_LABELS[log.field] ?? log.field}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground/90">
                        {log.summary}
                      </p>

                      {hasDiff ? (
                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          <div className="min-w-0 rounded-lg border border-dashed bg-muted/30 px-2.5 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Avant
                            </p>
                            <p className="mt-0.5 text-xs leading-snug break-words whitespace-pre-wrap text-muted-foreground">
                              {log.oldValue?.trim() || "—"}
                            </p>
                          </div>
                          <div className="min-w-0 rounded-lg border border-primary/15 bg-primary/5 px-2.5 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                              Après
                            </p>
                            <p className="mt-0.5 text-xs leading-snug break-words whitespace-pre-wrap text-foreground">
                              {log.newValue?.trim() || "—"}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      {canEdit && (
        <RaidFormDialog
          open={editOpen}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) void reloadDetail();
          }}
          raid={{
            id: raid.id,
            code: raid.code,
            type: raid.type,
            intitule: raid.intitule,
            description: raid.description,
            categorie: raid.categorie,
            chantierId: raid.chantier?.id ?? null,
            domaine: raid.domaine,
            probabilite: raid.probabilite,
            impact: raid.impact,
            niveau_maitrise: raid.niveau_maitrise,
            strategie: raid.strategie,
            mitigation: raid.mitigation,
            responsable: raid.responsable,
            responsableRessourceId: raid.responsableRessourceId,
            statut: raid.statut,
            date_identification: raid.date_identification
              ? new Date(raid.date_identification)
              : null,
            date_revision: raid.date_revision
              ? new Date(raid.date_revision)
              : null,
            date_echeance: raid.date_echeance
              ? new Date(raid.date_echeance)
              : null,
            date_echeance_actualisee: raid.date_echeance_actualisee
              ? new Date(raid.date_echeance_actualisee)
              : null,
            date_fin_reelle: raid.date_fin_reelle
              ? new Date(raid.date_fin_reelle)
              : null,
            commentaires: raid.commentaires,
            comiteId: raid.comite?.id ?? raid.comiteId ?? null,
            risqueLieId: raid.risqueLie?.id ?? raid.risqueLieId ?? null,
            risqueLie: raid.risqueLie,
            actionsLiees: raid.actionsLiees,
          }}
          statusConfigs={statusConfigs}
          fieldOptions={fieldOptions}
        />
      )}

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="flex max-h-[min(920px,92vh)] w-[min(96vw,76rem)] max-w-[min(96vw,76rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[76rem]">
          <div className="relative shrink-0 overflow-hidden border-b bg-gradient-to-br from-white via-[#f4fafb] to-[#e8f7f7] px-5 py-4 sm:px-6 sm:py-5 dark:from-background dark:via-background dark:to-muted/40">
            <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#00BDBB]/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 size-40 rounded-full bg-[#0A3C74]/10 blur-3xl" />
            <DialogHeader className="relative space-y-1.5 pr-8 text-left">
              <DialogTitle className="text-lg leading-snug text-[#0A3C74] sm:text-xl dark:text-foreground">
                Partager avec une équipe chantier
              </DialogTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Choisissez un ou plusieurs chantiers. Leur équipe pourra
                consulter ce RAID et participer à la discussion. L&apos;assigné
                et l&apos;équipe liée restent inchangés.
              </p>
            </DialogHeader>
            <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={shareQuery}
                  onChange={(e) => setShareQuery(e.target.value)}
                  placeholder="Code, nom, domaine, directeur, priorité ou statut…"
                  className="h-10 bg-white/90 pl-9 dark:bg-card"
                />
              </div>
              <p className="shrink-0 text-xs font-medium text-slate-600 dark:text-muted-foreground">
                {filteredShareTargets.length} chantier
                {filteredShareTargets.length > 1 ? "s" : ""}
                {sharePick.length > 0
                  ? ` · ${sharePick.length} sélectionné${sharePick.length > 1 ? "s" : ""}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f8fb] px-6 py-5 dark:bg-muted/20">
            {filteredShareTargets.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 text-center">
                <Building2 className="size-8 text-[#00BDBB]" />
                <p className="mt-3 text-sm font-medium">
                  Aucun chantier à proposer
                </p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  {shareQuery.trim()
                    ? "Aucun chantier ne correspond à cette recherche."
                    : "Toutes les équipes fonctionnelles sont déjà liées ou partagées."}
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {filteredShareTargets.map((t) => {
                  const checked = sharePick.includes(t.id);
                  const domaine = DOMAINE_LABELS[t.domaine] ?? t.domaine;
                  const statut = STATUT_CHANTIER_LABELS[t.statut] ?? t.statut;
                  const priorite =
                    PRIORITE_CHANTIER_LABELS[t.priorite] ?? t.priorite;
                  const accent = DOMAINE_COLORS[t.domaine] ?? "#0A3C74";
                  const progress = Math.max(0, Math.min(100, t.avancement || 0));
                  const debutDate = t.dateDebut ? new Date(t.dateDebut) : null;
                  const finDate = t.dateFin ? new Date(t.dateFin) : null;
                  const debut =
                    debutDate && !Number.isNaN(debutDate.getTime())
                      ? format(debutDate, "dd MMM yyyy", { locale: fr })
                      : "";
                  const fin =
                    finDate && !Number.isNaN(finDate.getTime())
                      ? format(finDate, "dd MMM yyyy", { locale: fr })
                      : "";
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        aria-pressed={checked}
                        onClick={() =>
                          setSharePick((ids) =>
                            checked
                              ? ids.filter((id) => id !== t.id)
                              : [...ids, t.id]
                          )
                        }
                        className={`group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                          checked
                            ? "border-[#00BDBB] ring-2 ring-[#00BDBB]/35"
                            : "border-[#0A3C74]/10 hover:border-[#0A3C74]/30"
                        }`}
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${accent}18, transparent 46%)`,
                        }}
                      >
                        <span
                          className="absolute inset-y-0 left-0 w-1.5"
                          style={{ backgroundColor: accent }}
                        />
                        <span className="flex items-start gap-3 px-4 pt-4 pl-5">
                          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-[#0A3C74] px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-white">
                              {t.chantierCode}
                            </span>
                            {statut ? (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{
                                  backgroundColor:
                                    STATUT_CHANTIER_COLORS[t.statut] ??
                                    "#6b7280",
                                }}
                              >
                                {statut}
                              </span>
                            ) : null}
                            {priorite ? (
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                                style={{
                                  backgroundColor:
                                    PRIORITE_CHANTIER_COLORS[t.priorite] ??
                                    "#6b7280",
                                }}
                              >
                                {priorite}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              checked
                                ? "border-[#00BDBB] bg-[#00BDBB] text-white"
                                : "border-slate-300 bg-white/90 text-transparent group-hover:border-[#00BDBB]/60 dark:bg-card"
                            }`}
                          >
                            <Check className="size-4" />
                          </span>
                        </span>
                        <span className="mt-2.5 block px-4 pl-5 text-[15px] font-semibold leading-snug text-[#0A3C74] dark:text-foreground">
                          {t.chantierNom}
                        </span>
                        <span className="mt-1.5 flex items-center gap-1.5 px-4 pl-5 text-xs text-muted-foreground">
                          <span
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: accent }}
                          />
                          <span className="truncate">
                            {domaine || "Domaine non renseigné"}
                          </span>
                        </span>
                        <span className="mt-3 space-y-1.5 px-4 pb-3 pl-5 text-xs text-slate-600 dark:text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Crown className="size-3.5 shrink-0 text-[#0A3C74] dark:text-[#00BDBB]" />
                            <span className="truncate">
                              {t.directeur || "Directeur non renseigné"}
                            </span>
                          </span>
                          {debut && fin ? (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="size-3.5 shrink-0 text-[#00BDBB]" />
                              <span>
                                {debut} → {fin}
                              </span>
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-auto flex items-center gap-3 border-t border-[#0A3C74]/10 bg-white/70 px-4 py-2.5 pl-5 text-[11px] text-muted-foreground dark:bg-muted/30">
                          <span className="inline-flex min-w-0 flex-1 items-center gap-2">
                            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-muted">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${progress}%`,
                                  backgroundColor:
                                    STATUT_CHANTIER_COLORS[t.statut] ?? "#0A3C74",
                                }}
                              />
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-[#0A3C74] dark:text-foreground">
                              {progress}%
                            </span>
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#00BDBB]/10 px-2 py-0.5 font-medium text-[#0A3C74] dark:text-foreground">
                            <Users className="size-3.5 text-[#00BDBB]" />
                            {t.membres} {t.membres === 1 ? "membre" : "membres"}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 flex-col items-stretch gap-3 border-t bg-card px-5 py-3 sm:flex-col sm:items-stretch sm:justify-start sm:px-6 sm:py-4">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {pickedTargets.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  Aucun chantier sélectionné
                </span>
              ) : (
                pickedTargets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#0A3C74]/15 bg-[#0A3C74]/5 px-2 py-0.5 text-[11px] font-medium text-[#0A3C74] dark:text-foreground"
                    onClick={() =>
                      setSharePick((ids) => ids.filter((id) => id !== t.id))
                    }
                    title="Retirer de la sélection"
                  >
                    <span className="truncate">
                      {t.chantierCode} — {t.chantierNom}
                    </span>
                    <X className="size-3 shrink-0" />
                  </button>
                ))
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2">
              <Button variant="outline" onClick={() => setShareOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={isPending || sharePick.length === 0}
                style={{ backgroundColor: "#0A3C74" }}
                onClick={() =>
                  run(async () => {
                    await shareRaidWithEquipes(raid.id, sharePick);
                    setShareOpen(false);
                    setSharePick([]);
                  })
                }
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Partager
                {sharePick.length > 0 ? ` (${sharePick.length})` : ""}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!unshareId}
        onOpenChange={(open) => !open && setUnshareId(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Retirer le partage</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            L&apos;équipe ne verra plus ce RAID dans « RAID partagés avec moi »
            et ne pourra plus le commenter par ce partage.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnshareId(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !unshareId}
              onClick={() => {
                const equipeId = unshareId;
                if (!equipeId) return;
                run(async () => {
                  await unshareRaidEquipe(raid.id, equipeId);
                  setUnshareId(null);
                });
              }}
            >
              Retirer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Changer le statut</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Nouveau statut</label>
              <Select value={newStatut} onValueChange={setNewStatut}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuts.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">
                Commentaire <span className="text-destructive">*</span>
              </label>
              <textarea
                className="flex min-h-[90px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                placeholder="Motif du changement de statut (obligatoire)…"
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Obligatoire — sera visible dans la conversation et le journal.
              </p>
            </div>
            {warnClotureStatut ? (
              <div
                className="flex gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
                role="status"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p>
                  Attention : des actions liées ne sont pas encore clôturées.
                  Vous pouvez quand même clôturer ce risque.
                </p>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={isPending || !statusComment.trim()}
              onClick={() =>
                run(async () => {
                  await changeRaidStatus(raid.id, newStatut, statusComment);
                  setStatusOpen(false);
                  setStatusComment("");
                })
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="flex max-h-[min(920px,92vh)] w-[min(96vw,72rem)] max-w-[min(96vw,72rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[72rem]">
          <div className="relative shrink-0 overflow-hidden border-b bg-gradient-to-br from-white via-[#f4fafb] to-[#e8f7f7] px-5 py-4 sm:px-6 sm:py-5 dark:from-background dark:via-background dark:to-muted/40">
            <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[#00BDBB]/15 blur-3xl" />
            <DialogHeader className="relative space-y-1.5 pr-8 text-left">
              <DialogTitle className="text-lg leading-snug text-[#0A3C74] sm:text-xl dark:text-foreground">
                Assigner / réassigner l&apos;entrée
              </DialogTitle>
              <p className="max-w-3xl text-sm text-muted-foreground">
                {assignCtx?.restricted
                  ? "Choisissez la ressource. Si elle n'est pas dans l'équipe du chantier, vous indiquez si le RAID y reste — équipe institutionnelle — ou s'il rejoint un de ses chantiers."
                  : "Le chantier de l'entrée reste celui-ci. L'équipe liée devient l'équipe du chantier si la personne en est membre, sinon son équipe institutionnelle."}
              </p>
            </DialogHeader>
            <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={assignQuery}
                  onChange={(e) => setAssignQuery(e.target.value)}
                  placeholder="Nom, organisation, équipe ou chantier…"
                  className="h-10 bg-white/90 pl-9 dark:bg-card"
                />
              </div>
              <p className="shrink-0 text-xs font-medium text-slate-600 dark:text-muted-foreground">
                {assignLoading
                  ? "Chargement…"
                  : `${assignFiltered.length} ressource${assignFiltered.length > 1 ? "s" : ""}`}
                {raid.chantier ? ` · ${raid.chantier.code}` : ""}
              </p>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f8fb] px-5 py-4 sm:px-6 dark:bg-muted/20">
            {assignCtxError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {assignCtxError}
              </div>
            ) : assignLoading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-[#00BDBB]" />
                Chargement des équipes…
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <li className="lg:col-span-2">
                  <button
                    type="button"
                    aria-pressed={assignTo === "__none__"}
                    onClick={() => {
                      setAssignTo("__none__");
                      setAssignMode("keep");
                      setAssignChantierId(null);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                      assignTo === "__none__"
                        ? "border-[#00BDBB] bg-card ring-2 ring-[#00BDBB]/35"
                        : "border-[#0A3C74]/10 bg-card hover:border-[#0A3C74]/30"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-[#0A3C74] dark:text-foreground">
                        Non assigné
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Retire le responsable et l&apos;équipe liée. Le chantier
                        ne change pas.
                      </span>
                    </span>
                    <span
                      className={`flex size-7 items-center justify-center rounded-full border ${
                        assignTo === "__none__"
                          ? "border-[#00BDBB] bg-[#00BDBB] text-white"
                          : "border-slate-300 text-transparent"
                      }`}
                    >
                      <Check className="size-4" />
                    </span>
                  </button>
                </li>
                {assignFiltered.map((person) => {
                  const selected = assignTo === person.id;
                  const memberHere = !!(
                    currentChantierId &&
                    person.chantiers.some((c) => c.id === currentChantierId)
                  );
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setAssignTo(person.id);
                          setAssignMode("keep");
                          setAssignChantierId(null);
                        }}
                        className={`flex h-full w-full flex-col rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                          selected
                            ? "border-[#00BDBB] ring-2 ring-[#00BDBB]/35"
                            : "border-[#0A3C74]/10 hover:border-[#0A3C74]/30"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold leading-snug text-[#0A3C74] dark:text-foreground">
                            {person.nom_complet}
                          </span>
                          <span
                            className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                              selected
                                ? "border-[#00BDBB] bg-[#00BDBB] text-white"
                                : "border-slate-300 text-transparent"
                            }`}
                          >
                            <Check className="size-3.5" />
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {person.organisation || "Organisation non renseignée"}
                        </span>
                        <span className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-muted-foreground">
                          <Building2 className="size-3.5 shrink-0 text-[#0A3C74] dark:text-[#00BDBB]" />
                          <span className="truncate">
                            {person.equipeInstitutionnelle ||
                              "Aucune équipe institutionnelle"}
                          </span>
                        </span>
                        <span className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-600 dark:text-muted-foreground">
                          <Users className="size-3.5 shrink-0 text-[#00BDBB]" />
                          <span>
                            {memberHere
                              ? "Membre de ce chantier"
                              : person.chantiers.length === 0
                                ? "Aucun chantier"
                                : `${person.chantiers.length} chantier${person.chantiers.length > 1 ? "s" : ""}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedAssignee && assignCtx && !assignLoading ? (
            <div className="max-h-[38vh] shrink-0 overflow-y-auto border-t bg-card px-5 py-3 sm:px-6">
              {onCurrentTeam ? (
                <p className="text-sm text-slate-700 dark:text-muted-foreground">
                  <span className="font-semibold text-[#0A3C74] dark:text-foreground">
                    {selectedAssignee.nom_complet}
                  </span>{" "}
                  est membre de{" "}
                  {assignCtx.currentChantier
                    ? `${assignCtx.currentChantier.code} — ${assignCtx.currentChantier.nom}`
                    : "ce chantier"}
                  . L&apos;équipe fonctionnelle du chantier est conservée.
                </p>
              ) : !assignCtx.restricted ? (
                <p className="text-sm text-slate-700 dark:text-muted-foreground">
                  Le chantier reste{" "}
                  <span className="font-semibold text-[#0A3C74] dark:text-foreground">
                    {assignCtx.currentChantier
                      ? `${assignCtx.currentChantier.code} — ${assignCtx.currentChantier.nom}`
                      : "inchangé"}
                  </span>
                  . Équipe liée :{" "}
                  {selectedAssignee.equipeInstitutionnelle
                    ? `équipe institutionnelle « ${selectedAssignee.equipeInstitutionnelle} »`
                    : "aucune équipe institutionnelle"}
                  .
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#00BDBB]">
                    Rattachement
                  </p>
                  <div className="grid gap-2 lg:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={assignMode === "keep"}
                      onClick={() => {
                        setAssignMode("keep");
                        setAssignChantierId(null);
                      }}
                      className={`rounded-xl border p-3 text-left ${
                        assignMode === "keep"
                          ? "border-[#0A3C74] bg-[#0A3C74]/5 ring-2 ring-[#0A3C74]/20"
                          : "border-border hover:border-[#0A3C74]/30"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-[#0A3C74] dark:text-foreground">
                        Maintenir le chantier actuel
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {assignCtx.currentChantier
                          ? `${assignCtx.currentChantier.code} — ${assignCtx.currentChantier.nom}. `
                          : "Aucun chantier. "}
                        {selectedAssignee.equipeInstitutionnelle
                          ? `Équipe institutionnelle « ${selectedAssignee.equipeInstitutionnelle} ».`
                          : "Aucune équipe institutionnelle ne sera liée."}
                      </span>
                    </button>
                    <div
                      className={`rounded-xl border p-3 ${
                        moveBlocked
                          ? "border-amber-500/40 bg-amber-500/10"
                          : assignMode === "move"
                            ? "border-[#00BDBB] bg-[#00BDBB]/5 ring-2 ring-[#00BDBB]/25"
                            : "border-border"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={moveBlocked || otherChantiers.length === 0}
                        aria-pressed={assignMode === "move"}
                        onClick={() => setAssignMode("move")}
                        className="w-full text-left disabled:cursor-not-allowed"
                      >
                        <span className="block text-sm font-semibold text-[#0A3C74] dark:text-foreground">
                          Affecter à un autre chantier
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {moveBlocked
                            ? `Indisponible : ce RAID vient du comité de gouvernance${assignCtx.governanceLabel ? ` « ${assignCtx.governanceLabel} »` : ""}.`
                            : otherChantiers.length === 0
                              ? "Cette personne n'est membre d'aucun autre chantier."
                              : "L'équipe liée devient l'équipe fonctionnelle du chantier choisi."}
                        </span>
                      </button>
                      {assignMode === "move" && !moveBlocked ? (
                        <ul className="mt-3 grid gap-2">
                          {otherChantiers.map((c) => {
                            const picked = assignChantierId === c.id;
                            const accent = DOMAINE_COLORS[c.domaine] ?? "#0A3C74";
                            return (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  aria-pressed={picked}
                                  onClick={() => setAssignChantierId(c.id)}
                                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left ${
                                    picked
                                      ? "border-[#00BDBB] ring-2 ring-[#00BDBB]/30"
                                      : "border-border"
                                  }`}
                                >
                                  <span
                                    className="mt-1 size-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: accent }}
                                  />
                                  <span className="min-w-0">
                                    <span className="block text-xs font-semibold text-[#0A3C74] dark:text-foreground">
                                      {c.code} — {c.nom}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                      {c.role}
                                      {c.statut
                                        ? ` · ${STATUT_CHANTIER_LABELS[c.statut] ?? c.statut}`
                                        : ""}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter className="mx-0 mb-0 shrink-0 flex-col items-stretch gap-3 border-t bg-card px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={assignSaveDisabled}
              style={{ backgroundColor: "#0A3C74" }}
              onClick={() =>
                run(async () => {
                  await assignRaidToRessource(
                    raid.id,
                    assignTo === "__none__" ? null : assignTo,
                    showChantierChoice && assignMode === "move"
                      ? assignChantierId
                      : null
                  );
                  setAssignOpen(false);
                })
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Circulation timeline dialog */}
      <Dialog open={circulationOpen} onOpenChange={setCirculationOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="size-5 text-primary" />
              Circulation de l&apos;entrée
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Du premier jour jusqu&apos;à la clôture — qui a agi, quand, et
            pourquoi.
          </p>
          <div className="relative mt-4 pl-2">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Pas encore d&apos;événements.
              </p>
            ) : (
              <ol className="relative space-y-0 border-l-2 border-primary/25 ml-3">
                {timeline.map((ev, idx) => {
                  const isLast = idx === timeline.length - 1;
                  const color = actionColor(ev.action);
                  return (
                    <li key={ev.id} className="relative pb-8 last:pb-0 pl-6">
                      <span
                        className="absolute -left-[9px] top-1 flex size-4 items-center justify-center rounded-full ring-4 ring-background"
                        style={{ backgroundColor: color }}
                      />
                      <div
                        className={`rounded-xl border bg-card p-3 shadow-sm ${
                          isLast ? "ring-1 ring-primary/20" : ""
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className="text-[10px]"
                            style={{ backgroundColor: color, color: "white" }}
                          >
                            {actionLabel(ev.action)}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {fmt(ev.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium leading-snug">
                          {ev.summary}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Par{" "}
                          <span className="font-semibold text-foreground/80">
                            {ev.actorName || "—"}
                          </span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCirculationOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MentionBody({
  body,
  names,
}: {
  body: string;
  names: Map<string, string>;
}) {
  const parts = parseMentionBody(body);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, index) =>
        part.type === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <Link
            key={index}
            href={`/ressources/${part.ressourceId}`}
            className="font-semibold text-[#0A3C74] underline-offset-2 hover:underline dark:text-[#5ad4d2]"
          >
            @{names.get(part.ressourceId) ?? "personne"}
          </Link>
        )
      )}
    </p>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
