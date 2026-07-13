"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  getStatutColor,
  getStatutsForType,
  getCriticiteLabel,
  CRITICITE_COLORS,
  PROBABILITE_LABELS,
  IMPACT_LABELS,
} from "@/lib/raid-labels";
import { scoreCriticite } from "@/lib/utils-pmo";
import { isRaidClosed } from "@/lib/raid-labels";
import {
  addRaidComment,
  changeRaidStatus,
  assignRaidToRessource,
  autoAssignRaidToMe,
  getRaidDetail,
} from "@/app/(app)/raid/[id]/actions";

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

type Comment = {
  id: string;
  body: string;
  is_system: boolean;
  authorName: string;
  createdAt: Date | string;
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
  strategie: string;
  mitigation: string;
  responsable: string;
  responsableRessourceId: string | null;
  statut: string;
  date_identification: Date | string | null;
  date_revision: Date | string | null;
  date_echeance: Date | string | null;
  commentaires: string;
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
  raidComments: Comment[];
  auditLogs: AuditLog[];
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
  };
  return map[action] ?? action;
}

export function RaidDetailClient({
  raid: initial,
  canCollaborate,
  canAssign = false,
  currentUser,
  ressources,
}: {
  raid: RaidDetail;
  canCollaborate: boolean;
  /** Admin / Bureau Programme / Directeur-Suppléant-PMO chantier */
  canAssign?: boolean;
  currentUser: {
    userId: string;
    ressourceId: string | null;
    displayName: string;
  };
  ressources: RessourceOption[];
}) {
  const router = useRouter();
  const [raid, setRaid] = useState(initial);
  const [comment, setComment] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatut, setNewStatut] = useState(raid.statut);
  const [statusComment, setStatusComment] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTo, setAssignTo] = useState(
    raid.responsableRessourceId ?? "__none__"
  );
  const [circulationOpen, setCirculationOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keep local state in sync if the server page re-renders with new props
  useEffect(() => {
    setRaid(initial);
  }, [initial]);

  const typeColor = RAID_TYPE_COLORS[raid.type] ?? "#6b7280";
  const TypeIcon = typeIcon(raid.type);
  const closed = isRaidClosed(raid.statut);
  const isMine =
    currentUser.ressourceId &&
    raid.responsableRessourceId === currentUser.ressourceId;
  const unassigned = !raid.responsableRessourceId;
  const statuts = getStatutsForType(raid.type);

  const score =
    raid.probabilite && raid.impact
      ? scoreCriticite(raid.impact, raid.probabilite)
      : null;
  const critLabel = score ? getCriticiteLabel(score) : null;

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

  /** Reload full detail from server so UI updates without a manual browser refresh. */
  async function reloadDetail() {
    const payload = await getRaidDetail(raid.id);
    if (payload?.raid) {
      const next = JSON.parse(JSON.stringify(payload.raid)) as RaidDetail;
      setRaid(next);
      setNewStatut(next.statut);
      setAssignTo(next.responsableRessourceId ?? "__none__");
    }
    router.refresh();
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
              asChild
              variant="outline"
              size="sm"
              className="border-[#0A3C74]/15 bg-white/80 text-[#0A3C74] shadow-sm hover:bg-white hover:text-[#0A3C74]"
            >
              <Link href="/raid">
                <ArrowLeft className="size-4" />
                RAID
              </Link>
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
            {closed && (
              <Badge
                variant="secondary"
                className="text-xs bg-slate-100 text-slate-600 dark:bg-muted"
              >
                Clôturé
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
        {error && (
          <div
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
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
                {raid.type === "Risque" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {score != null && critLabel && (
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Criticité
                        </p>
                        <Badge
                          className="mt-1"
                          style={{
                            backgroundColor:
                              CRITICITE_COLORS[critLabel] ?? "#6b7280",
                            color: "white",
                          }}
                        >
                          {score}/25 — {critLabel}
                        </Badge>
                      </div>
                    )}
                    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Probabilité / Impact
                      </p>
                      <p className="mt-1 font-medium">
                        {raid.probabilite
                          ? PROBABILITE_LABELS[raid.probabilite] ??
                            raid.probabilite
                          : "—"}{" "}
                        /{" "}
                        {raid.impact
                          ? IMPACT_LABELS[raid.impact] ?? raid.impact
                          : "—"}
                      </p>
                    </div>
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
              </CardContent>
            </Card>

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
                  Échanges de l&apos;équipe — les commentaires n&apos;auto-assignent
                  pas l&apos;entrée
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                {raid.raidComments.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Aucun commentaire pour le moment. Lancez la discussion.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {raid.raidComments.map((c) => (
                      <li
                        key={c.id}
                        className={`rounded-xl border px-4 py-3 ${
                          c.is_system
                            ? "border-teal-500/20 bg-teal-500/5"
                            : "bg-card"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {c.authorName || "—"}
                          </span>
                          <span>·</span>
                          <span>{fmt(c.createdAt)}</span>
                          {c.is_system && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-teal-600/40 text-teal-700 dark:text-teal-300"
                            >
                              Changement de statut
                            </Badge>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {c.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {canCollaborate && (
                  <div className="space-y-2 border-t pt-4">
                    <label className="text-sm font-medium">
                      Ajouter un commentaire
                    </label>
                    <textarea
                      className="flex min-h-[88px] w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                      placeholder="Écrire un message à l'équipe…"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      disabled={isPending}
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={isPending || !comment.trim()}
                        onClick={() => {
                          const body = comment.trim();
                          run(async () => {
                            await addRaidComment(raid.id, body);
                            setComment("");
                          });
                        }}
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
                {!canCollaborate && (
                  <p className="text-xs text-muted-foreground">
                    Vous pouvez consulter cette entrée, mais vous n&apos;avez pas
                    les droits de collaboration (assignation / chantier / équipe).
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
                    onClick={() => {
                      setAssignTo(raid.responsableRessourceId ?? "__none__");
                      setAssignOpen(true);
                    }}
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
                  label="Échéance"
                  value={fmtDate(raid.date_echeance)}
                />
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
              Historique immuable de toutes les modifications
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {auditNewestFirst.length === 0 ? (
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
                            className="max-w-full break-all font-mono text-[10px] font-normal"
                          >
                            {log.field}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assigner / réassigner l&apos;entrée</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">Ressource</label>
            <Select value={assignTo} onValueChange={setAssignTo}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Non assigné</SelectItem>
                {ressources.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nom_complet}
                    {r.organisation ? ` (${r.organisation})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              L&apos;équipe liée au RAID est recalculée : équipe chantier si la
              personne est membre du chantier, sinon son équipe
              institutionnelle.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  await assignRaidToRessource(
                    raid.id,
                    assignTo === "__none__" ? null : assignTo
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
