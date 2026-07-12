"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  Clock,
  UsersRound,
  ShieldAlert,
  ClipboardList,
  Gavel,
  TrendingUp,
  Building2,
  Calendar,
  TableIcon,
  Columns3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarView, type CalendarEvent } from "@/components/calendar-view";
import { ActionKanban } from "@/components/action-kanban";
import {
  PersonalCapaciteBlock,
  type PersonalCapaciteData,
} from "@/components/personal-capacite-block";
import { PersonalSaisieBlock } from "@/components/personal-saisie-block";
import {
  STATUT_CHANTIER_LABELS,
  STATUT_CHANTIER_COLORS,
  DOMAINE_LABELS,
} from "@/lib/chantier-labels";
import {
  RAID_TYPE_LABELS,
  RAID_TYPE_COLORS,
  getStatutColor,
  type StatusConfigItem,
} from "@/lib/raid-labels";

const RAID_TYPE_ORDER = ["Action", "Risque", "Information", "Décision"] as const;

export type PersonalDashboardData = Awaited<
  ReturnType<typeof import("@/app/(app)/actions").getPersonalDashboard>
>;

function KpiTile({
  icon: Icon,
  label,
  value,
  subtitle,
  variant = "default",
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  variant?: "default" | "destructive" | "warning" | "success";
  href?: string;
}) {
  const color =
    variant === "destructive"
      ? "text-destructive"
      : variant === "warning"
        ? "text-amber-500"
        : variant === "success"
          ? "text-emerald-500"
          : "text-primary";

  const inner = (
    <Card className="h-full transition-colors hover:border-[#00BDBB]/50">
      <CardContent className="flex items-start gap-3 p-4">
        <div className={`rounded-md bg-muted p-2 ${color}`}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function MonTableauDeBordClient({
  data,
  statusConfigs = [],
  capacite = null,
  capaciteYear,
}: {
  data: PersonalDashboardData;
  statusConfigs?: StatusConfigItem[];
  capacite?: PersonalCapaciteData | null;
  capaciteYear: number;
}) {
  const [chantierFilter, setChantierFilter] = useState<string>("__all__");
  const [teamFilter, setTeamFilter] = useState<string>("__all__");
  /** Mon RAID = assigned to me; all = équipes & chantiers scope. */
  const [raidScope, setRaidScope] = useState<"mine" | "all">("mine");

  const filteredChantiers = useMemo(() => {
    let list = data.chantiers;
    if (chantierFilter !== "__all__") {
      list = list.filter((c) => c.id === chantierFilter);
    }
    // Team filter on chantier membership equipe field is chantier team role label,
    // not bank Equipe — we keep team filter for RAID/section teams only for now.
    return list;
  }, [data.chantiers, chantierFilter]);

  const monRaidCount = useMemo(
    () => data.raids.filter((r) => r.isMine).length,
    [data.raids]
  );

  const filteredRaids = useMemo(() => {
    let list = data.raids;
    if (raidScope === "mine") {
      list = list.filter((r) => r.isMine);
    }
    if (chantierFilter !== "__all__") {
      list = list.filter((r) => r.chantierId === chantierFilter);
    }
    return list;
  }, [data.raids, chantierFilter, raidScope]);

  const raidsByType = useMemo(() => {
    const map = new Map<string, typeof filteredRaids>();
    for (const t of RAID_TYPE_ORDER) map.set(t, []);
    for (const r of filteredRaids) {
      const list = map.get(r.type) ?? [];
      list.push(r);
      map.set(r.type, list);
    }
    return map;
  }, [filteredRaids]);

  const raidCalendarEvents: CalendarEvent[] = useMemo(() => {
    return filteredRaids
      .filter(
        (r) => r.date_echeance || r.date_revision || r.date_identification
      )
      .map((r) => ({
        id: r.id,
        date: new Date(
          (r.date_echeance ?? r.date_revision ?? r.date_identification)!
        ),
        label: r.intitule,
        color: RAID_TYPE_COLORS[r.type] ?? "#6b7280",
        type: r.type,
        sublabel: r.chantierCode ?? undefined,
        details: {
          Type: RAID_TYPE_LABELS[r.type] ?? r.type,
          Statut: r.statut || "",
          Catégorie: r.categorie || "",
          Domaine: r.domaine || "",
          Responsable: r.responsable || "",
          Chantier: r.chantierCode
            ? `${r.chantierCode}${r.chantierNom ? ` — ${r.chantierNom}` : ""}`
            : "",
          Échéance: r.date_echeance
            ? format(new Date(r.date_echeance), "dd MMM yyyy", { locale: fr })
            : "",
          Périmètre: r.isMine ? "M'est assigné" : "Chantier",
        },
      }));
  }, [filteredRaids]);

  const firstRaidType =
    RAID_TYPE_ORDER.find((t) => (raidsByType.get(t)?.length ?? 0) > 0) ??
    "Action";

  const filteredTemps = useMemo(() => {
    let list = data.tempsRecent;
    if (chantierFilter !== "__all__") {
      list = list.filter((t) => t.chantierId === chantierFilter);
    }
    return list;
  }, [data.tempsRecent, chantierFilter]);

  const filteredTeams = useMemo(() => {
    if (teamFilter === "__all__") return data.teams;
    return data.teams.filter((t) => t.id === teamFilter);
  }, [data.teams, teamFilter]);

  // Recalculate light KPIs when chantier filtered
  const scopedKpis = useMemo(() => {
    if (chantierFilter === "__all__") return data.kpis;
    const c = data.chantiers.find((x) => x.id === chantierFilter);
    const raids = filteredRaids;
    const mine = raids.filter((r) => r.isMine);
    const actions = mine.filter((r) => r.type === "Action");
    const open = actions.filter(
      (a) => a.statut !== "Clôturé" && a.statut !== "Abandonné"
    );
    const now = new Date();
    const overdue = open.filter(
      (a) => a.date_echeance && new Date(a.date_echeance) < now
    );
    const risks = mine.filter(
      (r) => r.type === "Risque" && r.statut !== "Clos"
    );
    return {
      ...data.kpis,
      chantiersCount: c ? 1 : 0,
      activeChantiers: c && c.statut !== "Non démarré" && c.statut !== "Clôturé" ? 1 : 0,
      avgProgress: c ? Math.round(c.avancement || 0) : 0,
      myRaidTotal: mine.length,
      myActionsOpen: open.length,
      myActionsOverdue: overdue.length,
      myRisksOpen: risks.length,
      myRisksCritical: risks.filter(
        (r) => (r.impact ?? 0) * (r.probabilite ?? 0) >= 12
      ).length,
      myDecisionsPending: mine.filter(
        (r) => r.type === "Décision" && r.statut === "En attente"
      ).length,
      hoursThisMonth: filteredTemps.reduce((s, t) => s + t.jours, 0),
    };
  }, [chantierFilter, data, filteredRaids, filteredTemps]);

  if (!data.hasRessource) {
    return (
      <div className="space-y-4">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
            Général
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Mon Tableau de bord
          </h1>
        </header>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <LayoutDashboard className="mx-auto mb-3 size-10 opacity-40" />
            <p className="font-medium text-foreground">
              Aucune ressource liée à votre compte
            </p>
            <p className="mt-1 text-sm">
              Demandez à un administrateur de rattacher votre compte à une
              ressource pour voir vos chantiers, RAID et temps.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtersActive =
    chantierFilter !== "__all__" || teamFilter !== "__all__";

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-[#0A3C74]/10 bg-gradient-to-br from-white via-white to-[#00BDBB]/[0.07] p-4 shadow-sm dark:from-card dark:via-card dark:to-[#00BDBB]/10 sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 size-36 rounded-full bg-[#00BDBB]/10 blur-2xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 left-1/3 size-28 rounded-full bg-[#0A3C74]/5 blur-2xl"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="min-w-0 shrink-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
              Général
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              Mon Tableau de bord
            </h1>
            <p className="text-sm text-muted-foreground">
              Bonjour{" "}
              <span className="font-medium text-foreground">
                {data.displayName}
              </span>{" "}
              — vue personnelle (chantiers, RAID, équipes et temps)
            </p>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-end lg:max-w-xl lg:justify-end">
            <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-[240px]">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A3C74]/70 dark:text-[#00BDBB]/90">
                <FolderKanban className="size-3.5 text-[#00BDBB]" />
                Chantier
              </label>
              <Select value={chantierFilter} onValueChange={setChantierFilter}>
                <SelectTrigger className="h-10 border-[#0A3C74]/15 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-background/80">
                  <SelectValue placeholder="Tous mes chantiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tous mes chantiers</SelectItem>
                  {data.chantiers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-[240px]">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#0A3C74]/70 dark:text-[#00BDBB]/90">
                <UsersRound className="size-3.5 text-[#00BDBB]" />
                Équipe
              </label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-10 border-[#0A3C74]/15 bg-white/80 shadow-sm backdrop-blur-sm dark:bg-background/80">
                  <SelectValue placeholder="Toutes mes équipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes mes équipes</SelectItem>
                  {data.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.kind === "hierarchie" ? " (hiérarchique)" : " (fonct.)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtersActive && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0 border-[#00BDBB]/40 text-primary hover:bg-[#00BDBB]/10"
                onClick={() => {
                  setChantierFilter("__all__");
                  setTeamFilter("__all__");
                }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <KpiTile
            icon={FolderKanban}
            label="Mes chantiers"
            value={String(scopedKpis.chantiersCount)}
            subtitle={`${scopedKpis.activeChantiers} actifs · moy. ${scopedKpis.avgProgress}%`}
            href="/chantiers"
          />
          <KpiTile
            icon={ClipboardList}
            label="Mes actions ouvertes"
            value={String(scopedKpis.myActionsOpen)}
            subtitle="RAID — mes actions"
            href="/raid/actions"
          />
          <KpiTile
            icon={Clock}
            label="Actions échues"
            value={String(scopedKpis.myActionsOverdue)}
            subtitle="Échéance dépassée"
            variant={scopedKpis.myActionsOverdue > 0 ? "destructive" : "default"}
            href="/raid/actions?overdue=true"
          />
          <KpiTile
            icon={ShieldAlert}
            label="Mes risques ouverts"
            value={String(scopedKpis.myRisksOpen)}
            subtitle={`${scopedKpis.myRisksCritical} critiques`}
            variant={scopedKpis.myRisksCritical > 0 ? "warning" : "default"}
            href="/raid/risques"
          />
          <KpiTile
            icon={Gavel}
            label="Décisions en attente"
            value={String(scopedKpis.myDecisionsPending)}
            href="/raid/decisions"
          />
          <KpiTile
            icon={TrendingUp}
            label="Charge du mois"
            value={`${scopedKpis.chargePctMonth}%`}
            subtitle={`${scopedKpis.hoursThisMonth.toFixed(1)} j / ${scopedKpis.capacityDaysMonth} j`}
            variant={
              scopedKpis.chargePctMonth > 100
                ? "destructive"
                : scopedKpis.chargePctMonth > 80
                  ? "warning"
                  : "success"
            }
            href="/saisie-temps"
          />
      </section>

      {/* Teams */}
      <section className="space-y-3">
          <div className="flex items-center gap-2">
            <UsersRound className="size-5 text-[#00BDBB]" />
            <h2 className="text-lg font-semibold">Mes équipes</h2>
          </div>
          {filteredTeams.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Aucune équipe rattachée à votre ressource.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((t) => (
                <Card key={t.id}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <Badge
                        variant="secondary"
                        className="mt-1 text-[10px]"
                      >
                        {t.kind === "hierarchie"
                          ? "Hiérarchique"
                          : "Fonctionnelle"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
      </section>

      {/* Chantiers */}
      <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderKanban className="size-5 text-[#00BDBB]" />
              <h2 className="text-lg font-semibold">Mes chantiers</h2>
            </div>
            <Link
              href="/chantiers"
              className="text-xs font-medium text-primary hover:underline"
            >
              Voir tout
            </Link>
          </div>
          {filteredChantiers.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Vous n&apos;êtes membre d&apos;aucun chantier
                {chantierFilter !== "__all__" ? " (filtre actif)" : ""}.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Nom</th>
                    <th className="px-3 py-2 font-medium">Rôle</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium">Avancement</th>
                    <th className="px-3 py-2 font-medium">Domaine</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChantiers.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Link
                          href={`/chantiers/${c.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.code}
                        </Link>
                      </td>
                      <td className="px-3 py-2 max-w-[220px] truncate">
                        {c.nom}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {c.role || "—"}
                        {c.charge_pourcentage
                          ? ` (${c.charge_pourcentage}%)`
                          : ""}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className="text-[10px] text-white"
                          style={{
                            backgroundColor:
                              STATUT_CHANTIER_COLORS[c.statut] ?? "#6b7280",
                          }}
                        >
                          {STATUT_CHANTIER_LABELS[c.statut] ?? c.statut}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {Math.round(c.avancement || 0)}%
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {DOMAINE_LABELS[c.domaine] ?? c.domaine}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      {/* RAID — same structure as /raid: type tabs + calendrier */}
      <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-[#00BDBB]" />
              <h2 className="text-lg font-semibold">
                RAID ({filteredRaids.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setRaidScope("mine")}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                raidScope === "mine"
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-primary/25 bg-background text-primary/80 hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              Mon RAID
              <span
                className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                  raidScope === "mine"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {monRaidCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRaidScope("all")}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition-all ${
                raidScope === "all"
                  ? "border-[#00BDBB] bg-[#00BDBB] text-white shadow-md shadow-[#00BDBB]/25"
                  : "border-[#00BDBB] bg-[#00BDBB]/15 text-[#0A3C74] ring-1 ring-[#00BDBB]/30 hover:bg-[#00BDBB]/25 hover:shadow-sm dark:text-[#5ad4d2]"
              }`}
            >
              RAID Équipes &amp; Chantiers
              <span
                className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  raidScope === "all"
                    ? "bg-white/25 text-white"
                    : "bg-[#00BDBB] text-white"
                }`}
              >
                {data.raids.length}
              </span>
            </button>
          </div>

          {filteredRaids.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Aucun élément RAID dans le périmètre sélectionné.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Tabs
                  defaultValue={firstRaidType}
                  key={`raid-${raidScope}-${chantierFilter}-${filteredRaids.length}`}
                  className="space-y-4"
                >
                  <TabsList className="h-auto flex-wrap gap-1 p-1">
                    {RAID_TYPE_ORDER.map((t) => {
                      const count = raidsByType.get(t)?.length ?? 0;
                      return (
                        <TabsTrigger
                          key={t}
                          value={t}
                          className="gap-2 px-3 py-1.5"
                        >
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: RAID_TYPE_COLORS[t] ?? "#6b7280",
                            }}
                          />
                          <span className="text-xs">
                            {RAID_TYPE_LABELS[t] ?? t}
                          </span>
                          <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold text-muted-foreground">
                            {count}
                          </span>
                        </TabsTrigger>
                      );
                    })}
                    <TabsTrigger
                      value="calendrier"
                      className="gap-2 px-3 py-1.5"
                    >
                      <Calendar className="size-4 text-primary" />
                      <span className="text-xs">Calendrier</span>
                    </TabsTrigger>
                  </TabsList>

                  {RAID_TYPE_ORDER.map((t) => {
                    const items = raidsByType.get(t) ?? [];
                    return (
                      <TabsContent key={t} value={t} className="space-y-3">
                        <Tabs defaultValue="table" className="space-y-3">
                          <TabsList>
                            <TabsTrigger value="table" className="gap-2">
                              <TableIcon className="size-3.5" />
                              Tableau
                              <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                {items.length}
                              </span>
                            </TabsTrigger>
                            {t === "Action" && (
                              <TabsTrigger value="kanban" className="gap-2">
                                <Columns3 className="size-3.5" />
                                Kanban
                              </TabsTrigger>
                            )}
                            <TabsTrigger
                              value="calendrier-type"
                              className="gap-2"
                            >
                              <Calendar className="size-3.5 text-primary" />
                              Calendrier
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="table">
                            {items.length === 0 ? (
                              <p className="py-8 text-center text-sm text-muted-foreground">
                                Aucun élément « {RAID_TYPE_LABELS[t] ?? t} »
                              </p>
                            ) : (
                              <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                                    <tr>
                                      <th className="px-3 py-2 font-medium">
                                        Intitulé
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Catégorie
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Statut
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Chantier
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Échéance
                                      </th>
                                      <th className="px-3 py-2 font-medium">
                                        Périmètre
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((r) => (
                                      <tr
                                        key={r.id}
                                        className="border-t hover:bg-muted/30"
                                      >
                                        <td className="px-3 py-2 max-w-[280px]">
                                          <span className="line-clamp-2 font-medium">
                                            {r.intitule}
                                          </span>
                                          {r.domaine ? (
                                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                              {r.domaine}
                                            </span>
                                          ) : null}
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {r.categorie || "—"}
                                        </td>
                                        <td className="px-3 py-2">
                                          <Badge
                                            variant="outline"
                                            className="text-[10px]"
                                            style={{
                                              borderColor: getStatutColor(
                                                r.type,
                                                r.statut
                                              ),
                                              color: getStatutColor(
                                                r.type,
                                                r.statut
                                              ),
                                            }}
                                          >
                                            {r.statut}
                                          </Badge>
                                        </td>
                                        <td className="px-3 py-2 text-muted-foreground">
                                          {r.chantierCode ?? "—"}
                                        </td>
                                        <td className="px-3 py-2 tabular-nums text-muted-foreground">
                                          {r.date_echeance
                                            ? format(
                                                new Date(r.date_echeance),
                                                "dd MMM yyyy",
                                                { locale: fr }
                                              )
                                            : "—"}
                                        </td>
                                        <td className="px-3 py-2">
                                          {r.isMine ? (
                                            <Badge className="bg-[#00BDBB]/15 text-[10px] text-[#0A3C74] hover:bg-[#00BDBB]/15">
                                              M&apos;est assigné
                                            </Badge>
                                          ) : (
                                            <span className="text-[11px] text-muted-foreground">
                                              Chantier
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </TabsContent>

                          {t === "Action" && (
                            <TabsContent value="kanban">
                              {items.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                  Aucune action à afficher en Kanban
                                </p>
                              ) : (
                                <ActionKanban
                                  items={items.map((r) => ({
                                    id: r.id,
                                    type: r.type,
                                    intitule: r.intitule,
                                    description: r.description ?? "",
                                    responsable: r.responsable ?? "",
                                    domaine: r.domaine ?? "",
                                    date_echeance: r.date_echeance,
                                    statut: r.statut,
                                    categorie: r.categorie ?? "",
                                    chantierId: r.chantierId,
                                    chantier: r.chantier,
                                    probabilite: r.probabilite,
                                    impact: r.impact,
                                    strategie: r.strategie ?? "",
                                    mitigation: r.mitigation ?? "",
                                    date_identification: r.date_identification,
                                    date_revision: r.date_revision,
                                    commentaires: r.commentaires ?? "",
                                    responsableRessourceId:
                                      r.responsableRessourceId,
                                    comiteId: r.comiteId,
                                    createdAt: r.createdAt,
                                    updatedAt: r.updatedAt,
                                  }))}
                                  statusConfigs={statusConfigs}
                                />
                              )}
                            </TabsContent>
                          )}

                          <TabsContent value="calendrier-type">
                            <CalendarView
                              events={raidCalendarEvents.filter(
                                (e) => e.type === t
                              )}
                            />
                          </TabsContent>
                        </Tabs>
                      </TabsContent>
                    );
                  })}

                  <TabsContent value="calendrier">
                    <CalendarView events={raidCalendarEvents} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
      </section>

      {/* Saisie de temps — read-only timeline (PMO enters data) */}
      <PersonalSaisieBlock
        initialData={capacite}
        initialYear={capaciteYear}
      />

      {/* Capacité — planned charge timeline */}
      <PersonalCapaciteBlock
        initialData={capacite}
        initialYear={capaciteYear}
      />
    </div>
  );
}
