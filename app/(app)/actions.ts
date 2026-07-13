"use server";

import { prisma } from "@/lib/prisma";
import { scoreCriticite } from "@/lib/utils-pmo";
import { revalidatePath } from "next/cache";
import { PHASES } from "@/lib/jalon-labels";
import {
  requireAuth,
  requireRole,
  requireChantierAccess,
  requireRaidCreateAccess,
  getUserChantierIds,
  hashPassword,
  validatePasswordComplexity,
} from "@/lib/auth";
import { getRoleByCode, resolveRaidCreateScope } from "@/lib/roles";
import {
  canDeleteRaid,
  canEditRaidForm,
  getActorDisplay,
  getRaidFormEditContext,
  getSpecialRaidCategoriesForSession,
  writeRaidAudit,
} from "@/lib/raid-collaboration";
import {
  countUnreadNotifications,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyRaidAssigned,
  notifyRaidChanged,
} from "@/lib/notifications";
import {
  ensureChantierFunctionalTeam,
  resolveRaidEquipeId,
  syncChantierFunctionalMembership,
} from "@/lib/equipe-chantier";
import { EQUIPE_TYPES } from "@/lib/equipe-types";
import { identityFromRessource } from "@/lib/ressource-user";
import { allocateNextRaidCode } from "@/lib/raid-code-server";

// ── Progress Calculation ─────────────────────────────

const PHASE_WEIGHT_KEYS: Record<string, string> = {
  "Précadrage": "poids_precadrage",
  "Cadrage":    "poids_cadrage",
  "Exécution":  "poids_execution",
  "Clôture":    "poids_cloture",
};

// Maps jalon phase names to chantier statut values
const PHASE_TO_STATUT: Record<string, string> = {
  "Précadrage": "Pré cadrage",
  "Cadrage":    "Cadrage",
  "Exécution":  "Exécution",
  "Clôture":    "Clôture",
};

async function recalculateChantierProgress(chantierId: string) {
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  const jalons = await prisma.jalon.findMany({
    where: { chantierId },
    select: { phase: true, statut: true },
  });

  let totalProgress = 0;

  // Track phase activity for auto-status
  let currentStatut = "Non démarré";

  for (const phase of PHASES) {
    const phaseJalons = jalons.filter((j) => j.phase === phase);
    if (phaseJalons.length === 0) continue;

    const weightKey = PHASE_WEIGHT_KEYS[phase];
    const weight = (settings as Record<string, unknown>)?.[weightKey] as number ?? 0;
    const completed = phaseJalons.filter((j) => j.statut === "Atteint").length;
    const hasStarted = phaseJalons.some((j) => j.statut === "En cours" || j.statut === "Atteint");
    totalProgress += (completed / phaseJalons.length) * weight;

    // Determine current phase: the latest phase with at least one jalon started
    if (hasStarted) {
      currentStatut = PHASE_TO_STATUT[phase];
    }
  }

  // "Clôturé" only when ALL jalons in Clôture phase are "Atteint"
  if (currentStatut === "Clôture") {
    const clotureJalons = jalons.filter((j) => j.phase === "Clôture");
    if (clotureJalons.length > 0 && clotureJalons.every((j) => j.statut === "Atteint")) {
      currentStatut = "Clôturé";
    }
  }

  await prisma.chantier.update({
    where: { id: chantierId },
    data: { avancement: Math.round(totalProgress), statut: currentStatut },
  });
}

// ── Read ──────────────────────────────────────────────

export async function getRaidItems(type?: string) {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (type) where.type = type;

  if (chantierIds !== "all") {
    // Visible if: on my chantiers OR assigned to me OR same institutional team
    // (RAID.equipeId = institutional team when assignee is outside chantier)
    // OR RAID.category granted via institutional team special access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const or: any[] = [];
    if (chantierIds.length > 0) {
      or.push({ chantierId: { in: chantierIds } });
    }
    if (session.ressourceId) {
      or.push({ responsableRessourceId: session.ressourceId });
      const me = await prisma.ressource.findUnique({
        where: { id: session.ressourceId },
        select: { equipeHierarchieId: true },
      });
      if (me?.equipeHierarchieId) {
        or.push({ equipeId: me.equipeHierarchieId });
      }
      const specialCats = await getSpecialRaidCategoriesForSession(session);
      if (specialCats.length > 0) {
        or.push({ categorie: { in: specialCats } });
      }
    }
    if (or.length === 0) {
      // No chantier, no resource → empty
      where.id = { in: [] };
    } else {
      where.OR = or;
    }
  }

  return prisma.raid.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { chantier: true, comite: true },
  });
}

export async function getSettings() {
  await requireAuth();
  return prisma.settings.findFirst({ where: { id: 1 } });
}

export async function getChantiers() {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  return prisma.chantier.findMany({
    where: chantierIds === "all" ? undefined : { id: { in: chantierIds } },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { raids: true } },
      raids: { select: { type: true, statut: true } },
      rmds: { include: { rmd: true } },
      membres: {
        where: { is_directeur: true },
        select: {
          ressource: { select: { nom_complet: true } },
        },
        take: 1,
      },
      jalons: {
        select: { id: true, nom: true, phase: true, statut: true, date_cible: true, date_reelle: true },
        orderBy: { date_cible: "asc" },
      },
    },
  });
}

const membreEquipeInclude = {
  ressource: {
    select: {
      id: true,
      nom_complet: true,
      organisation: true,
      type: true,
      email: true,
    },
  },
} as const;

export async function getChantierById(id: string) {
  await requireAuth();
  return prisma.chantier.findUnique({
    where: { id },
    include: {
      raids: {
        orderBy: { createdAt: "desc" },
        include: { comite: true },
      },
      rmds: { include: { rmd: true } },
      membres: {
        orderBy: [{ equipe: "asc" }, { role: "asc" }],
        include: membreEquipeInclude,
      },
      jalons: { orderBy: [{ phase: "asc" }, { ordre: "asc" }] },
      adherencesSource: {
        orderBy: { code: "asc" },
        include: {
          chantierSource: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
          chantierDependant: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
        },
      },
      adherencesDependant: {
        orderBy: { code: "asc" },
        include: {
          chantierSource: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
          chantierDependant: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
        },
      },
    },
  });
}

export async function getChantiersByIds(ids: string[]) {
  await requireAuth();
  if (ids.length === 0) return [];
  return prisma.chantier.findMany({
    where: { id: { in: ids } },
    orderBy: { code: "asc" },
    include: {
      raids: { orderBy: { createdAt: "desc" } },
      membres: {
        orderBy: [{ equipe: "asc" }, { role: "asc" }],
        include: membreEquipeInclude,
      },
      jalons: { orderBy: [{ phase: "asc" }, { ordre: "asc" }] },
      adherencesSource: {
        orderBy: { code: "asc" },
        include: {
          chantierSource: { select: { id: true, code: true, nom: true } },
          chantierDependant: { select: { id: true, code: true, nom: true } },
        },
      },
      adherencesDependant: {
        orderBy: { code: "asc" },
        include: {
          chantierSource: { select: { id: true, code: true, nom: true } },
          chantierDependant: { select: { id: true, code: true, nom: true } },
        },
      },
    },
  });
}

export async function getChantiersForSelect() {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  return prisma.chantier.findMany({
    where: chantierIds === "all" ? undefined : { id: { in: chantierIds } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, nom: true },
  });
}

/**
 * Chantiers available when creating a RAID entry (respects raid_create_scope).
 * programme → all; chantier → only teams where user is MembreEquipe; none → [].
 */
export async function getChantiersForRaidCreate() {
  const session = await requireAuth();
  const role = await getRoleByCode(session.role);
  const scope = resolveRaidCreateScope(role);

  if (scope === "none") return [];

  if (scope === "programme") {
    return prisma.chantier.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, nom: true },
    });
  }

  // Niveau Chantier
  if (!session.ressourceId) return [];
  const membres = await prisma.membreEquipe.findMany({
    where: { ressourceId: session.ressourceId },
    select: { chantierId: true },
  });
  const ids = [...new Set(membres.map((m) => m.chantierId))];
  if (ids.length === 0) return [];
  return prisma.chantier.findMany({
    where: { id: { in: ids } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, nom: true },
  });
}

export async function getComitesForSelect() {
  await requireAuth();
  return prisma.comite.findMany({
    orderBy: [{ instance: "asc" }, { date: "desc" }],
    select: { id: true, instance: true, numero: true, date: true },
  });
}

export async function getDashboardStats() {
  await requireAuth();
  const [raids, settings, chantiers, comites, consultationQuestions] = await Promise.all([
    prisma.raid.findMany({
      orderBy: { createdAt: "desc" },
      include: { chantier: true },
    }),
    getSettings(),
    prisma.chantier.findMany({
      include: { _count: { select: { raids: true } } },
    }),
    prisma.comite.findMany(),
    prisma.consultationQuestion.findMany(),
  ]);

  const actions = raids.filter((r) => r.type === "Action");
  const risks = raids.filter((r) => r.type === "Risque");
  const decisions = raids.filter((r) => r.type === "Décision");
  const informations = raids.filter((r) => r.type === "Information");

  const seuil = settings?.seuil_relance_jours ?? 3;
  const now = new Date();

  const activeActions = actions.filter((a) => a.statut !== "Clôturé" && a.statut !== "Abandonné");
  const totalActions = activeActions.length;
  const totalRisks = risks.filter((r) => r.statut !== "Clos").length;
  // Chantiers Actifs KPI: started (any statut except "Non démarré") / total portfolio
  const totalChantiers = chantiers.length;
  const activeChantiers = chantiers.filter((c) => c.statut !== "Non démarré").length;

  const criticalRisksList = risks.filter(
    (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 12
  );

  // Actions échues: active actions with date_echeance in the past
  const overdueActionsList = activeActions.filter(
    (a) => a.date_echeance && a.date_echeance < now
  );

  // New KPIs
  const pendingDecisions = decisions.filter((d) => d.statut === "En attente").length;
  const upcomingComites = comites.filter((c) => c.date >= now).length;
  const totalBudget = chantiers
    .filter((c) => c.statut !== "Clôturé")
    .reduce((sum, c) => sum + c.budgetTotalMAD, 0);
  const closedActions = actions.filter((a) => a.statut === "Clôturé").length;
  const actionCloseRate = actions.length > 0 ? Math.round((closedActions / actions.length) * 100) : 0;

  // Chart data: statuts actions
  const statusCounts: Record<string, number> = {};
  for (const a of actions) {
    statusCounts[a.statut] = (statusCounts[a.statut] ?? 0) + 1;
  }

  // Chart data: chantiers par domaine
  const domaineCounts: Record<string, number> = {};
  for (const c of chantiers) {
    domaineCounts[c.domaine] = (domaineCounts[c.domaine] ?? 0) + 1;
  }

  // Chart data: chantiers par priorité
  const prioriteCounts: Record<string, number> = {};
  for (const c of chantiers) {
    if (c.priorite) {
      prioriteCounts[c.priorite] = (prioriteCounts[c.priorite] ?? 0) + 1;
    }
  }

  // Chart data: chantiers par statut
  const chantierStatutCounts: Record<string, number> = {};
  for (const c of chantiers) {
    chantierStatutCounts[c.statut] = (chantierStatutCounts[c.statut] ?? 0) + 1;
  }

  // Chart data: RAID par type
  const raidTypeCounts: Record<string, number> = {};
  for (const r of raids) {
    raidTypeCounts[r.type] = (raidTypeCounts[r.type] ?? 0) + 1;
  }

  // Chart data: risk matrix (5x5 grid)
  const riskMatrix: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const r of risks) {
    if (r.probabilite && r.impact && r.statut !== "Clos") {
      riskMatrix[r.probabilite - 1][r.impact - 1]++;
    }
  }

  // Chart data: overdue actions by domaine
  const overdueByDomaine: Record<string, number> = {};
  for (const a of overdueActionsList) {
    const dom = a.domaine || "Non défini";
    overdueByDomaine[dom] = (overdueByDomaine[dom] ?? 0) + 1;
  }

  // Chart data: budget par domaine
  const budgetByDomaine: Record<string, number> = {};
  for (const c of chantiers) {
    if (c.statut !== "Clôturé") {
      budgetByDomaine[c.domaine] = (budgetByDomaine[c.domaine] ?? 0) + c.budgetTotalMAD;
    }
  }

  // Chart data: timeline chantiers (sorted by priorité)
  const PRIORITE_ORDER: Record<string, number> = {
    "Fondations techniques": 1,
    "Briques transverses EI": 2,
    "Briques Satellite EI": 3,
    "Dépendante de EI": 4,
    "Indépendante de EI": 5,
    "Pilotage Transformation": 6,
  };
  const chantierTimeline = chantiers
    .filter((c) => c.statut !== "Clôturé")
    .map((c) => ({
      id: c.id,
      code: c.code,
      nom: c.nom,
      domaine: c.domaine,
      priorite: c.priorite,
      statut: c.statut,
      date_debut: c.date_debut,
      date_fin: c.date_fin,
    }))
    .sort((a, b) => {
      const pOrd = (PRIORITE_ORDER[a.priorite] ?? 99) - (PRIORITE_ORDER[b.priorite] ?? 99);
      if (pOrd !== 0) return pOrd;
      return a.code.localeCompare(b.code);
    });

  // ── Advanced Analytics ──────────────────────────────

  // Burndown: actions created vs closed by month (last 12 months)
  const burndownMap = new Map<string, { created: number; closed: number }>();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  for (const a of actions) {
    const created = new Date(a.createdAt);
    if (created >= twelveMonthsAgo) {
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      const entry = burndownMap.get(key) ?? { created: 0, closed: 0 };
      entry.created++;
      burndownMap.set(key, entry);
    }
    if (a.statut === "Clôturé") {
      const updated = new Date(a.updatedAt);
      if (updated >= twelveMonthsAgo) {
        const key = `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, "0")}`;
        const entry = burndownMap.get(key) ?? { created: 0, closed: 0 };
        entry.closed++;
        burndownMap.set(key, entry);
      }
    }
  }
  const burndownData = Array.from(burndownMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  // Risk evolution: average score by month
  const riskEvoMap = new Map<string, { total: number; count: number }>();
  for (const r of risks) {
    if (r.probabilite && r.impact) {
      const created = new Date(r.createdAt);
      if (created >= twelveMonthsAgo) {
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
        const entry = riskEvoMap.get(key) ?? { total: 0, count: 0 };
        entry.total += scoreCriticite(r.impact, r.probabilite);
        entry.count++;
        riskEvoMap.set(key, entry);
      }
    }
  }
  const riskEvolutionData = Array.from(riskEvoMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({ month, avgScore: Math.round((d.total / d.count) * 10) / 10, count: d.count }));

  // Workload per responsable (active RAID items)
  const workloadMap = new Map<string, number>();
  for (const r of raids) {
    if (r.responsable && !["Clôturé", "Abandonné", "Clos"].includes(r.statut)) {
      workloadMap.set(r.responsable, (workloadMap.get(r.responsable) ?? 0) + 1);
    }
  }
  const workloadData = Array.from(workloadMap.entries())
    .map(([responsable, count]) => ({ responsable, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Domaine health
  const healthMap = new Map<string, { overdueActions: number; openRisks: number; budget: number }>();
  for (const a of overdueActionsList) {
    const dom = a.domaine || "Non défini";
    const entry = healthMap.get(dom) ?? { overdueActions: 0, openRisks: 0, budget: 0 };
    entry.overdueActions++;
    healthMap.set(dom, entry);
  }
  for (const r of risks) {
    if (r.statut !== "Clos") {
      const dom = r.domaine || "Non défini";
      const entry = healthMap.get(dom) ?? { overdueActions: 0, openRisks: 0, budget: 0 };
      entry.openRisks++;
      healthMap.set(dom, entry);
    }
  }
  for (const c of chantiers) {
    if (c.statut !== "Clôturé") {
      const entry = healthMap.get(c.domaine) ?? { overdueActions: 0, openRisks: 0, budget: 0 };
      entry.budget += c.budget;
      healthMap.set(c.domaine, entry);
    }
  }
  const maxBudget = Math.max(...Array.from(healthMap.values()).map((h) => h.budget), 1);
  const healthData = Array.from(healthMap.entries())
    .map(([domaine, d]) => ({
      domaine,
      overdueActions: d.overdueActions,
      openRisks: d.openRisks,
      budgetPct: Math.round((d.budget / maxBudget) * 100),
    }))
    .filter((d) => d.overdueActions > 0 || d.openRisks > 0 || d.budgetPct > 0)
    .sort((a, b) => (b.overdueActions + b.openRisks) - (a.overdueActions + a.openRisks));

  // ── New KPIs ───────────────────────────────────────
  const activeChantiersList = chantiers.filter((c) => c.statut !== "Clôturé" && c.statut !== "Non démarré");
  const averageProgress = activeChantiersList.length > 0
    ? Math.round(activeChantiersList.reduce((sum, c) => sum + c.avancement, 0) / activeChantiersList.length)
    : 0;

  const untreatedInformations = informations.filter((i) => i.statut === "Ouvert").length;

  const criticalQABacklog = consultationQuestions.filter(
    (q) => q.statut === "Ouverte" && q.priorite === "Critique"
  ).length;

  const openRisks = risks.filter((r) => r.statut !== "Clos");
  const risksWithMitigation = openRisks.filter(
    (r) => r.mitigation && r.mitigation.trim() !== ""
  ).length;
  const riskMitigationRate = openRisks.length > 0
    ? Math.round((risksWithMitigation / openRisks.length) * 100)
    : 0;

  // ── New Chart Data ────────────────────────────────
  // Decision timeline by month (last 12 months)
  const decisionTimelineMap = new Map<string, { pending: number; validated: number; refused: number; postponed: number }>();
  for (const d of decisions) {
    const created = new Date(d.createdAt);
    if (created >= twelveMonthsAgo) {
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      const entry = decisionTimelineMap.get(key) ?? { pending: 0, validated: 0, refused: 0, postponed: 0 };
      if (d.statut === "En attente") entry.pending++;
      else if (d.statut === "Validée") entry.validated++;
      else if (d.statut === "Refusée") entry.refused++;
      else if (d.statut === "Reportée") entry.postponed++;
      decisionTimelineMap.set(key, entry);
    }
  }
  const decisionTimelineData = Array.from(decisionTimelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  // Action completion rate by domaine
  const actionCompletionMap = new Map<string, { total: number; closed: number }>();
  for (const a of actions) {
    const dom = a.domaine || "Non défini";
    const entry = actionCompletionMap.get(dom) ?? { total: 0, closed: 0 };
    entry.total++;
    if (a.statut === "Clôturé") entry.closed++;
    actionCompletionMap.set(dom, entry);
  }
  const actionCompletionByDomaine = Array.from(actionCompletionMap.entries())
    .map(([domaine, d]) => ({
      domaine,
      rate: d.total > 0 ? Math.round((d.closed / d.total) * 100) : 0,
      total: d.total,
      closed: d.closed,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    raids,
    actions,
    risks,
    chantiers,
    totalActions,
    totalRisks,
    totalChantiers,
    activeChantiers,
    criticalRisks: criticalRisksList.length,
    criticalRisksList,
    overdueActions: overdueActionsList.length,
    overdueActionsList,
    pendingDecisions,
    upcomingComites,
    totalBudget,
    actionCloseRate,
    averageProgress,
    untreatedInformations,
    criticalQABacklog,
    riskMitigationRate,
    statusCounts,
    domaineCounts,
    prioriteCounts,
    chantierStatutCounts,
    raidTypeCounts,
    riskMatrix,
    overdueByDomaine,
    budgetByDomaine,
    chantierTimeline,
    seuil,
    burndownData,
    riskEvolutionData,
    workloadData,
    healthData,
    decisionTimelineData,
    actionCompletionByDomaine,
  };
}

export async function getDashboardPMO() {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  const chantierScope = chantierIds === "all" ? {} : { chantierId: { in: chantierIds } };

  const [raids, chantiers, settings] = await Promise.all([
    prisma.raid.findMany({
      where: chantierIds === "all" ? undefined : chantierScope,
      orderBy: { createdAt: "desc" },
      include: { chantier: true },
    }),
    prisma.chantier.findMany({
      where: chantierIds === "all" ? undefined : { id: { in: chantierIds } },
    }),
    getSettings(),
  ]);

  // Also get ALL chantiers for the timeline (user request: "display timeline of all chantiers")
  const allChantiers = await prisma.chantier.findMany();

  const actions = raids.filter((r) => r.type === "Action");
  const risks = raids.filter((r) => r.type === "Risque");
  const decisions = raids.filter((r) => r.type === "Décision");

  const now = new Date();
  const activeActions = actions.filter((a) => a.statut !== "Clôturé" && a.statut !== "Abandonné");

  // ── KPIs ──
  const totalActions = activeActions.length;
  const totalRisks = risks.filter((r) => r.statut !== "Clos").length;
  const totalChantiers = chantiers.filter((c) => c.statut !== "Clôturé").length;
  const overdueActionsList = activeActions.filter((a) => a.date_echeance && a.date_echeance < now);
  const criticalRisksList = risks.filter(
    (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 12
  );
  const closedActions = actions.filter((a) => a.statut === "Clôturé").length;
  const actionCloseRate = actions.length > 0 ? Math.round((closedActions / actions.length) * 100) : 0;
  const pendingDecisions = decisions.filter((d) => d.statut === "En attente").length;

  // ── Chart: Statuts Actions (pie) ──
  const statusCounts: Record<string, number> = {};
  for (const a of actions) {
    statusCounts[a.statut] = (statusCounts[a.statut] ?? 0) + 1;
  }

  // ── Chart: RAID par Type (pie) ──
  const raidTypeCounts: Record<string, number> = {};
  for (const r of raids) {
    raidTypeCounts[r.type] = (raidTypeCounts[r.type] ?? 0) + 1;
  }

  // ── Chart: Matrice des Risques (5x5) ──
  const riskMatrix: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  for (const r of risks) {
    if (r.probabilite && r.impact && r.statut !== "Clos") {
      riskMatrix[r.probabilite - 1][r.impact - 1]++;
    }
  }

  // ── Chart: Actions échues par domaine ──
  const overdueByDomaine: Record<string, number> = {};
  for (const a of overdueActionsList) {
    const dom = a.chantier?.domaine || a.domaine || "Non défini";
    overdueByDomaine[dom] = (overdueByDomaine[dom] ?? 0) + 1;
  }

  // ── Chart: Burndown actions (12 months) ──
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const burndownMap = new Map<string, { created: number; closed: number }>();
  for (const a of actions) {
    const created = new Date(a.createdAt);
    if (created >= twelveMonthsAgo) {
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      const entry = burndownMap.get(key) ?? { created: 0, closed: 0 };
      entry.created++;
      burndownMap.set(key, entry);
    }
    if (a.statut === "Clôturé") {
      const updated = new Date(a.updatedAt);
      if (updated >= twelveMonthsAgo) {
        const key = `${updated.getFullYear()}-${String(updated.getMonth() + 1).padStart(2, "0")}`;
        const entry = burndownMap.get(key) ?? { created: 0, closed: 0 };
        entry.closed++;
        burndownMap.set(key, entry);
      }
    }
  }
  const burndownData = Array.from(burndownMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  // ── Chart: Évolution des Risques (12 months) ──
  const riskEvoMap = new Map<string, { total: number; count: number }>();
  for (const r of risks) {
    if (r.probabilite && r.impact) {
      const created = new Date(r.createdAt);
      if (created >= twelveMonthsAgo) {
        const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
        const entry = riskEvoMap.get(key) ?? { total: 0, count: 0 };
        entry.total += scoreCriticite(r.impact, r.probabilite);
        entry.count++;
        riskEvoMap.set(key, entry);
      }
    }
  }
  const riskEvolutionData = Array.from(riskEvoMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({ month, avgScore: Math.round((d.total / d.count) * 10) / 10, count: d.count }));

  // ── Chart: Tendance Décisions (12 months) ──
  const decisionTimelineMap = new Map<string, { pending: number; validated: number; refused: number; postponed: number }>();
  for (const d of decisions) {
    const created = new Date(d.createdAt);
    if (created >= twelveMonthsAgo) {
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      const entry = decisionTimelineMap.get(key) ?? { pending: 0, validated: 0, refused: 0, postponed: 0 };
      if (d.statut === "En attente") entry.pending++;
      else if (d.statut === "Validée") entry.validated++;
      else if (d.statut === "Refusée") entry.refused++;
      else if (d.statut === "Reportée") entry.postponed++;
      decisionTimelineMap.set(key, entry);
    }
  }
  const decisionTimelineData = Array.from(decisionTimelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  // ── Chart: Taux Complétion Actions par Domaine ──
  const actionCompletionMap = new Map<string, { total: number; closed: number }>();
  for (const a of actions) {
    const dom = a.chantier?.domaine || a.domaine || "Non défini";
    const entry = actionCompletionMap.get(dom) ?? { total: 0, closed: 0 };
    entry.total++;
    if (a.statut === "Clôturé") entry.closed++;
    actionCompletionMap.set(dom, entry);
  }
  const actionCompletionByDomaine = Array.from(actionCompletionMap.entries())
    .map(([domaine, d]) => ({
      domaine,
      rate: d.total > 0 ? Math.round((d.closed / d.total) * 100) : 0,
      total: d.total,
      closed: d.closed,
    }))
    .sort((a, b) => b.total - a.total);

  // ── Timeline: ALL chantiers (not just scoped ones) ──
  const PRIORITE_ORDER: Record<string, number> = {
    "Fondations techniques": 1,
    "Briques transverses EI": 2,
    "Briques Satellite EI": 3,
    "Dépendante de EI": 4,
    "Indépendante de EI": 5,
    "Pilotage Transformation": 6,
  };
  const chantierTimeline = allChantiers
    .filter((c) => c.statut !== "Clôturé")
    .map((c) => ({
      id: c.id,
      code: c.code,
      nom: c.nom,
      domaine: c.domaine,
      priorite: c.priorite,
      statut: c.statut,
      date_debut: c.date_debut,
      date_fin: c.date_fin,
      isMine: chantierIds === "all" || (chantierIds as string[]).includes(c.id),
    }))
    .sort((a, b) => {
      const pOrd = (PRIORITE_ORDER[a.priorite] ?? 99) - (PRIORITE_ORDER[b.priorite] ?? 99);
      if (pOrd !== 0) return pOrd;
      return a.code.localeCompare(b.code);
    });

  return {
    totalActions,
    totalRisks,
    totalChantiers,
    criticalRisks: criticalRisksList.length,
    overdueActions: overdueActionsList.length,
    actionCloseRate,
    pendingDecisions,
    statusCounts,
    raidTypeCounts,
    riskMatrix,
    overdueByDomaine,
    burndownData,
    riskEvolutionData,
    decisionTimelineData,
    actionCompletionByDomaine,
    chantierTimeline,
  };
}

/** RAID row for personal dashboard (table + kanban + calendar). */
export type PersonalRaidRow = {
  id: string;
  code: string;
  type: string;
  intitule: string;
  description: string;
  statut: string;
  domaine: string;
  categorie: string;
  responsable: string;
  strategie: string;
  mitigation: string;
  commentaires: string;
  date_identification: Date | null;
  date_revision: Date | null;
  date_echeance: Date | null;
  chantierId: string | null;
  chantierCode: string | null;
  chantierNom: string | null;
  chantier: { id: string; code: string; nom: string } | null;
  impact: number | null;
  probabilite: number | null;
  responsableRessourceId: string | null;
  equipeId?: string | null;
  comiteId: string | null;
  createdAt: Date;
  updatedAt: Date;
  isMine: boolean;
};

/**
 * Personal dashboard: scoped to the signed-in user's resource —
 * chantiers membership, RAID (as responsable or on their chantiers),
 * hierarchical + functional teams, and time entries.
 */
export async function getPersonalDashboard() {
  const session = await requireAuth();
  const now = new Date();

  if (!session.ressourceId) {
    return {
      hasRessource: false as const,
      displayName: session.username,
      teams: [] as {
        id: string;
        name: string;
        kind: "hierarchie" | "fonctionnelle";
      }[],
      chantiers: [] as {
        id: string;
        code: string;
        nom: string;
        domaine: string;
        priorite: string;
        statut: string;
        avancement: number;
        date_debut: Date;
        date_fin: Date;
        role: string;
        equipe: string;
        charge_pourcentage: number;
      }[],
      kpis: {
        chantiersCount: 0,
        activeChantiers: 0,
        avgProgress: 0,
        myRaidTotal: 0,
        myActionsOpen: 0,
        myActionsOverdue: 0,
        myRisksOpen: 0,
        myRisksCritical: 0,
        myDecisionsPending: 0,
        hoursThisMonth: 0,
        capacityDaysMonth: 20,
        chargePctMonth: 0,
      },
      raids: [] as PersonalRaidRow[],
      tempsRecent: [] as {
        id: string;
        date_lundi: Date;
        jours: number;
        chantierId: string;
        chantierCode: string;
        chantierNom: string;
      }[],
      raidTypeCounts: {} as Record<string, number>,
      actionStatusCounts: {} as Record<string, number>,
      tempsByChantier: [] as { code: string; nom: string; jours: number }[],
    };
  }

  const ressource = await prisma.ressource.findUnique({
    where: { id: session.ressourceId },
    include: {
      equipeHierarchie: { select: { id: true, name: true } },
      equipesFonctionnelles: {
        include: { equipe: { select: { id: true, name: true } } },
      },
      membres: {
        include: {
          chantier: {
            select: {
              id: true,
              code: true,
              nom: true,
              domaine: true,
              priorite: true,
              statut: true,
              avancement: true,
              date_debut: true,
              date_fin: true,
            },
          },
        },
      },
      user: {
        select: { first_name: true, last_name: true, username: true },
      },
    },
  });

  if (!ressource) {
    return getPersonalDashboardEmpty(session.username);
  }

  const displayName =
    ressource.nom_complet ||
    `${ressource.user?.first_name ?? ""} ${ressource.user?.last_name ?? ""}`.trim() ||
    session.username;

  const teams: {
    id: string;
    name: string;
    kind: "hierarchie" | "fonctionnelle";
  }[] = [];
  if (ressource.equipeHierarchie) {
    teams.push({
      id: ressource.equipeHierarchie.id,
      name: ressource.equipeHierarchie.name,
      kind: "hierarchie",
    });
  }
  for (const link of ressource.equipesFonctionnelles) {
    if (!teams.some((t) => t.id === link.equipe.id)) {
      teams.push({
        id: link.equipe.id,
        name: link.equipe.name,
        kind: "fonctionnelle",
      });
    }
  }

  const chantierIds = [
    ...new Set(ressource.membres.map((m) => m.chantier.id)),
  ];

  const chantiers = ressource.membres.map((m) => ({
    id: m.chantier.id,
    code: m.chantier.code,
    nom: m.chantier.nom,
    domaine: m.chantier.domaine,
    priorite: m.chantier.priorite,
    statut: m.chantier.statut,
    avancement: m.chantier.avancement,
    date_debut: m.chantier.date_debut,
    date_fin: m.chantier.date_fin,
    role: m.role,
    equipe: m.equipe,
    charge_pourcentage: m.charge_pourcentage,
  }));

  // RAID: assigned to me, on my chantiers, OR same institutional team
  // (when assignee is outside chantier → equipeId = hierarchy team)
  // OR special category grants on institutional team
  const specialCats = await getSpecialRaidCategoriesForSession(session);
  const raidsRaw = await prisma.raid.findMany({
    where: {
      OR: [
        { responsableRessourceId: session.ressourceId },
        ...(chantierIds.length > 0
          ? [{ chantierId: { in: chantierIds } }]
          : []),
        ...(ressource.equipeHierarchieId
          ? [{ equipeId: ressource.equipeHierarchieId }]
          : []),
        ...(specialCats.length > 0
          ? [{ categorie: { in: specialCats } }]
          : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      chantier: { select: { id: true, code: true, nom: true } },
    },
  });

  const raids = raidsRaw.map((r) => ({
    id: r.id,
    code: r.code,
    type: r.type,
    intitule: r.intitule,
    description: r.description,
    statut: r.statut,
    domaine: r.domaine,
    categorie: r.categorie,
    responsable: r.responsable,
    strategie: r.strategie,
    mitigation: r.mitigation,
    commentaires: r.commentaires,
    date_identification: r.date_identification,
    date_revision: r.date_revision,
    date_echeance: r.date_echeance,
    chantierId: r.chantierId,
    chantierCode: r.chantier?.code ?? null,
    chantierNom: r.chantier?.nom ?? null,
    chantier: r.chantier
      ? { id: r.chantier.id, code: r.chantier.code, nom: r.chantier.nom }
      : null,
    impact: r.impact,
    probabilite: r.probabilite,
    responsableRessourceId: r.responsableRessourceId,
    equipeId: r.equipeId,
    comiteId: r.comiteId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    isMine: r.responsableRessourceId === session.ressourceId,
  }));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const saisies = await prisma.saisieTemps.findMany({
    where: {
      ressourceId: session.ressourceId,
      date_lundi: { gte: new Date(now.getFullYear(), now.getMonth() - 2, 1) },
    },
    include: {
      chantier: { select: { id: true, code: true, nom: true } },
    },
    orderBy: { date_lundi: "desc" },
  });

  const tempsRecent = saisies.slice(0, 20).map((s) => ({
    id: s.id,
    date_lundi: s.date_lundi,
    jours: s.jours_travailles ?? 0,
    chantierId: s.chantierId,
    chantierCode: s.chantier.code,
    chantierNom: s.chantier.nom,
  }));

  const hoursThisMonth = saisies
    .filter((s) => s.date_lundi >= monthStart && s.date_lundi <= monthEnd)
    .reduce((sum, s) => sum + (s.jours_travailles ?? 0), 0);

  const capacityDaysMonth = ressource.capacite_jours_mois || 20;
  const chargePctMonth =
    capacityDaysMonth > 0
      ? Math.round((hoursThisMonth / capacityDaysMonth) * 100)
      : 0;

  const myRaids = raids.filter((r) => r.isMine);
  const myActions = myRaids.filter((r) => r.type === "Action");
  const myActionsOpen = myActions.filter(
    (a) => a.statut !== "Clôturé" && a.statut !== "Abandonné"
  );
  const myActionsOverdue = myActionsOpen.filter(
    (a) => a.date_echeance && a.date_echeance < now
  );
  const myRisks = myRaids.filter((r) => r.type === "Risque");
  const myRisksOpen = myRisks.filter((r) => r.statut !== "Clos");
  const myRisksCritical = myRisksOpen.filter(
    (r) =>
      r.probabilite &&
      r.impact &&
      scoreCriticite(r.impact, r.probabilite) >= 12
  );
  const myDecisionsPending = myRaids.filter(
    (r) => r.type === "Décision" && r.statut === "En attente"
  ).length;

  const activeChantiers = chantiers.filter(
    (c) => c.statut !== "Non démarré" && c.statut !== "Clôturé"
  ).length;
  const avgProgress =
    chantiers.length > 0
      ? Math.round(
          chantiers.reduce((s, c) => s + (c.avancement || 0), 0) /
            chantiers.length
        )
      : 0;

  const raidTypeCounts: Record<string, number> = {};
  for (const r of raids) {
    raidTypeCounts[r.type] = (raidTypeCounts[r.type] ?? 0) + 1;
  }
  const actionStatusCounts: Record<string, number> = {};
  for (const a of myActions) {
    actionStatusCounts[a.statut] = (actionStatusCounts[a.statut] ?? 0) + 1;
  }

  const tempsMap = new Map<string, { code: string; nom: string; jours: number }>();
  for (const t of tempsRecent) {
    const cur = tempsMap.get(t.chantierId) ?? {
      code: t.chantierCode,
      nom: t.chantierNom,
      jours: 0,
    };
    cur.jours += t.jours;
    tempsMap.set(t.chantierId, cur);
  }
  const tempsByChantier = Array.from(tempsMap.values()).sort(
    (a, b) => b.jours - a.jours
  );

  return {
    hasRessource: true as const,
    displayName,
    teams,
    chantiers,
    kpis: {
      chantiersCount: chantiers.length,
      activeChantiers,
      avgProgress,
      myRaidTotal: myRaids.length,
      myActionsOpen: myActionsOpen.length,
      myActionsOverdue: myActionsOverdue.length,
      myRisksOpen: myRisksOpen.length,
      myRisksCritical: myRisksCritical.length,
      myDecisionsPending,
      hoursThisMonth,
      capacityDaysMonth,
      chargePctMonth,
    },
    raids,
    tempsRecent,
    raidTypeCounts,
    actionStatusCounts,
    tempsByChantier,
  };
}

function getPersonalDashboardEmpty(username: string) {
  return {
    hasRessource: false as const,
    displayName: username,
    teams: [] as {
      id: string;
      name: string;
      kind: "hierarchie" | "fonctionnelle";
    }[],
    chantiers: [] as {
      id: string;
      code: string;
      nom: string;
      domaine: string;
      priorite: string;
      statut: string;
      avancement: number;
      date_debut: Date;
      date_fin: Date;
      role: string;
      equipe: string;
      charge_pourcentage: number;
    }[],
    kpis: {
      chantiersCount: 0,
      activeChantiers: 0,
      avgProgress: 0,
      myRaidTotal: 0,
      myActionsOpen: 0,
      myActionsOverdue: 0,
      myRisksOpen: 0,
      myRisksCritical: 0,
      myDecisionsPending: 0,
      hoursThisMonth: 0,
      capacityDaysMonth: 20,
      chargePctMonth: 0,
    },
    raids: [] as PersonalRaidRow[],
    tempsRecent: [] as {
      id: string;
      date_lundi: Date;
      jours: number;
      chantierId: string;
      chantierCode: string;
      chantierNom: string;
    }[],
    raidTypeCounts: {} as Record<string, number>,
    actionStatusCounts: {} as Record<string, number>,
    tempsByChantier: [] as { code: string; nom: string; jours: number }[],
  };
}

/** Computed operational alerts (overdue actions, critical Q&A) — not stored. */
export async function getAlerts() {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  const chantierScope = chantierIds === "all" ? {} : { chantierId: { in: chantierIds } };
  const now = new Date();
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  const seuilQaHeures = settings?.seuil_qa_critique_heures ?? 48;

  const [actions, criticalQuestions] = await Promise.all([
    prisma.raid.findMany({
      where: {
        ...chantierScope,
        type: "Action",
        statut: { notIn: ["Clôturé", "Abandonné"] },
        date_echeance: { lt: now },
      },
      orderBy: { date_echeance: "asc" },
      include: { chantier: { select: { code: true, nom: true } } },
    }),
    prisma.consultationQuestion.findMany({
      where: {
        ...chantierScope,
        priorite: "Critique",
        statut: "Ouverte",
        createdAt: { lt: new Date(now.getTime() - seuilQaHeures * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "asc" },
      include: { chantier: { select: { code: true, nom: true } } },
    }),
  ]);

  const actionAlerts = actions.map((a) => ({
    id: a.id,
    type: "action_echue" as const,
    message: `Action échue : ${a.intitule}`,
    detail: a.chantier ? `${a.chantier.code} - ${a.chantier.nom}` : undefined,
    responsable: a.responsable,
    date: a.date_echeance,
  }));

  const qaAlerts = criticalQuestions.map((q) => ({
    id: q.id,
    type: "qa_critique_echue" as const,
    message: `Q&A critique ouverte depuis ${seuilQaHeures}h+ : ${q.question.substring(0, 60)}${q.question.length > 60 ? "…" : ""}`,
    detail: `${q.chantier.code} - ${q.chantier.nom}`,
    responsable: q.affectee_a,
    date: q.createdAt,
  }));

  return [...actionAlerts, ...qaAlerts];
}

/** Per-user persistent notifications + unread count. */
export async function getMyNotifications(opts?: { unreadOnly?: boolean }) {
  const session = await requireAuth();
  if (session.isMaintenance) {
    return { items: [] as Awaited<ReturnType<typeof listUserNotifications>>, unreadCount: 0 };
  }
  const [items, unreadCount] = await Promise.all([
    listUserNotifications(session.userId, {
      unreadOnly: opts?.unreadOnly,
      limit: 50,
    }),
    countUnreadNotifications(session.userId),
  ]);
  return { items, unreadCount };
}

export async function markMyNotificationRead(notificationId: string) {
  const session = await requireAuth();
  if (session.isMaintenance) return;
  await markNotificationRead(session.userId, notificationId);
}

export async function markAllMyNotificationsRead() {
  const session = await requireAuth();
  if (session.isMaintenance) return 0;
  return markAllNotificationsRead(session.userId);
}

// ── Chantier CRUD ────────────────────────────────────

export async function createChantier(data: {
  code: string;
  nom: string;
  description: string;
  domaine: string;
  type_chantier: string;
  priorite: string;
  duree_mois: number;
  budget: number;
  budgetJH: number;
  budgetProjetMAD: number;
  conseilEditeursMAD: number;
  licencesAchatsMAD: number;
  licencesAbonnementsMAD: number;
  coutsInfrasMAD: number;
  budgetTotalMAD: number;
  directeur: string;
  pmo: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  avancement: number;
  rmdIds?: string[];
}) {
  const session = await requireAuth();
  // Only rôles with périmètre données chantiers = « tous les chantiers »
  if (session.role !== "Admin") {
    const role = await getRoleByCode(session.role);
    if (!role?.is_active || role.chantier_scope !== "all") {
      throw new Error(
        "Création de chantier non autorisée : réservée aux rôles avec le périmètre « tous les chantiers »."
      );
    }
  }
  const created = await prisma.chantier.create({
    data: {
      code: data.code,
      nom: data.nom,
      description: data.description,
      domaine: data.domaine,
      type_chantier: data.type_chantier,
      priorite: data.priorite,
      duree_mois: data.duree_mois,
      budget: data.budget,
      budgetJH: data.budgetJH,
      budgetProjetMAD: data.budgetProjetMAD,
      conseilEditeursMAD: data.conseilEditeursMAD,
      licencesAchatsMAD: data.licencesAchatsMAD,
      licencesAbonnementsMAD: data.licencesAbonnementsMAD,
      coutsInfrasMAD: data.coutsInfrasMAD,
      budgetTotalMAD: data.budgetTotalMAD,
      directeur: data.directeur,
      pmo: data.pmo,
      date_debut: new Date(data.date_debut),
      date_fin: new Date(data.date_fin),
      statut: data.statut,
      avancement: data.avancement,
      rmds: data.rmdIds?.length
        ? { create: data.rmdIds.map((rmdId) => ({ rmdId })) }
        : undefined,
    },
  });
  // Auto-create functional (programme) team for the chantier
  await ensureChantierFunctionalTeam(created.id);
  revalidatePath("/");
  revalidatePath("/chantiers");
  revalidatePath("/admin/equipes");
}

export async function updateChantier(
  id: string,
  data: {
    code: string;
    nom: string;
    description: string;
    domaine: string;
    type_chantier: string;
    priorite: string;
    duree_mois: number;
    budget: number;
    budgetJH: number;
    budgetProjetMAD: number;
    conseilEditeursMAD: number;
    licencesAchatsMAD: number;
    licencesAbonnementsMAD: number;
    coutsInfrasMAD: number;
    budgetTotalMAD: number;
    directeur: string;
    pmo: string;
    date_debut: string;
    date_fin: string;
    statut: string;
    avancement: number;
    rmdIds?: string[];
  }
) {
  await requireChantierAccess(id);
  await prisma.$transaction(async (tx) => {
    await tx.chantier.update({
      where: { id },
      data: {
        code: data.code,
        nom: data.nom,
        description: data.description,
        domaine: data.domaine,
        type_chantier: data.type_chantier,
        priorite: data.priorite,
        duree_mois: data.duree_mois,
        budget: data.budget,
        budgetJH: data.budgetJH,
        budgetProjetMAD: data.budgetProjetMAD,
        conseilEditeursMAD: data.conseilEditeursMAD,
        licencesAchatsMAD: data.licencesAchatsMAD,
        licencesAbonnementsMAD: data.licencesAbonnementsMAD,
        coutsInfrasMAD: data.coutsInfrasMAD,
        budgetTotalMAD: data.budgetTotalMAD,
        directeur: data.directeur,
        pmo: data.pmo,
        date_debut: new Date(data.date_debut),
        date_fin: new Date(data.date_fin),
        statut: data.statut,
        avancement: data.avancement,
      },
    });
    if (data.rmdIds !== undefined) {
      await tx.chantierRmd.deleteMany({ where: { chantierId: id } });
      if (data.rmdIds.length > 0) {
        await tx.chantierRmd.createMany({
          data: data.rmdIds.map((rmdId) => ({ chantierId: id, rmdId })),
        });
      }
    }
  });
  // Keep functional team label in sync with code/nom
  await ensureChantierFunctionalTeam(id);
  revalidatePath("/");
  revalidatePath("/chantiers");
  revalidatePath(`/chantiers/${id}`);
  revalidatePath("/admin/equipes");
}

export async function deleteChantier(id: string) {
  await requireRole("Admin", "Programme_Office");
  const counts = await prisma.chantier.findUnique({
    where: { id },
    include: { _count: { select: { raids: true } } },
  });
  if (counts && counts._count.raids > 0) {
    throw new Error(
      `Impossible de supprimer : ${counts._count.raids} élément(s) RAID lié(s).`
    );
  }
  await prisma.chantier.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/chantiers");
}

// ── Favoris ─────────────────────────────────────────

export async function getFavoris(): Promise<string[]> {
  await requireAuth();
  const rows = await prisma.favoriChantier.findMany({ select: { chantierId: true } });
  return rows.map((r) => r.chantierId);
}

export async function toggleFavori(chantierId: string): Promise<boolean> {
  await requireAuth();
  const existing = await prisma.favoriChantier.findUnique({ where: { chantierId } });
  if (existing) {
    await prisma.favoriChantier.delete({ where: { chantierId } });
    revalidatePath("/");
    revalidatePath("/chantiers");
    revalidatePath("/favoris");
    return false;
  }
  await prisma.favoriChantier.create({ data: { chantierId } });
  revalidatePath("/");
  revalidatePath("/chantiers");
  revalidatePath("/favoris");
  return true;
}

export async function getChantiersFavoris() {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  const favIds = await getFavoris();
  if (favIds.length === 0) return [];
  // Intersect favorites with accessible chantiers
  const allowedFavIds = chantierIds === "all" ? favIds : favIds.filter((id) => chantierIds.includes(id));
  if (allowedFavIds.length === 0) return [];
  return prisma.chantier.findMany({
    where: { id: { in: allowedFavIds } },
    orderBy: { code: "asc" },
    include: {
      _count: { select: { raids: true } },
      raids: { select: { type: true, statut: true } },
      rmds: { include: { rmd: true } },
      membres: {
        where: { is_directeur: true },
        select: {
          ressource: { select: { nom_complet: true } },
        },
        take: 1,
      },
      jalons: {
        select: { id: true, nom: true, phase: true, statut: true, date_cible: true, date_reelle: true },
        orderBy: { date_cible: "asc" },
      },
    },
  });
}

// ── RAID CRUD ────────────────────────────────────────

export async function createRaid(data: {
  type: string;
  intitule: string;
  description: string;
  categorie: string;
  chantierId: string | null;
  domaine: string;
  probabilite: number | null;
  impact: number | null;
  strategie: string;
  mitigation: string;
  responsable: string;
  responsableRessourceId: string | null;
  statut: string;
  date_identification: string | null;
  date_revision: string | null;
  date_echeance: string | null;
  commentaires: string;
  comiteId: string | null;
}) {
  // Permission driven by AppRole.raid_create_scope (not legacy role list)
  const session = await requireRaidCreateAccess(data.chantierId);
  const actor = await getActorDisplay(session);
  const teamAssign = await resolveRaidEquipeId({
    responsableRessourceId: data.responsableRessourceId || null,
    chantierId: data.chantierId || null,
  });
  const code = await allocateNextRaidCode(data.type);
  const created = await prisma.raid.create({
    data: {
      code,
      type: data.type,
      intitule: data.intitule,
      description: data.description,
      categorie: data.categorie,
      chantierId: data.chantierId || null,
      domaine: data.domaine,
      probabilite: data.probabilite,
      impact: data.impact,
      strategie: data.strategie,
      mitigation: data.mitigation,
      responsable: data.responsable,
      responsableRessourceId: data.responsableRessourceId || null,
      equipeId: teamAssign.equipeId,
      statut: data.statut,
      date_identification: data.date_identification ? new Date(data.date_identification) : null,
      date_revision: data.date_revision ? new Date(data.date_revision) : null,
      date_echeance: data.date_echeance ? new Date(data.date_echeance) : null,
      commentaires: data.commentaires,
      comiteId: data.comiteId || null,
      createdByUserId: actor.actorUserId,
      createdByName: actor.actorName,
    },
  });
  await writeRaidAudit({
    raidId: created.id,
    action: "created",
    summary: `Entrée ${code} créée par ${actor.actorName} — statut « ${data.statut || "—"} »`,
    newValue: data.statut,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });
  if (data.responsableRessourceId) {
    const teamHint = teamAssign.equipeName
      ? ` · équipe ${teamAssign.kind === "fonctionnelle" ? "chantier" : "institutionnelle"} « ${teamAssign.equipeName} »`
      : "";
    await writeRaidAudit({
      raidId: created.id,
      action: "assigned",
      field: "responsableRessourceId",
      newValue: data.responsable,
      summary: `Assigné à ${data.responsable || "ressource"} à la création${teamHint}`,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
      actorRessourceId: actor.actorRessourceId,
    });
    await notifyRaidAssigned({
      raidId: created.id,
      code: created.code,
      intitule: created.intitule,
      assigneeRessourceId: data.responsableRessourceId,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
    });
  }
  await notifyRaidChanged({
    raidId: created.id,
    code: created.code,
    intitule: created.intitule,
    chantierId: created.chantierId,
    summary: data.responsableRessourceId
      ? `Création et assignation à ${data.responsable || "ressource"}`
      : "Création de l'entrée RAID",
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
  });
  revalidatePath("/");
  revalidatePath("/raid");
  revalidatePath(`/raid/${created.id}`);
  revalidatePath("/chantiers");
  revalidatePath("/comites");
  revalidatePath("/ressources");
}

export async function updateRaid(
  id: string,
  data: {
    type: string;
    intitule: string;
    description: string;
    categorie: string;
    chantierId: string | null;
    domaine: string;
    probabilite: number | null;
    impact: number | null;
    strategie: string;
    mitigation: string;
    responsable: string;
    responsableRessourceId: string | null;
    statut: string;
    date_identification: string | null;
    date_revision: string | null;
    date_echeance: string | null;
    commentaires: string;
    comiteId: string | null;
  }
) {
  const session = await requireAuth();
  const existing = await prisma.raid.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      intitule: true,
      chantierId: true,
      responsableRessourceId: true,
      statut: true,
    },
  });
  if (!existing) throw new Error("Entrée RAID introuvable.");

  // Edit form: scope « tous », assignee, or DC / suppléant / PMO du chantier lié
  if (!(await canEditRaidForm(session, existing))) {
    throw new Error(
      "Modification non autorisée : réservée à l'assigné, aux rôles « tous les chantiers », ou au Directeur / Suppléant / PMO du chantier lié."
    );
  }

  const actor = await getActorDisplay(session);
  const teamAssign = await resolveRaidEquipeId({
    responsableRessourceId: data.responsableRessourceId || null,
    chantierId: data.chantierId || null,
  });
  // code is immutable — never updated here
  await prisma.raid.update({
    where: { id },
    data: {
      type: data.type,
      intitule: data.intitule,
      description: data.description,
      categorie: data.categorie,
      chantierId: data.chantierId || null,
      domaine: data.domaine,
      probabilite: data.probabilite,
      impact: data.impact,
      strategie: data.strategie,
      mitigation: data.mitigation,
      responsable: data.responsable,
      responsableRessourceId: data.responsableRessourceId || null,
      equipeId: teamAssign.equipeId,
      statut: data.statut,
      date_identification: data.date_identification ? new Date(data.date_identification) : null,
      date_revision: data.date_revision ? new Date(data.date_revision) : null,
      date_echeance: data.date_echeance ? new Date(data.date_echeance) : null,
      commentaires: data.commentaires,
      comiteId: data.comiteId || null,
    },
  });

  const assigneeChanged =
    (data.responsableRessourceId || null) !==
    (existing.responsableRessourceId || null);
  if (assigneeChanged && data.responsableRessourceId) {
    await notifyRaidAssigned({
      raidId: id,
      code: existing.code,
      intitule: data.intitule || existing.intitule,
      assigneeRessourceId: data.responsableRessourceId,
      actorUserId: actor.actorUserId,
      actorName: actor.actorName,
    });
  }
  await notifyRaidChanged({
    raidId: id,
    code: existing.code,
    intitule: data.intitule || existing.intitule,
    chantierId: data.chantierId || existing.chantierId,
    summary: assigneeChanged
      ? `Modification formulaire (assignation → ${data.responsable || "—"})`
      : "Modification via formulaire",
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
  });

  revalidatePath("/");
  revalidatePath("/raid");
  revalidatePath(`/raid/${id}`);
  revalidatePath("/chantiers");
  revalidatePath("/comites");
  revalidatePath("/ressources");
}

/** Context for showing the RAID form edit button (client). */
export async function fetchRaidFormEditContext() {
  const session = await requireAuth();
  return getRaidFormEditContext(session);
}

export async function deleteRaid(id: string) {
  const session = await requireAuth();
  // Delete: only rôles with périmètre chantiers = « tous les chantiers »
  if (!(await canDeleteRaid(session))) {
    throw new Error(
      "Suppression non autorisée : réservée aux rôles avec le périmètre « tous les chantiers »."
    );
  }
  await prisma.raid.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/raid");
  revalidatePath("/chantiers");
  revalidatePath("/comites");
}

// ── RMD CRUD ─────────────────────────────────────────

export async function getRmds() {
  await requireRole("Admin", "Programme_Office");
  return prisma.rmd.findMany({
    orderBy: { nom_complet: "asc" },
    include: {
      _count: { select: { chantiers: true } },
    },
  });
}

export async function getRmdById(id: string) {
  await requireRole("Admin", "Programme_Office");
  return prisma.rmd.findUnique({
    where: { id },
    include: {
      chantiers: {
        include: {
          chantier: {
            select: {
              id: true,
              code: true,
              nom: true,
              domaine: true,
              priorite: true,
              statut: true,
            },
          },
        },
      },
    },
  });
}

export async function getRmdsForSelect() {
  await requireAuth();
  return prisma.rmd.findMany({
    orderBy: { nom_complet: "asc" },
    select: { id: true, nom_complet: true },
  });
}

export async function createRmd(data: {
  nom_complet: string;
  domaine: string;
  suppleant: string;
}) {
  await requireRole("Admin", "Programme_Office");
  await prisma.rmd.create({ data });
  revalidatePath("/");
  revalidatePath("/rmds");
}

export async function updateRmd(
  id: string,
  data: {
    nom_complet: string;
    domaine: string;
    suppleant: string;
  }
) {
  await requireRole("Admin", "Programme_Office");
  await prisma.rmd.update({ where: { id }, data });
  revalidatePath("/");
  revalidatePath("/rmds");
  revalidatePath(`/rmds/${id}`);
}

export async function deleteRmd(id: string) {
  await requireRole("Admin", "Programme_Office");
  const counts = await prisma.rmd.findUnique({
    where: { id },
    include: { _count: { select: { chantiers: true } } },
  });
  if (counts && counts._count.chantiers > 0) {
    throw new Error(
      `Impossible de supprimer : ${counts._count.chantiers} chantier(s) lié(s).`
    );
  }
  await prisma.rmd.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/rmds");
}

// ── Equipe CRUD ──────────────────────────────────────

export async function createMembreEquipe(data: {
  chantierId: string;
  equipe: string;
  role: string;
  ressourceId: string;
  commentaires?: string;
  is_directeur?: boolean;
  charge_pourcentage?: number;
}) {
  await requireChantierAccess(data.chantierId);
  if (!data.ressourceId?.trim()) {
    throw new Error("Une ressource est obligatoire pour chaque membre d'équipe.");
  }
  const ressource = await prisma.ressource.findUnique({
    where: { id: data.ressourceId },
    select: { id: true },
  });
  if (!ressource) {
    throw new Error("Ressource introuvable.");
  }
  if (data.is_directeur) {
    await prisma.membreEquipe.updateMany({
      where: { chantierId: data.chantierId, is_directeur: true },
      data: { is_directeur: false },
    });
  }
  await prisma.membreEquipe.create({
    data: {
      chantierId: data.chantierId,
      equipe: data.equipe,
      role: data.role,
      commentaires: data.commentaires?.trim() ?? "",
      is_directeur: data.is_directeur ?? false,
      charge_pourcentage: data.charge_pourcentage ?? 100,
      ressourceId: data.ressourceId,
    },
  });
  // Functional chantier team membership
  await ensureChantierFunctionalTeam(data.chantierId);
  await syncChantierFunctionalMembership(data.chantierId);
  revalidatePath(`/chantiers/${data.chantierId}`);
  revalidatePath("/ressources");
  revalidatePath("/capacite");
  revalidatePath("/admin/equipes");
}

export async function updateMembreEquipe(
  id: string,
  data: {
    equipe: string;
    role: string;
    ressourceId: string;
    commentaires?: string;
    is_directeur?: boolean;
    charge_pourcentage?: number;
  }
) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier");
  if (!data.ressourceId?.trim()) {
    throw new Error("Une ressource est obligatoire pour chaque membre d'équipe.");
  }
  const ressource = await prisma.ressource.findUnique({
    where: { id: data.ressourceId },
    select: { id: true },
  });
  if (!ressource) {
    throw new Error("Ressource introuvable.");
  }
  if (data.is_directeur) {
    const existing = await prisma.membreEquipe.findUnique({ where: { id } });
    if (existing) {
      await prisma.membreEquipe.updateMany({
        where: { chantierId: existing.chantierId, is_directeur: true, id: { not: id } },
        data: { is_directeur: false },
      });
    }
  }
  const membre = await prisma.membreEquipe.update({
    where: { id },
    data: {
      equipe: data.equipe,
      role: data.role,
      commentaires: data.commentaires?.trim() ?? "",
      is_directeur: data.is_directeur ?? false,
      charge_pourcentage: data.charge_pourcentage,
      ressourceId: data.ressourceId,
    },
  });
  await syncChantierFunctionalMembership(membre.chantierId);
  revalidatePath(`/chantiers/${membre.chantierId}`);
  revalidatePath("/ressources");
  revalidatePath("/capacite");
  revalidatePath("/admin/equipes");
}

export async function deleteMembreEquipe(id: string) {
  await requireRole("Admin", "Programme_Office");
  const membre = await prisma.membreEquipe.delete({ where: { id } });
  await syncChantierFunctionalMembership(membre.chantierId);
  revalidatePath(`/chantiers/${membre.chantierId}`);
  revalidatePath("/admin/equipes");
}

// ── Comités ──────────────────────────────────────────

export async function getComites() {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier");
  return prisma.comite.findMany({
    orderBy: [{ instance: "asc" }, { date: "desc" }],
    include: {
      raids: {
        orderBy: { createdAt: "desc" },
        include: { chantier: { select: { id: true, code: true, nom: true } } },
      },
    },
  });
}

export async function getNextComiteNumero(instance: string) {
  await requireRole("Admin", "Programme_Office");
  const last = await prisma.comite.findFirst({
    where: { instance },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return (last?.numero ?? 0) + 1;
}

async function assertValidComiteInstance(
  instance: string,
  opts?: { requireActive?: boolean }
) {
  const name = instance.trim();
  if (!name) throw new Error("L'instance de comité est obligatoire.");
  const param = await prisma.comiteParametre.findUnique({
    where: { name },
  });
  if (!param) {
    throw new Error(
      "Type de comité inconnu. Définissez-le dans Administration → Paramètres comités."
    );
  }
  if (opts?.requireActive !== false && !param.is_active) {
    throw new Error(
      "Ce type de comité est inactif. Réactivez-le dans Paramètres comités ou choisissez une autre instance."
    );
  }
  return name;
}

export async function createComite(data: {
  instance: string;
  numero: number;
  date: string;
  heure_casablanca: string;
  heure_belgique: string;
  statut: string;
  ordre_du_jour: string;
  invitation_envoyee: boolean;
}) {
  await requireRole("Admin", "Programme_Office");
  const instance = await assertValidComiteInstance(data.instance, {
    requireActive: true,
  });
  await prisma.comite.create({
    data: {
      ...data,
      instance,
      date: new Date(data.date),
    },
  });
  revalidatePath("/comites");
}

export async function updateComite(
  id: string,
  data: {
    instance: string;
    numero: number;
    date: string;
    heure_casablanca: string;
    heure_belgique: string;
    statut: string;
    ordre_du_jour: string;
    invitation_envoyee: boolean;
  }
) {
  await requireRole("Admin", "Programme_Office");
  // Allow keeping a deactivated type on existing meetings; new type must be active
  const current = await prisma.comite.findUnique({
    where: { id },
    select: { instance: true },
  });
  const instance = await assertValidComiteInstance(data.instance, {
    requireActive: current?.instance !== data.instance.trim(),
  });
  await prisma.comite.update({
    where: { id },
    data: {
      ...data,
      instance,
      date: new Date(data.date),
    },
  });
  revalidatePath("/comites");
}

export async function deleteComite(id: string) {
  await requireRole("Admin", "Programme_Office");
  await prisma.comite.delete({ where: { id } });
  revalidatePath("/comites");
}

// ── Settings ─────────────────────────────────────────

export async function updateSettings(data: {
  seuil_relance_jours: number;
  seuil_qa_critique_heures: number;
  poids_precadrage: number;
  poids_cadrage: number;
  poids_execution: number;
  poids_cloture: number;
}) {
  await requireRole("Admin");
  const weightSum = data.poids_precadrage + data.poids_cadrage + data.poids_execution + data.poids_cloture;
  if (weightSum !== 100) {
    throw new Error(`La somme des poids doit être 100% (actuellement ${weightSum}%)`);
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  // Recalculate all active chantiers since weights changed
  const chantiers = await prisma.chantier.findMany({
    where: { statut: { not: "Clôturé" } },
    select: { id: true },
  });
  for (const c of chantiers) {
    await recalculateChantierProgress(c.id);
  }

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/chantiers");
}

// ── Status Config CRUD ───────────────────────────────

export async function getStatusConfigs(type?: string) {
  await requireAuth();
  return prisma.statusConfig.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ type: "asc" }, { position: "asc" }],
  });
}

export async function createStatusConfig(data: {
  type: string;
  label: string;
  color: string;
  position: number;
}) {
  await requireRole("Admin");
  await prisma.statusConfig.create({ data });
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function updateStatusConfig(
  id: string,
  data: { label?: string; color?: string; position?: number }
) {
  await requireRole("Admin");
  await prisma.statusConfig.update({ where: { id }, data });
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function deleteStatusConfig(id: string) {
  await requireRole("Admin");
  await prisma.statusConfig.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function reorderStatusConfigs(type: string, orderedIds: string[]) {
  await requireRole("Admin");
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.statusConfig.update({ where: { id }, data: { position: index } })
    )
  );
  revalidatePath("/settings");
  revalidatePath("/");
}

// ── RAID field options (Catégorie / Domaine) ──────────

export async function getRaidFieldOptions(kind?: string) {
  await requireAuth();
  return prisma.raidFieldOption.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ kind: "asc" }, { position: "asc" }, { label: "asc" }],
  });
}

export async function createRaidFieldOption(data: {
  kind: string;
  label: string;
  color: string;
  position: number;
}) {
  await requireRole("Admin");
  const kind = data.kind === "domaine" ? "domaine" : "categorie";
  const label = data.label.trim();
  if (!label) throw new Error("Libellé obligatoire");
  await prisma.raidFieldOption.create({
    data: {
      kind,
      label,
      color: data.color || "#6b7280",
      position: data.position,
    },
  });
  revalidatePath("/settings");
  revalidatePath("/raid");
  revalidatePath("/calendrier");
  revalidatePath("/");
}

export async function updateRaidFieldOption(
  id: string,
  data: { label?: string; color?: string; position?: number }
) {
  await requireRole("Admin");
  const patch: { label?: string; color?: string; position?: number } = {};
  if (data.label !== undefined) {
    const label = data.label.trim();
    if (!label) throw new Error("Libellé obligatoire");
    patch.label = label;
  }
  if (data.color !== undefined) patch.color = data.color;
  if (data.position !== undefined) patch.position = data.position;
  await prisma.raidFieldOption.update({ where: { id }, data: patch });
  revalidatePath("/settings");
  revalidatePath("/raid");
  revalidatePath("/calendrier");
  revalidatePath("/");
}

export async function deleteRaidFieldOption(id: string) {
  await requireRole("Admin");
  await prisma.raidFieldOption.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/raid");
  revalidatePath("/calendrier");
  revalidatePath("/");
}

export async function reorderRaidFieldOptions(kind: string, orderedIds: string[]) {
  await requireRole("Admin");
  const k = kind === "domaine" ? "domaine" : "categorie";
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.raidFieldOption.update({ where: { id }, data: { position: index } })
    )
  );
  // Ensure all reordered rows keep the expected kind (defensive)
  void k;
  revalidatePath("/settings");
  revalidatePath("/raid");
  revalidatePath("/");
}

// ── Profil Ressource CRUD ────────────────────────────

export async function getProfilsRessource() {
  await requireAuth();
  return prisma.profilRessource.findMany({
    where: { actif: true },
    orderBy: [{ type_ressource: "asc" }, { ordre: "asc" }, { nom: "asc" }],
    include: { _count: { select: { ressources: true } } },
  });
}

export async function getAllProfilsRessource() {
  await requireRole("Admin", "Workforce_Manager");
  return prisma.profilRessource.findMany({
    orderBy: [{ type_ressource: "asc" }, { ordre: "asc" }, { nom: "asc" }],
    include: { _count: { select: { ressources: true } } },
  });
}

export async function getProfilsByType(type: string) {
  await requireAuth();
  return prisma.profilRessource.findMany({
    where: { type_ressource: type, actif: true },
    orderBy: [{ ordre: "asc" }, { nom: "asc" }],
  });
}

export async function createProfilRessource(data: {
  nom: string;
  type_ressource: string;
  tjm_defaut: number;
  ordre: number;
  actif: boolean;
}) {
  await requireRole("Admin", "Workforce_Manager");
  await prisma.profilRessource.create({ data });
  revalidatePath("/");
  revalidatePath("/profils");
}

export async function updateProfilRessource(
  id: string,
  data: {
    nom: string;
    type_ressource: string;
    tjm_defaut: number;
    ordre: number;
    actif: boolean;
  }
) {
  await requireRole("Admin", "Workforce_Manager");
  await prisma.profilRessource.update({ where: { id }, data });
  revalidatePath("/");
  revalidatePath("/profils");
}

export async function deleteProfilRessource(id: string) {
  await requireRole("Admin", "Workforce_Manager");
  const counts = await prisma.profilRessource.findUnique({
    where: { id },
    include: { _count: { select: { ressources: true } } },
  });
  if (counts && counts._count.ressources > 0) {
    throw new Error(
      `Impossible de supprimer : ${counts._count.ressources} ressource(s) liée(s) à ce profil.`
    );
  }
  await prisma.profilRessource.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/profils");
}

// ── Ressource CRUD ──────────────────────────────────

const ressourcePeopleInclude = {
  profil: {
    select: { id: true, nom: true, type_ressource: true, tjm_defaut: true },
  },
  equipeHierarchie: {
    select: { id: true, name: true, is_active: true },
  },
  equipesFonctionnelles: {
    include: {
      equipe: { select: { id: true, name: true, is_active: true } },
    },
  },
  user: {
    select: {
      id: true,
      username: true,
      role: true,
      is_active: true,
      last_login: true,
    },
  },
  _count: { select: { membres: true, raids: true } },
} as const;

export async function getRessources() {
  await requireRole("Admin", "Programme_Office", "Workforce_Manager");
  return prisma.ressource.findMany({
    orderBy: { nom_complet: "asc" },
    include: ressourcePeopleInclude,
  });
}

export async function getRessourceById(id: string) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier", "Workforce_Manager");
  return prisma.ressource.findUnique({
    where: { id },
    include: {
      ...ressourcePeopleInclude,
      membres: {
        include: {
          chantier: {
            select: {
              id: true,
              code: true,
              nom: true,
              domaine: true,
              priorite: true,
              statut: true,
              date_debut: true,
              date_fin: true,
            },
          },
        },
      },
      raids: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          intitule: true,
          statut: true,
          date_echeance: true,
          chantierId: true,
          chantier: { select: { code: true, nom: true } },
        },
      },
    },
  });
}

export async function getRessourcesForSelect() {
  const session = await requireAuth();

  // PMO_Chantier: only their own resource + members of their chantiers
  if (session.role === "PMO_Chantier") {
    const chantierIds = await getUserChantierIds(session);
    if (chantierIds === "all" || chantierIds.length === 0) {
      // Fallback: just their own resource
      return prisma.ressource.findMany({
        where: {
          actif: true,
          ...(session.ressourceId ? { id: session.ressourceId } : {}),
        },
        orderBy: { nom_complet: "asc" },
        select: { id: true, nom_complet: true, type: true, organisation: true },
      });
    }

    // Get all ressourceIds linked to members of those chantiers
    const membres = await prisma.membreEquipe.findMany({
      where: { chantierId: { in: chantierIds } },
      select: { ressourceId: true },
    });
    const ressourceIds = [
      ...new Set([
        ...(session.ressourceId ? [session.ressourceId] : []),
        ...membres.map((m) => m.ressourceId),
      ]),
    ];

    return prisma.ressource.findMany({
      where: { actif: true, id: { in: ressourceIds } },
      orderBy: { nom_complet: "asc" },
      select: { id: true, nom_complet: true, type: true, organisation: true },
    });
  }

  // Admin, Programme_Office, Workforce_Manager: all active resources
  return prisma.ressource.findMany({
    where: { actif: true },
    orderBy: { nom_complet: "asc" },
    select: { id: true, nom_complet: true, type: true, organisation: true },
  });
}

async function assertEquipeHierarchie(equipeHierarchieId: string | null | undefined) {
  const id = equipeHierarchieId?.trim() || "";
  if (!id) {
    throw new Error("L'équipe hiérarchique (rattachement banque) est obligatoire.");
  }
  const equipe = await prisma.equipe.findUnique({ where: { id } });
  if (!equipe) throw new Error("Équipe hiérarchique introuvable.");
  if (!equipe.is_active) {
    throw new Error("L'équipe hiérarchique sélectionnée est inactive.");
  }
  if (equipe.type !== EQUIPE_TYPES.institutionnelle) {
    throw new Error(
      "Le rattachement hiérarchique doit être une équipe institutionnelle (organisation banque), pas une équipe chantier."
    );
  }
  return id;
}

export async function createRessource(data: {
  nom_complet: string;
  email: string;
  telephone: string;
  type: string;
  organisation: string;
  tarif_journalier: number;
  capacite_jours_mois: number;
  actif: boolean;
  profilId?: string | null;
  equipeHierarchieId: string;
  equipeFonctionnelleIds?: string[];
  /** Optional app account creation (Admin only for roles other than default). */
  createAccount?: {
    username: string;
    password: string;
    role: string;
  } | null;
}) {
  await requireRole("Admin", "Workforce_Manager");
  const equipeHierarchieId = await assertEquipeHierarchie(data.equipeHierarchieId);

  if (data.createAccount) {
    // Account creation is admin-gated (role assignment)
    await requireRole("Admin");
  }

  const ressource = await prisma.$transaction(async (tx) => {
    const created = await tx.ressource.create({
      data: {
        nom_complet: data.nom_complet.trim(),
        email: data.email.trim(),
        telephone: data.telephone.trim(),
        type: data.type,
        organisation: data.organisation.trim(),
        tarif_journalier: data.tarif_journalier,
        capacite_jours_mois: data.capacite_jours_mois,
        actif: data.actif,
        profilId: data.profilId || null,
        equipeHierarchieId,
      },
    });

    const fnIds = data.equipeFonctionnelleIds ?? [];
    if (fnIds.length > 0) {
      await tx.ressourceEquipeFonctionnelle.createMany({
        data: [...new Set(fnIds)].map((equipeId) => ({
          ressourceId: created.id,
          equipeId,
        })),
      });
    }

    if (data.createAccount) {
      const username = data.createAccount.username.trim();
      if (!username) throw new Error("Le nom d'utilisateur est obligatoire.");
      const existing = await tx.user.findUnique({ where: { username } });
      if (existing) throw new Error("Ce nom d'utilisateur existe déjà.");

      const appRole = await tx.appRole.findUnique({
        where: { code: data.createAccount.role },
      });
      if (!appRole || !appRole.is_active) {
        throw new Error("Rôle invalide ou désactivé.");
      }

      const complexityError = validatePasswordComplexity(data.createAccount.password);
      if (complexityError) throw new Error(complexityError);

      const password_hash = await hashPassword(data.createAccount.password);
      const identity = identityFromRessource(created);
      await tx.user.create({
        data: {
          username,
          password_hash,
          role: data.createAccount.role,
          must_change_pwd: true,
          ressourceId: created.id,
          ...identity,
        },
      });
    }

    return created;
  });

  revalidatePath("/");
  revalidatePath("/ressources");
  revalidatePath("/admin/users");
  return { id: ressource.id };
}

export async function updateRessource(
  id: string,
  data: {
    nom_complet: string;
    email: string;
    telephone: string;
    type: string;
    organisation: string;
    tarif_journalier: number;
    capacite_jours_mois: number;
    actif: boolean;
    profilId?: string | null;
    equipeHierarchieId: string;
    equipeFonctionnelleIds?: string[];
  }
) {
  await requireRole("Admin", "Workforce_Manager");
  const equipeHierarchieId = await assertEquipeHierarchie(data.equipeHierarchieId);

  await prisma.$transaction(async (tx) => {
    const updated = await tx.ressource.update({
      where: { id },
      data: {
        nom_complet: data.nom_complet.trim(),
        email: data.email.trim(),
        telephone: data.telephone.trim(),
        type: data.type,
        organisation: data.organisation.trim(),
        tarif_journalier: data.tarif_journalier,
        capacite_jours_mois: data.capacite_jours_mois,
        actif: data.actif,
        profilId: data.profilId || null,
        equipeHierarchieId,
      },
    });

    await tx.ressourceEquipeFonctionnelle.deleteMany({ where: { ressourceId: id } });
    const fnIds = [...new Set((data.equipeFonctionnelleIds ?? []).filter(Boolean))];
    if (fnIds.length > 0) {
      await tx.ressourceEquipeFonctionnelle.createMany({
        data: fnIds.map((equipeId) => ({ ressourceId: id, equipeId })),
      });
    }

    // Keep linked account identity in sync with master people data
    const identity = identityFromRessource(updated);
    await tx.user.updateMany({
      where: { ressourceId: id },
      data: identity,
    });
  });

  revalidatePath("/");
  revalidatePath("/ressources");
  revalidatePath(`/ressources/${id}`);
  revalidatePath("/admin/users");
}

export async function createAccountForRessource(
  ressourceId: string,
  data: { username: string; password: string; role: string }
) {
  await requireRole("Admin");

  const ressource = await prisma.ressource.findUnique({
    where: { id: ressourceId },
    include: { user: { select: { id: true } } },
  });
  if (!ressource) throw new Error("Ressource introuvable.");
  if (ressource.user) {
    throw new Error("Cette ressource a déjà un compte applicatif.");
  }

  const username = data.username.trim();
  if (!username) throw new Error("Le nom d'utilisateur est obligatoire.");
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) throw new Error("Ce nom d'utilisateur existe déjà.");

  const appRole = await prisma.appRole.findUnique({ where: { code: data.role } });
  if (!appRole || !appRole.is_active) {
    throw new Error("Rôle invalide ou désactivé.");
  }

  const complexityError = validatePasswordComplexity(data.password);
  if (complexityError) throw new Error(complexityError);

  const password_hash = await hashPassword(data.password);
  const identity = identityFromRessource(ressource);

  await prisma.user.create({
    data: {
      username,
      password_hash,
      role: data.role,
      must_change_pwd: true,
      ressourceId: ressource.id,
      ...identity,
    },
  });

  revalidatePath("/ressources");
  revalidatePath(`/ressources/${ressourceId}`);
  revalidatePath("/admin/users");
}

export async function deleteRessource(id: string) {
  await requireRole("Admin", "Workforce_Manager");
  const counts = await prisma.ressource.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true } },
      _count: { select: { membres: true, raids: true } },
    },
  });
  if (!counts) throw new Error("Ressource introuvable.");
  if (counts.user) {
    throw new Error(
      `Impossible de supprimer : un compte applicatif « ${counts.user.username} » est lié. Supprimez d'abord le compte (Administration → Utilisateurs).`
    );
  }
  if (counts._count.membres > 0 || counts._count.raids > 0) {
    throw new Error(
      `Impossible de supprimer : ${counts._count.membres} membre(s) d'équipe et ${counts._count.raids} élément(s) RAID lié(s).`
    );
  }
  await prisma.ressource.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/ressources");
}

// ── Saisie Temps (Timesheets) ───────────────────────

export async function getSaisiesTempsParRessource(
  ressourceId: string,
  annee: number
) {
  await requireAuth();
  const debut = new Date(annee, 0, 1);
  const fin = new Date(annee + 1, 0, 1);
  return prisma.saisieTemps.findMany({
    where: {
      ressourceId,
      date_lundi: { gte: debut, lt: fin },
    },
    include: { chantier: { select: { id: true, code: true, nom: true } } },
    orderBy: { date_lundi: "asc" },
  });
}

export async function getSaisiesTempsParChantier(
  chantierId: string,
  annee?: number
) {
  await requireAuth();
  const where: { chantierId: string; date_lundi?: { gte: Date; lt: Date } } = { chantierId };
  if (annee) {
    where.date_lundi = { gte: new Date(annee, 0, 1), lt: new Date(annee + 1, 0, 1) };
  }
  return prisma.saisieTemps.findMany({
    where,
    include: {
      ressource: { select: { id: true, nom_complet: true, tarif_journalier: true } },
    },
    orderBy: { date_lundi: "asc" },
  });
}

export async function getSaisiesTempsForWeek(
  ressourceId: string,
  dateLundi: string
) {
  await requireAuth();
  const lundi = new Date(dateLundi);
  return prisma.saisieTemps.findMany({
    where: { ressourceId, date_lundi: lundi },
    include: { chantier: { select: { id: true, code: true, nom: true } } },
  });
}

export async function upsertSaisieTemps(data: {
  ressourceId: string;
  chantierId: string;
  date_lundi: string;
  jours_travailles: number;
  commentaire?: string;
}) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier", "Workforce_Manager");
  const dateLundi = new Date(data.date_lundi);
  await prisma.saisieTemps.upsert({
    where: {
      ressourceId_chantierId_date_lundi: {
        ressourceId: data.ressourceId,
        chantierId: data.chantierId,
        date_lundi: dateLundi,
      },
    },
    update: {
      jours_travailles: data.jours_travailles,
      commentaire: data.commentaire ?? "",
    },
    create: {
      ressourceId: data.ressourceId,
      chantierId: data.chantierId,
      date_lundi: dateLundi,
      jours_travailles: data.jours_travailles,
      commentaire: data.commentaire ?? "",
    },
  });
  revalidatePath("/saisie-temps");
  revalidatePath("/capacite");
  revalidatePath(`/ressources/${data.ressourceId}`);
  revalidatePath(`/chantiers/${data.chantierId}`);
  revalidatePath("/");
}

export async function upsertSaisiesTempsBatch(
  entries: {
    ressourceId: string;
    chantierId: string;
    date_lundi: string;
    jours_travailles: number;
    commentaire?: string;
  }[]
) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier", "Workforce_Manager");
  await prisma.$transaction(
    entries.map((e) => {
      const dateLundi = new Date(e.date_lundi);
      return prisma.saisieTemps.upsert({
        where: {
          ressourceId_chantierId_date_lundi: {
            ressourceId: e.ressourceId,
            chantierId: e.chantierId,
            date_lundi: dateLundi,
          },
        },
        update: {
          jours_travailles: e.jours_travailles,
          commentaire: e.commentaire ?? "",
        },
        create: {
          ressourceId: e.ressourceId,
          chantierId: e.chantierId,
          date_lundi: dateLundi,
          jours_travailles: e.jours_travailles,
          commentaire: e.commentaire ?? "",
        },
      });
    })
  );
  revalidatePath("/saisie-temps");
  revalidatePath("/capacite");
  revalidatePath("/");
}

export async function deleteSaisieTemps(id: string) {
  await requireRole("Admin", "Programme_Office", "Workforce_Manager");
  await prisma.saisieTemps.delete({ where: { id } });
  revalidatePath("/saisie-temps");
  revalidatePath("/capacite");
  revalidatePath("/");
}

// ── Capacité & Disponibilité ────────────────────────

export async function getCapaciteRessource(ressourceId: string) {
  await requireRole("Admin", "Programme_Office", "Workforce_Manager");
  const ressource = await prisma.ressource.findUnique({
    where: { id: ressourceId },
    include: {
      membres: {
        include: {
          chantier: {
            select: { id: true, code: true, nom: true, date_debut: true, date_fin: true, statut: true },
          },
        },
      },
      saisiesTemps: {
        orderBy: { date_lundi: "asc" },
      },
    },
  });
  if (!ressource) return null;

  const capacite = ressource.capacite_jours_mois;
  const now = new Date();
  const currentYear = now.getFullYear();

  // Build monthly data for current year + next 2 years
  const monthlyData: {
    mois: number;
    annee: number;
    jours_planifies: number;
    jours_travailles: number;
    charge_pct: number;
    chantiers_actifs: { code: string; nom: string; charge_pourcentage: number; jours: number }[];
  }[] = [];

  for (let year = currentYear; year <= currentYear + 2; year++) {
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      let joursPlanifies = 0;
      const chantiersActifs: { code: string; nom: string; charge_pourcentage: number; jours: number }[] = [];

      for (const m of ressource.membres) {
        const chantierDebut = new Date(m.chantier.date_debut);
        const chantierFin = new Date(m.chantier.date_fin);
        if (m.chantier.statut === "Clôturé") continue;
        // Check if chantier is active during this month
        if (chantierDebut <= monthEnd && chantierFin >= monthStart) {
          const jours = (m.charge_pourcentage / 100) * capacite;
          joursPlanifies += jours;
          chantiersActifs.push({
            code: m.chantier.code,
            nom: m.chantier.nom,
            charge_pourcentage: m.charge_pourcentage,
            jours,
          });
        }
      }

      // Sum actual days from weekly entries in this month
      let joursTravailles = 0;
      for (const s of ressource.saisiesTemps) {
        const sDate = new Date(s.date_lundi);
        if (sDate.getFullYear() === year && sDate.getMonth() === month) {
          joursTravailles += s.jours_travailles;
        }
      }

      monthlyData.push({
        mois: month + 1,
        annee: year,
        jours_planifies: Math.round(joursPlanifies * 10) / 10,
        jours_travailles: Math.round(joursTravailles * 10) / 10,
        charge_pct: capacite > 0 ? Math.round((joursPlanifies / capacite) * 100) : 0,
        chantiers_actifs: chantiersActifs,
      });
    }
  }

  // Find first month with charge < 50% (availability forecast)
  const futureMonths = monthlyData.filter(
    (m) => new Date(m.annee, m.mois - 1, 1) >= new Date(currentYear, now.getMonth(), 1)
  );
  const disponibleFrom = futureMonths.find((m) => m.charge_pct < 50) ?? null;

  return { ressource, monthlyData, disponibleFrom, capacite };
}

export async function getCapaciteGlobale(annee: number) {
  await requireRole("Admin", "Programme_Office", "Workforce_Manager");
  const ressources = await prisma.ressource.findMany({
    where: { actif: true },
    orderBy: { nom_complet: "asc" },
    include: {
      membres: {
        include: {
          chantier: {
            select: { date_debut: true, date_fin: true, statut: true, code: true, nom: true },
          },
        },
      },
      saisiesTemps: {
        where: {
          date_lundi: {
            gte: new Date(annee, 0, 1),
            lt: new Date(annee + 1, 0, 1),
          },
        },
      },
    },
  });

  return ressources.map((r) => {
    const capacite = r.capacite_jours_mois;
    const months: {
      mois: number;
      jours_planifies: number;
      jours_travailles: number;
      charge_pct: number;
    }[] = [];

    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(annee, month, 1);
      const monthEnd = new Date(annee, month + 1, 0);

      let joursPlanifies = 0;
      for (const m of r.membres) {
        const chantierDebut = new Date(m.chantier.date_debut);
        const chantierFin = new Date(m.chantier.date_fin);
        if (m.chantier.statut === "Clôturé") continue;
        if (chantierDebut <= monthEnd && chantierFin >= monthStart) {
          joursPlanifies += (m.charge_pourcentage / 100) * capacite;
        }
      }

      let joursTravailles = 0;
      for (const s of r.saisiesTemps) {
        const sDate = new Date(s.date_lundi);
        if (sDate.getMonth() === month) {
          joursTravailles += s.jours_travailles;
        }
      }

      months.push({
        mois: month + 1,
        jours_planifies: Math.round(joursPlanifies * 10) / 10,
        jours_travailles: Math.round(joursTravailles * 10) / 10,
        charge_pct: capacite > 0 ? Math.round((joursPlanifies / capacite) * 100) : 0,
      });
    }

    const avgCharge = Math.round(months.reduce((s, m) => s + m.charge_pct, 0) / 12);

    return {
      id: r.id,
      nom_complet: r.nom_complet,
      type: r.type,
      organisation: r.organisation,
      capacite,
      tarif_journalier: r.tarif_journalier,
      months,
      avgCharge,
    };
  });
}

/**
 * Personal capacity for the signed-in user's resource (same rules as Capacité heatmap).
 * Year-scoped monthly charge for Mon Tableau de bord.
 */
export async function getPersonalCapacite(annee: number) {
  const session = await requireAuth();
  if (!session.ressourceId) return null;

  const r = await prisma.ressource.findUnique({
    where: { id: session.ressourceId },
    include: {
      membres: {
        include: {
          chantier: {
            select: {
              date_debut: true,
              date_fin: true,
              statut: true,
              code: true,
              nom: true,
            },
          },
        },
      },
      saisiesTemps: {
        where: {
          date_lundi: {
            gte: new Date(annee, 0, 1),
            lt: new Date(annee + 1, 0, 1),
          },
        },
      },
    },
  });

  if (!r || !r.actif) return null;

  const capacite = r.capacite_jours_mois;
  const months: {
    mois: number;
    jours_planifies: number;
    jours_travailles: number;
    charge_pct: number;
    chantiers: { code: string; nom: string; charge_pourcentage: number }[];
  }[] = [];

  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(annee, month, 1);
    const monthEnd = new Date(annee, month + 1, 0);

    let joursPlanifies = 0;
    const chantiers: {
      code: string;
      nom: string;
      charge_pourcentage: number;
    }[] = [];

    for (const m of r.membres) {
      const chantierDebut = new Date(m.chantier.date_debut);
      const chantierFin = new Date(m.chantier.date_fin);
      if (m.chantier.statut === "Clôturé") continue;
      if (chantierDebut <= monthEnd && chantierFin >= monthStart) {
        joursPlanifies += (m.charge_pourcentage / 100) * capacite;
        chantiers.push({
          code: m.chantier.code,
          nom: m.chantier.nom,
          charge_pourcentage: m.charge_pourcentage,
        });
      }
    }

    let joursTravailles = 0;
    for (const s of r.saisiesTemps) {
      const sDate = new Date(s.date_lundi);
      if (sDate.getMonth() === month) {
        joursTravailles += s.jours_travailles;
      }
    }

    months.push({
      mois: month + 1,
      jours_planifies: Math.round(joursPlanifies * 10) / 10,
      jours_travailles: Math.round(joursTravailles * 10) / 10,
      charge_pct:
        capacite > 0 ? Math.round((joursPlanifies / capacite) * 100) : 0,
      chantiers,
    });
  }

  const avgCharge = Math.round(
    months.reduce((s, m) => s + m.charge_pct, 0) / 12
  );

  const now = new Date();
  const currentMonth =
    months.find(
      (m) =>
        m.mois === now.getMonth() + 1 && annee === now.getFullYear()
    ) ?? months[now.getMonth()];

  return {
    id: r.id,
    nom_complet: r.nom_complet,
    type: r.type,
    organisation: r.organisation,
    capacite,
    months,
    avgCharge,
    currentCharge: currentMonth?.charge_pct ?? 0,
    annee,
  };
}

export async function getBurnRateChantier(chantierId: string) {
  await requireChantierAccess(chantierId);
  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    include: {
      membres: {
        include: {
          ressource: { select: { id: true, nom_complet: true, tarif_journalier: true, capacite_jours_mois: true } },
        },
      },
      saisiesTemps: {
        include: {
          ressource: { select: { id: true, nom_complet: true, tarif_journalier: true } },
        },
        orderBy: { date_lundi: "asc" },
      },
    },
  });
  if (!chantier) return null;

  const debut = new Date(chantier.date_debut);
  const fin = new Date(chantier.date_fin);
  const now = new Date();
  const lastMonth = fin < now ? fin : now;

  const monthlyBurn: {
    mois: number;
    annee: number;
    label: string;
    jours_planifies: number;
    jours_reels: number;
    cout_planifie: number;
    cout_reel: number;
  }[] = [];

  const current = new Date(debut.getFullYear(), debut.getMonth(), 1);
  while (current <= lastMonth) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const monthEnd = new Date(year, month + 1, 0);

    let joursPlanifies = 0;
    let coutPlanifie = 0;
    for (const m of chantier.membres) {
      if (m.ressource) {
        const jours = (m.charge_pourcentage / 100) * m.ressource.capacite_jours_mois;
        joursPlanifies += jours;
        coutPlanifie += jours * m.ressource.tarif_journalier;
      }
    }

    let joursReels = 0;
    let coutReel = 0;
    for (const s of chantier.saisiesTemps) {
      const sDate = new Date(s.date_lundi);
      if (sDate.getFullYear() === year && sDate.getMonth() === month) {
        joursReels += s.jours_travailles;
        coutReel += s.jours_travailles * s.ressource.tarif_journalier;
      }
    }

    const label = `${year}-${String(month + 1).padStart(2, "0")}`;
    monthlyBurn.push({
      mois: month + 1,
      annee: year,
      label,
      jours_planifies: Math.round(joursPlanifies * 10) / 10,
      jours_reels: Math.round(joursReels * 10) / 10,
      cout_planifie: Math.round(coutPlanifie),
      cout_reel: Math.round(coutReel),
    });

    current.setMonth(current.getMonth() + 1);
  }

  // Team details
  const teamDetails = chantier.membres
    .filter((m) => m.ressource)
    .map((m) => {
      const joursTravailles = chantier.saisiesTemps
        .filter((s) => s.ressourceId === m.ressourceId)
        .reduce((sum, s) => sum + s.jours_travailles, 0);
      const tjm = m.ressource!.tarif_journalier;
      return {
        id: m.id,
        nom_complet: m.ressource!.nom_complet,
        equipe: m.equipe,
        role: m.role,
        charge_pourcentage: m.charge_pourcentage,
        tarif_journalier: tjm,
        jours_travailles: Math.round(joursTravailles * 10) / 10,
        cout_reel: Math.round(joursTravailles * tjm),
      };
    });

  const totalCoutReel = monthlyBurn.reduce((s, m) => s + m.cout_reel, 0);
  const totalCoutPlanifie = monthlyBurn.reduce((s, m) => s + m.cout_planifie, 0);
  const totalJoursReels = monthlyBurn.reduce((s, m) => s + m.jours_reels, 0);
  const totalJoursPlanifies = monthlyBurn.reduce((s, m) => s + m.jours_planifies, 0);

  return {
    chantier: { id: chantier.id, code: chantier.code, nom: chantier.nom, budget: chantier.budget },
    monthlyBurn,
    teamDetails,
    totals: {
      cout_reel: totalCoutReel,
      cout_planifie: totalCoutPlanifie,
      jours_reels: totalJoursReels,
      jours_planifies: totalJoursPlanifies,
      taux_consommation: totalCoutPlanifie > 0 ? Math.round((totalCoutReel / totalCoutPlanifie) * 100) : 0,
    },
  };
}

// ── Jalons (Milestones) ─────────────────────────────

export async function getJalonsForChantier(chantierId: string) {
  await requireAuth();
  return prisma.jalon.findMany({
    where: { chantierId },
    orderBy: [{ phase: "asc" }, { ordre: "asc" }],
  });
}

export async function getAllJalons(filters?: {
  phase?: string[];
  statut?: string[];
  chantierId?: string;
  domaine?: string[];
  overdueOnly?: boolean;
}) {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  const now = new Date();
  return prisma.jalon.findMany({
    where: {
      ...(chantierIds !== "all" ? { chantierId: { in: chantierIds } } : {}),
      ...(filters?.phase?.length ? { phase: { in: filters.phase } } : {}),
      ...(filters?.statut?.length ? { statut: { in: filters.statut } } : {}),
      ...(filters?.chantierId ? { chantierId: filters.chantierId } : {}),
      ...(filters?.domaine?.length
        ? { chantier: { domaine: { in: filters.domaine } } }
        : {}),
      ...(filters?.overdueOnly
        ? {
            date_cible: { lt: now },
            statut: { notIn: ["Atteint", "Annulé"] },
          }
        : {}),
    },
    orderBy: [{ date_cible: "asc" }],
    include: {
      chantier: {
        select: {
          id: true,
          code: true,
          nom: true,
          domaine: true,
          date_debut: true,
          date_fin: true,
          statut: true,
        },
      },
    },
  });
}

export async function createJalon(data: {
  chantierId: string;
  phase: string;
  nom: string;
  description?: string;
  ordre?: number;
  date_cible: string;
  date_reelle?: string | null;
  statut?: string;
  livrables?: string;
  commentaire?: string;
}) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier");
  await prisma.jalon.create({
    data: {
      chantierId: data.chantierId,
      phase: data.phase,
      nom: data.nom,
      description: data.description ?? "",
      ordre: data.ordre ?? 0,
      date_cible: new Date(data.date_cible),
      date_reelle: data.date_reelle ? new Date(data.date_reelle) : null,
      statut: data.statut ?? "Planifié",
      livrables: data.livrables ?? "",
      commentaire: data.commentaire ?? "",
    },
  });
  await recalculateChantierProgress(data.chantierId);
  revalidatePath("/");
  revalidatePath("/jalons");
  revalidatePath(`/chantiers/${data.chantierId}`);
}

export async function updateJalon(
  id: string,
  data: {
    phase: string;
    nom: string;
    description?: string;
    ordre?: number;
    date_cible: string;
    date_reelle?: string | null;
    statut: string;
    livrables?: string;
    commentaire?: string;
  }
) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier");
  const jalon = await prisma.jalon.update({
    where: { id },
    data: {
      phase: data.phase,
      nom: data.nom,
      description: data.description ?? "",
      ordre: data.ordre ?? 0,
      date_cible: new Date(data.date_cible),
      date_reelle: data.date_reelle ? new Date(data.date_reelle) : null,
      statut: data.statut,
      livrables: data.livrables ?? "",
      commentaire: data.commentaire ?? "",
    },
  });
  await recalculateChantierProgress(jalon.chantierId);
  revalidatePath("/");
  revalidatePath("/jalons");
  revalidatePath(`/chantiers/${jalon.chantierId}`);
}

export async function deleteJalon(id: string) {
  await requireRole("Admin", "Programme_Office");
  const jalon = await prisma.jalon.delete({ where: { id } });
  await recalculateChantierProgress(jalon.chantierId);
  revalidatePath("/");
  revalidatePath("/jalons");
  revalidatePath(`/chantiers/${jalon.chantierId}`);
}

export async function applyJalonTemplate(chantierId: string) {
  await requireChantierAccess(chantierId);
  const { JALON_TEMPLATES, calculateDateCible } = await import("@/lib/jalon-labels");

  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    select: { date_debut: true, date_fin: true, _count: { select: { jalons: true } } },
  });
  if (!chantier) throw new Error("Chantier non trouvé");
  if (chantier._count.jalons > 0) throw new Error("Des jalons existent déjà pour ce chantier");

  // Use DB templates if available, fall back to hardcoded
  const dbTemplates = await prisma.jalonTemplate.findMany({ orderBy: [{ phase: "asc" }, { ordre: "asc" }] });
  const templates = dbTemplates.length > 0
    ? dbTemplates.map((t) => ({ phase: t.phase, nom: t.nom, ordre: t.ordre, offsetPct: t.offsetPct }))
    : JALON_TEMPLATES;

  const jalonsData = templates.map((t) => ({
    chantierId,
    phase: t.phase,
    nom: t.nom,
    ordre: t.ordre,
    date_cible: calculateDateCible(chantier.date_debut, chantier.date_fin, t.offsetPct),
    statut: "Planifié",
    description: "",
    livrables: "",
    commentaire: "",
  }));

  await prisma.jalon.createMany({ data: jalonsData });
  await recalculateChantierProgress(chantierId);
  revalidatePath("/");
  revalidatePath("/jalons");
  revalidatePath(`/chantiers/${chantierId}`);
}

// ── Jalon Templates (Settings) ──────────────────────────

export async function getJalonTemplates() {
  await requireRole("Admin");
  return prisma.jalonTemplate.findMany({
    orderBy: [{ phase: "asc" }, { ordre: "asc" }],
  });
}

export async function createJalonTemplate(data: {
  phase: string;
  nom: string;
  ordre: number;
  offsetPct: number;
}) {
  await requireRole("Admin");
  await prisma.jalonTemplate.create({ data });
  revalidatePath("/settings");
}

export async function updateJalonTemplate(
  id: string,
  data: { nom: string; ordre: number; offsetPct: number }
) {
  await requireRole("Admin");
  await prisma.jalonTemplate.update({ where: { id }, data });
  revalidatePath("/settings");
}

export async function deleteJalonTemplate(id: string) {
  await requireRole("Admin");
  await prisma.jalonTemplate.delete({ where: { id } });
  revalidatePath("/settings");
}

// ── Adhérences (Dependencies) ────────────────────────

export async function getAdherences() {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  return prisma.adherence.findMany({
    where: chantierIds === "all" ? undefined : {
      OR: [
        { chantierSourceId: { in: chantierIds } },
        { chantierDependantId: { in: chantierIds } },
      ],
    },
    orderBy: { code: "asc" },
    include: {
      chantierSource: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
      chantierDependant: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
    },
  });
}

export async function getAdherencesForChantier(chantierId: string) {
  await requireAuth();
  const [asSource, asDependant] = await Promise.all([
    prisma.adherence.findMany({
      where: { chantierSourceId: chantierId },
      orderBy: { code: "asc" },
      include: {
        chantierSource: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
        chantierDependant: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
      },
    }),
    prisma.adherence.findMany({
      where: { chantierDependantId: chantierId },
      orderBy: { code: "asc" },
      include: {
        chantierSource: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
        chantierDependant: { select: { id: true, code: true, nom: true, domaine: true, statut: true } },
      },
    }),
  ]);
  return { asSource, asDependant };
}

export async function createAdherence(data: {
  code: string;
  chantierSourceId: string;
  chantierDependantId: string | null;
  chantierDependantLabel: string;
  type: string;
  domaine: string;
  description: string;
  criticite: string;
  statut: string;
  date_identification: string | null;
  date_resolution_prevue: string | null;
  responsable: string;
  contrat_interface: string;
  commentaires: string;
}) {
  await requireRole("Admin", "Programme_Office");
  await prisma.adherence.create({
    data: {
      code: data.code,
      chantierSourceId: data.chantierSourceId,
      chantierDependantId: data.chantierDependantId || null,
      chantierDependantLabel: data.chantierDependantLabel,
      type: data.type,
      domaine: data.domaine,
      description: data.description,
      criticite: data.criticite,
      statut: data.statut,
      date_identification: data.date_identification ? new Date(data.date_identification) : null,
      date_resolution_prevue: data.date_resolution_prevue ? new Date(data.date_resolution_prevue) : null,
      responsable: data.responsable,
      contrat_interface: data.contrat_interface,
      commentaires: data.commentaires,
    },
  });
  revalidatePath("/");
  revalidatePath("/adherences");
  revalidatePath("/chantiers");
}

export async function updateAdherence(
  id: string,
  data: {
    code: string;
    chantierSourceId: string;
    chantierDependantId: string | null;
    chantierDependantLabel: string;
    type: string;
    domaine: string;
    description: string;
    criticite: string;
    statut: string;
    date_identification: string | null;
    date_resolution_prevue: string | null;
    responsable: string;
    contrat_interface: string;
    commentaires: string;
  }
) {
  await requireRole("Admin", "Programme_Office");
  await prisma.adherence.update({
    where: { id },
    data: {
      code: data.code,
      chantierSourceId: data.chantierSourceId,
      chantierDependantId: data.chantierDependantId || null,
      chantierDependantLabel: data.chantierDependantLabel,
      type: data.type,
      domaine: data.domaine,
      description: data.description,
      criticite: data.criticite,
      statut: data.statut,
      date_identification: data.date_identification ? new Date(data.date_identification) : null,
      date_resolution_prevue: data.date_resolution_prevue ? new Date(data.date_resolution_prevue) : null,
      responsable: data.responsable,
      contrat_interface: data.contrat_interface,
      commentaires: data.commentaires,
    },
  });
  revalidatePath("/");
  revalidatePath("/adherences");
  revalidatePath("/chantiers");
}

export async function deleteAdherence(id: string) {
  await requireRole("Admin", "Programme_Office");
  await prisma.adherence.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/adherences");
  revalidatePath("/chantiers");
}

export async function getNextAdherenceCode() {
  await requireAuth();
  const last = await prisma.adherence.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });
  if (!last) return "ADH-001";
  const num = parseInt(last.code.replace("ADH-", ""), 10) + 1;
  return `ADH-${String(num).padStart(3, "0")}`;
}

export async function getJalonStats() {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  const scope = chantierIds === "all" ? {} : { chantierId: { in: chantierIds } };
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const [total, atteints, enRetard, aVenir] = await Promise.all([
    prisma.jalon.count({ where: { ...scope } }),
    prisma.jalon.count({ where: { ...scope, statut: "Atteint" } }),
    prisma.jalon.count({
      where: { ...scope, date_cible: { lt: now }, statut: { notIn: ["Atteint", "Annulé"] } },
    }),
    prisma.jalon.count({
      where: {
        ...scope,
        date_cible: { gte: now, lte: in30Days },
        statut: { notIn: ["Atteint", "Annulé"] },
      },
    }),
  ]);

  return {
    total,
    atteints,
    enRetard,
    aVenir,
    tauxRealisation: total > 0 ? Math.round((atteints / total) * 100) : 0,
  };
}

// ── Consultation Question CRUD ──────────────────────

export async function getConsultationQuestions(chantierId?: string) {
  const session = await requireAuth();
  const chantierIds = await getUserChantierIds(session);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (chantierId) where.chantierId = chantierId;
  else if (chantierIds !== "all") where.chantierId = { in: chantierIds };
  return prisma.consultationQuestion.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { chantier: { select: { id: true, code: true, nom: true } } },
  });
}

export async function createConsultationQuestion(data: {
  chantierId: string;
  dossier_ref: string;
  question: string;
  categorie: string;
  priorite: string;
  statut: string;
  remontee_par: string;
  affectee_a: string;
  echeance: string | null;
  resolution: string;
}) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier");
  await prisma.consultationQuestion.create({
    data: {
      chantierId: data.chantierId,
      dossier_ref: data.dossier_ref,
      question: data.question,
      categorie: data.categorie,
      priorite: data.priorite,
      statut: data.statut,
      remontee_par: data.remontee_par,
      affectee_a: data.affectee_a,
      echeance: data.echeance ? new Date(data.echeance) : null,
      resolution: data.resolution,
    },
  });
  revalidatePath("/consultation-backlog");
  revalidatePath("/chantiers");
  revalidatePath("/");
}

export async function updateConsultationQuestion(
  id: string,
  data: {
    chantierId: string;
    dossier_ref: string;
    question: string;
    categorie: string;
    priorite: string;
    statut: string;
    remontee_par: string;
    affectee_a: string;
    echeance: string | null;
    resolution: string;
  }
) {
  await requireRole("Admin", "Programme_Office", "PMO_Chantier");
  if (data.statut === "Résolue" && !data.resolution.trim()) {
    throw new Error("La résolution est obligatoire lorsque le statut est 'Résolue'.");
  }
  await prisma.consultationQuestion.update({
    where: { id },
    data: {
      chantierId: data.chantierId,
      dossier_ref: data.dossier_ref,
      question: data.question,
      categorie: data.categorie,
      priorite: data.priorite,
      statut: data.statut,
      remontee_par: data.remontee_par,
      affectee_a: data.affectee_a,
      echeance: data.echeance ? new Date(data.echeance) : null,
      resolution: data.resolution,
    },
  });
  revalidatePath("/consultation-backlog");
  revalidatePath("/chantiers");
  revalidatePath("/");
}

export async function deleteConsultationQuestion(id: string) {
  await requireRole("Admin", "Programme_Office");
  await prisma.consultationQuestion.delete({ where: { id } });
  revalidatePath("/consultation-backlog");
  revalidatePath("/chantiers");
  revalidatePath("/");
}

// ── Dashboard CTP / CTR ─────────────────────────────

export async function getDashboardCTP(month: number, year: number) {
  await requireRole("Admin", "Programme_Office");
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);

  const [chantiers, raids, adherences, saisiesTemps, jalons, ressources] = await Promise.all([
    prisma.chantier.findMany({
      include: {
        membres: {
          select: {
            is_directeur: true,
            charge_pourcentage: true,
            ressourceId: true,
            ressource: { select: { nom_complet: true } },
          },
        },
        jalons: { select: { phase: true, statut: true, date_cible: true } },
      },
    }),
    prisma.raid.findMany({ include: { chantier: { select: { code: true, nom: true } } } }),
    prisma.adherence.findMany(),
    prisma.saisieTemps.findMany({
      where: { date_lundi: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.jalon.findMany(),
    prisma.ressource.findMany({ where: { actif: true } }),
  ]);

  const totalChantiers = chantiers.length;
  const activeChantiers = chantiers.filter((c) => c.statut !== "Clôturé" && c.statut !== "Non démarré");
  const avgAvancement = totalChantiers > 0
    ? Math.round(chantiers.reduce((s, c) => s + c.avancement, 0) / totalChantiers)
    : 0;

  // Risks
  const openRisks = raids.filter((r) => r.type === "Risque" && r.statut !== "Clos");
  const majorRisks = openRisks.filter(
    (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 12
  );
  const blockerRisks = openRisks.filter(
    (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 20
  );

  // SPI calculation: ratio of jalons completed on time vs total due by period end
  const jalonsDueByPeriod = jalons.filter((j) => new Date(j.date_cible) <= periodEnd);
  const jalonsCompleted = jalonsDueByPeriod.filter((j) => j.statut === "Atteint");
  const spi = jalonsDueByPeriod.length > 0
    ? Number((jalonsCompleted.length / jalonsDueByPeriod.length).toFixed(2))
    : 1.0;

  // CPI calculation: budget planned vs consumed (time-based approximation)
  const totalBudgetMAD = chantiers.reduce((s, c) => s + c.budgetTotalMAD, 0);
  const totalJoursConsommes = saisiesTemps.reduce((s, st) => s + st.jours_travailles, 0);
  const totalJoursPlanned = chantiers.reduce((s, c) => s + c.budgetJH, 0);
  const cpi = totalJoursConsommes > 0 && totalJoursPlanned > 0
    ? Number((totalJoursPlanned > 0 ? (totalJoursPlanned * (avgAvancement / 100)) / totalJoursConsommes : 1).toFixed(2))
    : 1.0;

  // Go-live rate: chantiers clôturés vs total
  const clotured = chantiers.filter((c) => c.statut === "Clôturé").length;
  const goLiveRate = totalChantiers > 0 ? Math.round((clotured / totalChantiers) * 100) : 0;

  // Go-live target for current year
  const goLiveTargetYear = chantiers.filter(
    (c) => new Date(c.date_fin).getFullYear() === year
  );
  const goLiveTargetAchieved = goLiveTargetYear.filter((c) => c.statut === "Clôturé").length;
  const goLiveTargetPct = goLiveTargetYear.length > 0
    ? Math.round((goLiveTargetAchieved / goLiveTargetYear.length) * 100)
    : 0;

  // Budget consumption
  const budgetConsumed = saisiesTemps.reduce((s, st) => s + st.jours_travailles, 0);
  // Approximate cost from saisie temps (would need TJM, but use ratio of JH for now)

  // Top risks for table
  const topRisks = majorRisks
    .sort((a, b) => (scoreCriticite(b.impact!, b.probabilite!) - scoreCriticite(a.impact!, a.probabilite!)))
    .slice(0, 5)
    .map((r) => ({
      chantier: r.chantier ? `${r.chantier.code} - ${r.chantier.nom}` : "N/A",
      description: r.intitule,
      mitigation: r.mitigation,
      responsable: r.responsable,
      echeance: r.date_echeance ? r.date_echeance.toISOString() : null,
    }));

  // Pending decisions
  const pendingDecisions = raids
    .filter((r) => r.type === "Décision" && r.statut === "En attente")
    .slice(0, 5)
    .map((r) => ({
      sujet: r.intitule,
      enjeu: r.description,
      responsable: r.responsable,
      chantier: r.chantier ? `${r.chantier.code}` : "N/A",
    }));

  return {
    periode: `${new Date(year, month - 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
    avancement: avgAvancement,
    nbRisques: openRisks.length,
    spi,
    cpi,
    goLiveRate,
    goLiveTargetPct,
    goLiveTargetYear: year,
    majeurs: majorRisks.length,
    bloquants: blockerRisks.length,
    totalBudgetMAD,
    topRisks,
    pendingDecisions,
    budgetConsumed: totalJoursConsommes,
    budgetJHTotal: totalJoursPlanned,
  };
}

export async function getDashboardCTR(startDate: string, endDate: string) {
  await requireRole("Admin", "Programme_Office");
  const periodStart = new Date(startDate);
  const periodEnd = new Date(endDate);
  periodEnd.setHours(23, 59, 59);

  const [chantiers, raids, adherences, saisiesTemps, jalons, ressources, membres] = await Promise.all([
    prisma.chantier.findMany({
      include: {
        membres: {
          select: {
            is_directeur: true,
            ressourceId: true,
            charge_pourcentage: true,
            ressource: { select: { nom_complet: true } },
          },
        },
        jalons: { select: { phase: true, statut: true, date_cible: true } },
      },
    }),
    prisma.raid.findMany({ include: { chantier: { select: { code: true, nom: true } } } }),
    prisma.adherence.findMany(),
    prisma.saisieTemps.findMany({
      where: { date_lundi: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.jalon.findMany(),
    prisma.ressource.findMany({ where: { actif: true } }),
    prisma.membreEquipe.findMany(),
  ]);

  const totalChantiers = chantiers.length;
  const avgAvancement = totalChantiers > 0
    ? Math.round(chantiers.reduce((s, c) => s + c.avancement, 0) / totalChantiers)
    : 0;

  // Risks
  const openRisks = raids.filter((r) => r.type === "Risque" && r.statut !== "Clos");
  const majorRisks = openRisks.filter(
    (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 12
  );
  const blockerRisks = openRisks.filter(
    (r) => r.probabilite && r.impact && scoreCriticite(r.impact, r.probabilite) >= 20
  );

  // SPI
  const jalonsDueByPeriod = jalons.filter((j) => new Date(j.date_cible) <= periodEnd);
  const jalonsCompleted = jalonsDueByPeriod.filter((j) => j.statut === "Atteint");
  const spi = jalonsDueByPeriod.length > 0
    ? Number((jalonsCompleted.length / jalonsDueByPeriod.length).toFixed(2))
    : 1.0;

  // CPI
  const totalJoursConsommes = saisiesTemps.reduce((s, st) => s + st.jours_travailles, 0);
  const totalJoursPlanned = chantiers.reduce((s, c) => s + c.budgetJH, 0);
  const cpi = totalJoursConsommes > 0 && totalJoursPlanned > 0
    ? Number(((totalJoursPlanned * (avgAvancement / 100)) / totalJoursConsommes).toFixed(2))
    : 1.0;

  // Adherence au planning FDR: jalons on time / total jalons due
  const jalonsOnTime = jalonsDueByPeriod.filter((j) => {
    if (j.statut === "Atteint") return true;
    if (j.statut === "En cours" || j.statut === "Planifié") {
      return new Date(j.date_cible) >= new Date();
    }
    return false;
  });
  const adherencePlanning = jalonsDueByPeriod.length > 0
    ? Math.round((jalonsOnTime.length / jalonsDueByPeriod.length) * 100)
    : 100;

  // Staffing rate: all team members must be linked to a Ressource
  const totalSlots = membres.length;
  const staffedSlots = totalSlots;
  const staffingRate = totalSlots > 0 ? 100 : 0;

  // Top 5 chantiers to watch (lowest SPI, active)
  const chantierMetrics = chantiers
    .filter((c) => c.statut !== "Clôturé" && c.statut !== "Non démarré")
    .map((c) => {
      const cJalons = c.jalons || [];
      const due = cJalons.filter((j) => new Date(j.date_cible) <= periodEnd);
      const completed = due.filter((j) => j.statut === "Atteint");
      const cSpi = due.length > 0 ? Number((completed.length / due.length).toFixed(2)) : 1.0;
      // Determine current phase
      const phaseOrder = ["Précadrage", "Cadrage", "Exécution", "Clôture"];
      let currentPhase = "—";
      for (const p of phaseOrder) {
        const pJalons = cJalons.filter((j) => j.phase === p);
        if (pJalons.some((j) => j.statut === "En cours" || j.statut === "Atteint")) {
          currentPhase = p;
        }
      }
      // Meteo based on SPI
      let meteo: "soleil" | "nuageux" | "orage" = "soleil";
      if (cSpi < 0.9) meteo = "orage";
      else if (cSpi < 1.0) meteo = "nuageux";
      // Tendance (simplified: based on SPI vs 1)
      const tendance: "hausse" | "baisse" = cSpi >= 1.0 ? "hausse" : "baisse";
      return {
        code: c.code,
        nom: c.nom,
        phase: currentPhase,
        avancement: c.avancement,
        spi: cSpi,
        meteo,
        tendance,
      };
    })
    .sort((a, b) => a.spi - b.spi)
    .slice(0, 5);

  // Top risks
  const topRisks = majorRisks
    .sort((a, b) => (scoreCriticite(b.impact!, b.probabilite!) - scoreCriticite(a.impact!, a.probabilite!)))
    .slice(0, 5)
    .map((r) => ({
      chantier: r.chantier ? `${r.chantier.code} - ${r.chantier.nom}` : "N/A",
      description: r.intitule,
      mitigation: r.mitigation,
      responsable: r.responsable,
      echeance: r.date_echeance ? r.date_echeance.toISOString() : null,
    }));

  const totalBudgetMAD = chantiers.reduce((s, c) => s + c.budgetTotalMAD, 0);

  return {
    periodeDebut: periodStart.toISOString(),
    periodeFin: periodEnd.toISOString(),
    avancement: avgAvancement,
    nbRisques: openRisks.length,
    spi,
    cpi,
    adherencePlanning,
    staffingRate,
    majeurs: majorRisks.length,
    bloquants: blockerRisks.length,
    totalBudgetMAD,
    topChantiers: chantierMetrics,
    topRisks,
    budgetConsumed: totalJoursConsommes,
    budgetJHTotal: totalJoursPlanned,
  };
}
