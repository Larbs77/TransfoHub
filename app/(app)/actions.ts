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
  requirePageAccess,
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
  assertCanManageComiteSeance,
  comiteListWhereForSession,
  comiteWritableWhereForSession,
} from "@/lib/comite-access";
import { isComiteNiveauOperationnel } from "@/lib/comite-niveau";
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
import {
  formatAffecteeADisplay,
  resolveChantierRoleTag,
  chantierRoleTagRank,
} from "@/lib/consultation-affectation";
import { isRaidClosed, isRaidOverdue, actionRequiresEcheance } from "@/lib/raid-labels";

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
  // Fiche chantier + Gantt chantier + rapport : même règle de périmètre
  // (all / assigned). Pas de requirePageAccess("/gantt") ici — le Gantt
  // chantier est un écran enfant de la fiche.
  await requireChantierAccess(id);
  return prisma.chantier.findUnique({
    where: { id },
    include: {
      raids: {
        orderBy: { createdAt: "desc" },
        include: {
          comite: true,
          chantier: { select: { id: true, code: true, nom: true } },
        },
      },
      rmds: { include: { rmd: true } },
      membres: {
        orderBy: [{ equipe: "asc" }, { role: "asc" }],
        include: membreEquipeInclude,
      },
      jalons: {
        orderBy: [{ phase: "asc" }, { ordre: "asc" }],
        include: {
          workstreams: {
            orderBy: { ordre: "asc" },
            include: {
              activites: { orderBy: { ordre: "asc" } },
            },
          },
        },
      },
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

const comiteSelectFields = {
  id: true,
  instance: true,
  numero: true,
  date: true,
  chantierId: true,
} as const;

export async function getComitesForSelect() {
  const session = await requireAuth();
  const where = await comiteListWhereForSession(session);
  return prisma.comite.findMany({
    where,
    orderBy: [{ instance: "asc" }, { date: "desc" }],
    select: comiteSelectFields,
  });
}

/** Committees the current user may attach a RAID to. */
export async function getComitesForRaidCreate(includeId?: string | null) {
  const session = await requireAuth();
  const where = await comiteWritableWhereForSession(session);
  const rows = await prisma.comite.findMany({
    where,
    orderBy: [{ instance: "asc" }, { date: "desc" }],
    select: comiteSelectFields,
  });
  if (includeId && !rows.some((r) => r.id === includeId)) {
    const extra = await prisma.comite.findUnique({
      where: { id: includeId },
      select: comiteSelectFields,
    });
    if (extra) rows.unshift(extra);
  }
  return rows;
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

  // Actions échues: échéance actualisée (fallback initiale) dépassée
  const overdueActionsList = activeActions.filter((a) =>
    isRaidOverdue(
      a.statut,
      a.date_echeance_actualisee,
      a.date_echeance,
      now
    )
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
  const overdueActionsList = activeActions.filter((a) =>
    isRaidOverdue(a.statut, a.date_echeance_actualisee, a.date_echeance, now)
  );
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
  date_echeance_actualisee: Date | null;
  date_fin_reelle: Date | null;
  chantierId: string | null;
  chantierCode: string | null;
  chantierNom: string | null;
  chantier: { id: string; code: string; nom: string } | null;
  impact: number | null;
  probabilite: number | null;
  responsableRessourceId: string | null;
  equipeId?: string | null;
  comiteId: string | null;
  comite: { id: string; instance: string; numero: number; date: Date } | null;
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
      comite: true,
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
    date_echeance_actualisee: r.date_echeance_actualisee,
    date_fin_reelle: r.date_fin_reelle,
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
    comite: r.comite
      ? {
          id: r.comite.id,
          instance: r.comite.instance,
          numero: r.comite.numero,
          date: r.comite.date,
        }
      : null,
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
  const myActionsOverdue = myActionsOpen.filter((a) =>
    isRaidOverdue(a.statut, a.date_echeance_actualisee, a.date_echeance, now)
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
        statut: { notIn: ["Clôturé", "Abandonné", "NA", "Doublon"] },
        OR: [
          { date_echeance_actualisee: { lt: now } },
          {
            date_echeance_actualisee: null,
            date_echeance: { lt: now },
          },
        ],
      },
      orderBy: [
        { date_echeance_actualisee: "asc" },
        { date_echeance: "asc" },
      ],
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
    date: a.date_echeance_actualisee ?? a.date_echeance,
  }));

  const qaAlerts = criticalQuestions.map((q) => ({
    id: q.id,
    type: "qa_critique_echue" as const,
    message: `Q&A critique ouverte depuis ${seuilQaHeures}h+ : ${q.question.substring(0, 60)}${q.question.length > 60 ? "…" : ""}`,
    detail: `${q.chantier.code} - ${q.chantier.nom}`,
    responsable: formatAffecteeADisplay(q.affectee_a),
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
  /** Échéance initiale (figée ensuite) — aussi copiée en actualisée à la création */
  date_echeance: string | null;
  date_echeance_actualisee?: string | null;
  commentaires: string;
  comiteId: string | null;
}) {
  let chantierId = data.chantierId || null;
  if (data.comiteId) {
    const comite = await prisma.comite.findUnique({
      where: { id: data.comiteId },
      select: { chantierId: true, instance: true },
    });
    if (!comite) throw new Error("Comité introuvable.");
    if (comite.chantierId) chantierId = comite.chantierId;
    const param = await prisma.comiteParametre.findUnique({
      where: { name: comite.instance },
      select: { niveau: true },
    });
    const sessionForComite = await requireAuth();
    await assertCanManageComiteSeance(sessionForComite, {
      niveau: param?.niveau ?? "gouvernance",
      chantierId: comite.chantierId,
    });
  }
  // Permission driven by AppRole.raid_create_scope (not legacy role list)
  const session = await requireRaidCreateAccess(chantierId);
  const actor = await getActorDisplay(session);
  const teamAssign = await resolveRaidEquipeId({
    responsableRessourceId: data.responsableRessourceId || null,
    chantierId,
  });
  const code = await allocateNextRaidCode(data.type);
  if (
    data.type === "Action" &&
    actionRequiresEcheance(data.statut) &&
    !data.date_echeance
  ) {
    throw new Error(
      "Une date d'échéance est obligatoire dès que l'action n'est plus « A planifier »."
    );
  }
  const echeanceInitiale = data.date_echeance ? new Date(data.date_echeance) : null;
  // À la création : actualisée = initiale (sauf override explicite)
  const echeanceActu = data.date_echeance_actualisee
    ? new Date(data.date_echeance_actualisee)
    : echeanceInitiale;
  const closedOnCreate = isRaidClosed(data.statut);
  const created = await prisma.raid.create({
    data: {
      code,
      type: data.type,
      intitule: data.intitule,
      description: data.description,
      categorie: data.categorie,
      chantierId,
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
      date_echeance: echeanceInitiale,
      date_echeance_actualisee: echeanceActu,
      date_fin_reelle: closedOnCreate ? new Date() : null,
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
    /** Ignoré en update : échéance initiale figée */
    date_echeance?: string | null;
    /** Seule échéance modifiable après création */
    date_echeance_actualisee?: string | null;
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
      date_echeance: true,
      date_echeance_actualisee: true,
      date_fin_reelle: true,
    },
  });
  if (!existing) throw new Error("Entrée RAID introuvable.");

  // Edit form: scope « tous », assignee, or DC / suppléant / PMO du chantier lié
  if (!(await canEditRaidForm(session, existing))) {
    throw new Error(
      "Modification non autorisée : réservée à l'assigné, aux rôles « tous les chantiers », ou au Directeur / Suppléant / PMO du chantier lié."
    );
  }

  let chantierId = data.chantierId || null;
  if (data.comiteId) {
    const linkedComite = await prisma.comite.findUnique({
      where: { id: data.comiteId },
      select: { chantierId: true },
    });
    if (linkedComite?.chantierId) chantierId = linkedComite.chantierId;
  }

  const actor = await getActorDisplay(session);
  const teamAssign = await resolveRaidEquipeId({
    responsableRessourceId: data.responsableRessourceId || null,
    chantierId,
  });

  const becomingClosed =
    isRaidClosed(data.statut) && !isRaidClosed(existing.statut);
  const reopening =
    !isRaidClosed(data.statut) && isRaidClosed(existing.statut);

  const firstInitiale =
    !existing.date_echeance && data.date_echeance
      ? new Date(data.date_echeance)
      : null;
  const initialeFinale = existing.date_echeance ?? firstInitiale;
  if (
    data.type === "Action" &&
    actionRequiresEcheance(data.statut) &&
    !initialeFinale
  ) {
    throw new Error(
      "Une date d'échéance est obligatoire dès que l'action n'est plus « A planifier »."
    );
  }
  const actuFinale = data.date_echeance_actualisee
    ? new Date(data.date_echeance_actualisee)
    : firstInitiale;

  // code immuable ; échéance initiale figée dès qu'elle est renseignée
  await prisma.raid.update({
    where: { id },
    data: {
      type: data.type,
      intitule: data.intitule,
      description: data.description,
      categorie: data.categorie,
      chantierId,
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
      ...(firstInitiale ? { date_echeance: firstInitiale } : {}),
      date_echeance_actualisee: actuFinale,
      date_fin_reelle: becomingClosed
        ? existing.date_fin_reelle ?? new Date()
        : reopening
          ? null
          : existing.date_fin_reelle,
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

export async function deleteRaid(id: string, options?: { motif?: string }) {
  const session = await requireAuth();
  // Delete: only rôles with périmètre chantiers = « tous les chantiers »
  if (!(await canDeleteRaid(session))) {
    throw new Error(
      "Suppression non autorisée : réservée aux rôles avec le périmètre « tous les chantiers »."
    );
  }
  const motif = options?.motif?.trim() ?? "";
  if (!motif) {
    throw new Error("Le motif de suppression est obligatoire.");
  }
  const raid = await prisma.raid.findUnique({
    where: { id },
    select: { id: true, code: true, intitule: true },
  });
  if (!raid) throw new Error("Élément RAID introuvable.");
  const actor = await getActorDisplay(session);
  await writeRaidAudit({
    raidId: raid.id,
    action: "deleted",
    summary: `${raid.code} « ${raid.intitule} » supprimé par ${actor.actorName} — motif : ${motif}`,
    newValue: motif,
    actorUserId: actor.actorUserId,
    actorName: actor.actorName,
    actorRessourceId: actor.actorRessourceId,
  });
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

export async function getRessourceChargeTotale(
  ressourceId: string,
  excludeChantierId?: string
) {
  await requireAuth();
  const membres = await prisma.membreEquipe.findMany({
    where: {
      ressourceId,
      ...(excludeChantierId ? { chantierId: { not: excludeChantierId } } : {}),
    },
    select: {
      charge_pourcentage: true,
      chantier: { select: { code: true, nom: true } },
    },
  });
  const total = membres.reduce((s, m) => s + (m.charge_pourcentage ?? 0), 0);
  return {
    total,
    details: membres.map((m) => ({
      code: m.chantier.code,
      nom: m.chantier.nom,
      charge: m.charge_pourcentage ?? 0,
    })),
  };
}

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
  const session = await requireRole("Admin", "Programme_Office", "PMO_Chantier");
  const where = await comiteListWhereForSession(session);
  return prisma.comite.findMany({
    where,
    orderBy: [{ instance: "asc" }, { date: "desc" }],
    include: {
      chantier: { select: { id: true, code: true, nom: true } },
      raids: {
        orderBy: { createdAt: "desc" },
        include: { chantier: { select: { id: true, code: true, nom: true } } },
      },
    },
  });
}

export async function getNextComiteNumero(
  instance: string,
  chantierId?: string | null
) {
  await requireAuth();
  const name = instance.trim();
  if (!name) return 1;
  const last = await prisma.comite.findFirst({
    where: chantierId
      ? { instance: name, chantierId }
      : { instance: name, chantierId: null },
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
  return param;
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
  chantierId?: string | null;
}) {
  const session = await requirePageAccess("/comites");
  const param = await assertValidComiteInstance(data.instance, {
    requireActive: true,
  });
  const operationnel = isComiteNiveauOperationnel(param.niveau);
  const chantierId = operationnel ? data.chantierId || null : null;
  if (operationnel) {
    if (!chantierId) {
      throw new Error("Sélectionnez un chantier pour ce comité opérationnel.");
    }
    await requireChantierAccess(chantierId);
  }
  await assertCanManageComiteSeance(session, {
    niveau: param.niveau,
    chantierId,
  });
  await prisma.comite.create({
    data: {
      instance: param.name,
      numero: data.numero,
      date: new Date(data.date),
      heure_casablanca: data.heure_casablanca,
      heure_belgique: data.heure_belgique,
      statut: data.statut,
      ordre_du_jour: data.ordre_du_jour,
      invitation_envoyee: data.invitation_envoyee,
      chantierId,
    },
  });
  revalidatePath("/comites");
  if (chantierId) revalidatePath(`/chantiers/${chantierId}`);
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
    chantierId?: string | null;
  }
) {
  const session = await requirePageAccess("/comites");
  const current = await prisma.comite.findUnique({
    where: { id },
    select: { instance: true, chantierId: true },
  });
  if (!current) throw new Error("Comité introuvable.");
  const param = await assertValidComiteInstance(data.instance, {
    requireActive: current.instance !== data.instance.trim(),
  });
  const operationnel = isComiteNiveauOperationnel(param.niveau);
  const chantierId = operationnel ? data.chantierId || current.chantierId : null;
  if (operationnel && !chantierId) {
    throw new Error("Sélectionnez un chantier pour ce comité opérationnel.");
  }
  if (chantierId) await requireChantierAccess(chantierId);
  await assertCanManageComiteSeance(session, {
    niveau: param.niveau,
    chantierId,
  });
  await prisma.comite.update({
    where: { id },
    data: {
      instance: param.name,
      numero: data.numero,
      date: new Date(data.date),
      heure_casablanca: data.heure_casablanca,
      heure_belgique: data.heure_belgique,
      statut: data.statut,
      ordre_du_jour: data.ordre_du_jour,
      invitation_envoyee: data.invitation_envoyee,
      chantierId,
    },
  });
  revalidatePath("/comites");
  if (chantierId) revalidatePath(`/chantiers/${chantierId}`);
}

export async function deleteComite(id: string) {
  const session = await requirePageAccess("/comites");
  const current = await prisma.comite.findUnique({
    where: { id },
    select: { instance: true, chantierId: true },
  });
  if (!current) throw new Error("Comité introuvable.");
  const param = await prisma.comiteParametre.findUnique({
    where: { name: current.instance },
  });
  await assertCanManageComiteSeance(session, {
    niveau: param?.niveau ?? "gouvernance",
    chantierId: current.chantierId,
  });
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

  const payload = {
    seuil_relance_jours: data.seuil_relance_jours,
    seuil_qa_critique_heures: data.seuil_qa_critique_heures,
    poids_precadrage: data.poids_precadrage,
    poids_cadrage: data.poids_cadrage,
    poids_execution: data.poids_execution,
    poids_cloture: data.poids_cloture,
  };

  await prisma.settings.upsert({
    where: { id: 1 },
    update: payload,
    create: {
      id: 1,
      ...payload,
      planning_detail_gouvernance: "libre",
    },
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

/** Gouvernance Workstream / Activité (planning chantier) — bloc Paramètres dédié. */
export async function updatePlanningDetailGouvernance(value: string) {
  await requireRole("Admin");
  const { normalizePlanningDetailGouvernance } = await import(
    "@/lib/planning-coherence"
  );
  const gouvernance = normalizePlanningDetailGouvernance(value);

  const existing = await prisma.settings.findFirst({ where: { id: 1 } });
  if (existing) {
    await prisma.settings.update({
      where: { id: 1 },
      data: { planning_detail_gouvernance: gouvernance },
    });
  } else {
    await prisma.settings.create({
      data: {
        id: 1,
        planning_detail_gouvernance: gouvernance,
      },
    });
  }

  revalidatePath("/settings");
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
          date_echeance_actualisee: true,
          date_fin_reelle: true,
          chantierId: true,
          chantier: { select: { code: true, nom: true } },
        },
      },
    },
  });
}

export async function getRessourcesForSelect() {
  await requireAuth();
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

export async function getPortfolioGanttData() {
  const session = await requirePageAccess("/gantt");
  const chantierIds = await getUserChantierIds(session);

  return prisma.chantier.findMany({
    where: {
      ...(chantierIds !== "all" ? { id: { in: chantierIds } } : {}),
      jalons: { some: {} },
    },
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      nom: true,
      domaine: true,
      date_debut: true,
      date_fin: true,
      jalons: {
        orderBy: [{ phase: "asc" }, { ordre: "asc" }],
        select: {
          id: true,
          phase: true,
          nom: true,
          ordre: true,
          date_debut: true,
          date_cible: true,
          statut: true,
          workstreams: {
            orderBy: { ordre: "asc" },
            select: {
              id: true,
              nom: true,
              ordre: true,
              date_debut: true,
              date_fin: true,
              statut: true,
              activites: {
                orderBy: { ordre: "asc" },
                select: {
                  id: true,
                  nom: true,
                  ordre: true,
                  date_debut: true,
                  date_fin: true,
                  statut: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export type JalonMutationResult =
  | { mode: "direct" }
  | { mode: "validation"; requestId: string };

function jalonPayloadForWorkflow(data: {
  chantierId?: string;
  phase: string;
  nom: string;
  description?: string;
  ordre?: number;
  date_debut?: string | null;
  date_cible: string;
  date_reelle?: string | null;
  statut?: string;
  livrables?: string;
  commentaire?: string;
}) {
  return {
    ...(data.chantierId ? { chantierId: data.chantierId } : {}),
    phase: data.phase,
    nom: data.nom,
    description: data.description ?? "",
    ordre: data.ordre ?? 0,
    date_debut: data.date_debut ?? null,
    date_cible: data.date_cible,
    date_reelle: data.date_reelle ?? null,
    statut: data.statut ?? "Planifié",
    livrables: data.livrables ?? "",
    commentaire: data.commentaire ?? "",
  };
}

function jalonSnapshot(j: {
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
}) {
  return {
    id: j.id,
    chantierId: j.chantierId,
    phase: j.phase,
    nom: j.nom,
    description: j.description,
    ordre: j.ordre,
    date_debut: j.date_debut
      ? j.date_debut.toISOString().slice(0, 10)
      : null,
    date_cible: j.date_cible.toISOString().slice(0, 10),
    date_reelle: j.date_reelle
      ? j.date_reelle.toISOString().slice(0, 10)
      : null,
    statut: j.statut,
    livrables: j.livrables,
    commentaire: j.commentaire,
  };
}

export async function createJalon(
  data: {
    chantierId: string;
    phase: string;
    nom: string;
    description?: string;
    ordre?: number;
    date_debut?: string | null;
    date_cible: string;
    date_reelle?: string | null;
    statut?: string;
    livrables?: string;
    commentaire?: string;
  },
  options?: { motif?: string }
): Promise<JalonMutationResult> {
  const session = await requireAuth();
  await requireChantierAccess(data.chantierId);
  if (
    data.date_debut &&
    new Date(data.date_debut).getTime() > new Date(data.date_cible).getTime()
  ) {
    throw new Error(
      "La date de début du jalon doit être antérieure ou égale à sa date cible."
    );
  }

  const {
    getSessionJalonWorkflowCaps,
    modeForOperation,
    createWorkflowRequest,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");

  const caps = await getSessionJalonWorkflowCaps(session);
  const mode = modeForOperation(caps, WORKFLOW_OPERATION.CREATE);

  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à créer un jalon.");
  }

  const payload = jalonPayloadForWorkflow({ ...data, chantierId: data.chantierId });

  const { buildJalonEntityLabel } = await import("@/lib/workflow-shared");

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.JALON,
      operation: WORKFLOW_OPERATION.CREATE,
      entityId: null,
      entityLabel: buildJalonEntityLabel(data.phase, data.nom),
      chantierId: data.chantierId,
      motif: options?.motif ?? "",
      oldValues: null,
      newValues: payload,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath("/workflow/historique");
    revalidatePath("/workflow/dashboard");
    revalidatePath(`/chantiers/${data.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  await prisma.jalon.create({
    data: {
      chantierId: data.chantierId,
      phase: data.phase,
      nom: data.nom,
      description: data.description ?? "",
      ordre: data.ordre ?? 0,
      date_debut: data.date_debut ? new Date(data.date_debut) : null,
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
  return { mode: "direct" };
}

function jalonDateKey(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export async function updateJalon(
  id: string,
  data: {
    phase: string;
    nom: string;
    description?: string;
    ordre?: number;
    date_debut?: string | null;
    date_cible: string;
    date_reelle?: string | null;
    statut: string;
    livrables?: string;
    commentaire?: string;
  },
  options?: { motif?: string }
): Promise<JalonMutationResult> {
  const session = await requireAuth();
  if (
    data.date_debut &&
    new Date(data.date_debut).getTime() > new Date(data.date_cible).getTime()
  ) {
    throw new Error(
      "La date de début du jalon doit être antérieure ou égale à sa date cible."
    );
  }
  const existing = await prisma.jalon.findUnique({ where: { id } });
  if (!existing) throw new Error("Jalon introuvable.");
  await requireChantierAccess(existing.chantierId);

  const {
    getSessionJalonWorkflowCaps,
    modeForOperation,
    createWorkflowRequest,
    createDirectOperationAudit,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");
  const { buildJalonEntityLabel } = await import("@/lib/workflow-shared");

  const caps = await getSessionJalonWorkflowCaps(session);
  const mode = modeForOperation(caps, WORKFLOW_OPERATION.UPDATE);

  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à modifier un jalon.");
  }

  // Phase is immutable on update
  const phase = existing.phase;
  const dateChanged =
    jalonDateKey(existing.date_debut) !== jalonDateKey(data.date_debut) ||
    jalonDateKey(existing.date_cible) !== jalonDateKey(data.date_cible);
  /** Passage à Atteint (depuis un autre statut) */
  const goingToAtteint =
    data.statut === "Atteint" && existing.statut !== "Atteint";
  /**
   * Mode VALIDATION : workflow si
   * - modification des dates planifiées, ou
   * - passage du statut à « Atteint »
   * Les autres champs s'appliquent immédiatement.
   */
  const requiresValidation =
    mode === "VALIDATION" && (dateChanged || goingToAtteint);
  const motif = options?.motif?.trim() ?? "";

  if (requiresValidation && !motif) {
    throw new Error(
      goingToAtteint && !dateChanged
        ? "Le motif de la demande est obligatoire pour demander le passage du jalon à « Atteint »."
        : dateChanged && !goingToAtteint
          ? "Le motif de la demande est obligatoire pour modifier les dates du jalon."
          : "Le motif de la demande est obligatoire pour cette modification (dates et/ou statut Atteint)."
    );
  }
  if (mode === "DIRECT" && !motif) {
    throw new Error("Le commentaire est obligatoire pour modifier un jalon.");
  }

  if (data.statut === "Atteint") {
    const { assertJalonCanBeAtteint } = await import(
      "@/lib/planning-status-assert"
    );
    await assertJalonCanBeAtteint(id);
  }

  const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");
  /** date_reelle : remplie si Atteint, sinon toujours vidée */
  const dateReelleYmd = resolvePlanningDateReelle({
    statut: data.statut,
    dateReelle: data.date_reelle,
    previousDateReelle: existing.date_reelle,
  });
  const dateReelleValue = dateReelleYmd
    ? new Date(dateReelleYmd + "T12:00:00.000Z")
    : null;

  // ── VALIDATION : champs sensibles en attente d'approbation ──
  if (requiresValidation) {
    // Appliquer tout de suite les champs non sensibles ;
    // conserver dates / Atteint (+ date réelle liée) tant que non approuvés.
    // Si on quitte Atteint (statut non Atteint) → vider date_reelle tout de suite.
    const partial = await prisma.jalon.update({
      where: { id },
      data: {
        phase,
        nom: data.nom,
        description: data.description ?? "",
        ordre: data.ordre ?? 0,
        livrables: data.livrables ?? "",
        commentaire: data.commentaire ?? "",
        statut: goingToAtteint ? existing.statut : data.statut,
        date_reelle: goingToAtteint
          ? existing.date_reelle
          : data.statut === "Atteint"
            ? dateReelleValue
            : null,
        date_debut: dateChanged
          ? existing.date_debut
          : data.date_debut
            ? new Date(data.date_debut)
            : null,
        date_cible: dateChanged
          ? existing.date_cible
          : new Date(data.date_cible),
      },
    });

    const afterSnapshot = jalonSnapshot(partial);
    const proposed = {
      ...afterSnapshot,
      date_debut: dateChanged
        ? jalonDateKey(data.date_debut) || null
        : afterSnapshot.date_debut,
      date_cible: dateChanged
        ? jalonDateKey(data.date_cible)
        : afterSnapshot.date_cible,
      statut: goingToAtteint ? "Atteint" : afterSnapshot.statut,
      date_reelle: goingToAtteint
        ? dateReelleYmd
        : afterSnapshot.date_reelle,
    };

    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.JALON,
      operation: WORKFLOW_OPERATION.UPDATE,
      entityId: id,
      entityLabel: buildJalonEntityLabel(partial.phase, partial.nom),
      chantierId: existing.chantierId,
      motif,
      oldValues: afterSnapshot,
      newValues: proposed,
      session,
    });

    await recalculateChantierProgress(existing.chantierId);
    revalidatePath("/");
    revalidatePath("/jalons");
    revalidatePath(`/chantiers/${existing.chantierId}`);
    revalidatePath("/workflow/demandes");
    revalidatePath("/workflow/historique");
    revalidatePath("/workflow/dashboard");
    return { mode: "validation", requestId: req.id };
  }

  // ── Direct apply (DIRECT, ou VALIDATION sans date ni passage Atteint) ──
  const snapshot = jalonSnapshot(existing);
  const newValues = jalonPayloadForWorkflow({
    ...data,
    phase,
    date_reelle: dateReelleYmd,
  });

  const jalon = await prisma.jalon.update({
    where: { id },
    data: {
      phase,
      nom: data.nom,
      description: data.description ?? "",
      ordre: data.ordre ?? 0,
      date_reelle: dateReelleValue,
      statut: data.statut,
      livrables: data.livrables ?? "",
      commentaire: data.commentaire ?? "",
      date_debut: data.date_debut ? new Date(data.date_debut) : null,
      date_cible: new Date(data.date_cible),
    },
  });

  // Audit trail only for true DIRECT-capability roles (comment provided)
  if (mode === "DIRECT") {
    await createDirectOperationAudit({
      entityType: WORKFLOW_ENTITY.JALON,
      operation: WORKFLOW_OPERATION.UPDATE,
      entityId: id,
      entityLabel: buildJalonEntityLabel(jalon.phase, jalon.nom),
      chantierId: jalon.chantierId,
      motif,
      oldValues: snapshot,
      newValues,
      session,
    });
  }

  await recalculateChantierProgress(jalon.chantierId);
  revalidatePath("/");
  revalidatePath("/jalons");
  revalidatePath(`/chantiers/${jalon.chantierId}`);
  revalidatePath("/workflow/historique");
  revalidatePath("/workflow/dashboard");
  return { mode: "direct" };
}

export async function deleteJalon(
  id: string,
  options?: { motif?: string }
): Promise<JalonMutationResult> {
  const session = await requireAuth();
  const existing = await prisma.jalon.findUnique({ where: { id } });
  if (!existing) throw new Error("Jalon introuvable.");
  await requireChantierAccess(existing.chantierId);

  const {
    getSessionJalonWorkflowCaps,
    modeForOperation,
    createWorkflowRequest,
    createDirectOperationAudit,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");

  const caps = await getSessionJalonWorkflowCaps(session);
  const mode = modeForOperation(caps, WORKFLOW_OPERATION.DELETE);

  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à supprimer un jalon.");
  }

  // Commentaire obligatoire (validation ou suppression directe)
  const motif = options?.motif?.trim() ?? "";
  if (!motif) {
    throw new Error(
      mode === "VALIDATION"
        ? "Le motif de la demande est obligatoire."
        : "Le commentaire est obligatoire pour supprimer un jalon."
    );
  }

  const { buildJalonEntityLabel } = await import("@/lib/workflow-shared");
  const deleteLabel = buildJalonEntityLabel(existing.phase, existing.nom);

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.JALON,
      operation: WORKFLOW_OPERATION.DELETE,
      entityId: id,
      entityLabel: deleteLabel,
      chantierId: existing.chantierId,
      motif,
      oldValues: jalonSnapshot(existing),
      newValues: null,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath("/workflow/historique");
    revalidatePath("/workflow/dashboard");
    revalidatePath(`/chantiers/${existing.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  const snapshot = jalonSnapshot(existing);
  const jalon = await prisma.jalon.delete({ where: { id } });
  await createDirectOperationAudit({
    entityType: WORKFLOW_ENTITY.JALON,
    operation: WORKFLOW_OPERATION.DELETE,
    entityId: jalon.id,
    entityLabel: deleteLabel,
    chantierId: jalon.chantierId,
    motif,
    oldValues: snapshot,
    newValues: null,
    session,
  });
  await recalculateChantierProgress(jalon.chantierId);
  revalidatePath("/");
  revalidatePath("/jalons");
  revalidatePath(`/chantiers/${jalon.chantierId}`);
  revalidatePath("/workflow/historique");
  revalidatePath("/workflow/dashboard");
  return { mode: "direct" };
}

/** Caps + pending requests for chantier jalons UI (+ workstreams / activités). */
export async function getJalonWorkflowUiState(chantierId: string) {
  const session = await requireAuth();
  await requireChantierAccess(chantierId);
  const {
    getSessionJalonWorkflowCaps,
    getPendingRequestsForEntities,
    WORKFLOW_ENTITY,
  } = await import("@/lib/workflow");
  const { normalizePlanningDetailGouvernance } = await import(
    "@/lib/planning-coherence"
  );

  const caps = await getSessionJalonWorkflowCaps(session);
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  const detailGouvernance = normalizePlanningDetailGouvernance(
    settings?.planning_detail_gouvernance
  );

  const jalons = await prisma.jalon.findMany({
    where: { chantierId },
    select: {
      id: true,
      workstreams: { select: { id: true, activites: { select: { id: true } } } },
    },
  });
  const jalonIds = jalons.map((j) => j.id);
  const wsIds = jalons.flatMap((j) => j.workstreams.map((w) => w.id));
  const actIds = jalons.flatMap((j) =>
    j.workstreams.flatMap((w) => w.activites.map((a) => a.id))
  );

  const [pendingJ, pendingWs, pendingAct] = await Promise.all([
    getPendingRequestsForEntities(WORKFLOW_ENTITY.JALON, jalonIds),
    getPendingRequestsForEntities(WORKFLOW_ENTITY.WORKSTREAM, wsIds),
    getPendingRequestsForEntities(WORKFLOW_ENTITY.ACTIVITE, actIds),
  ]);

  const pendingCreates = await prisma.workflowRequest.findMany({
    where: {
      entityType: {
        in: [
          WORKFLOW_ENTITY.JALON,
          WORKFLOW_ENTITY.WORKSTREAM,
          WORKFLOW_ENTITY.ACTIVITE,
        ],
      },
      operation: "create",
      chantierId,
      status: "EN_ATTENTE",
    },
    select: {
      id: true,
      entityId: true,
      entityType: true,
      operation: true,
      status: true,
      motif: true,
      requesterName: true,
      createdAt: true,
    },
  });

  const pendingByEntityId = Object.fromEntries(
    [...pendingJ, ...pendingWs, ...pendingAct]
      .filter((p) => p.entityId)
      .map((p) => [p.entityId as string, p])
  );

  return {
    caps,
    detailGouvernance,
    pendingByEntityId,
    pendingCreates,
  };
}

export async function applyJalonTemplate(chantierId: string) {
  const session = await requireAuth();
  await requireChantierAccess(chantierId);
  const { getSessionJalonWorkflowCaps, modeForOperation, WORKFLOW_OPERATION } =
    await import("@/lib/workflow");
  const caps = await getSessionJalonWorkflowCaps(session);
  // Bulk template apply only in DIRECT mode (no multi-request storm)
  if (modeForOperation(caps, WORKFLOW_OPERATION.CREATE) !== "DIRECT") {
    throw new Error(
      "L'application du modèle n'est disponible qu'en mode Direct pour la création de jalons."
    );
  }
  const { JALON_TEMPLATES, calculateDateCible } = await import("@/lib/jalon-labels");

  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    select: { date_debut: true, date_fin: true, _count: { select: { jalons: true } } },
  });
  if (!chantier) throw new Error("Chantier non trouvé");
  if (chantier._count.jalons > 0) throw new Error("Des jalons existent déjà pour ce chantier");

  // Use DB templates if available, fall back to hardcoded (jalons only)
  const dbTemplates = await prisma.jalonTemplate.findMany({
    orderBy: [{ phase: "asc" }, { ordre: "asc" }],
    include: {
      workstreams: {
        orderBy: { ordre: "asc" },
        include: { activites: { orderBy: { ordre: "asc" } } },
      },
    },
  });

  if (dbTemplates.length > 0) {
    for (const t of dbTemplates) {
      await prisma.jalon.create({
        data: {
          chantierId,
          phase: t.phase,
          nom: t.nom,
          ordre: t.ordre,
          date_cible: calculateDateCible(
            chantier.date_debut,
            chantier.date_fin,
            t.offsetPct
          ),
          statut: "Planifié",
          description: "",
          livrables: "",
          commentaire: "",
          workstreams: {
            create: t.workstreams.map((w) => ({
              nom: w.nom,
              ordre: w.ordre,
              description: w.description ?? "",
              statut: "Planifié",
              activites: {
                create: w.activites.map((a) => ({
                  nom: a.nom,
                  ordre: a.ordre,
                  description: a.description ?? "",
                  statut: "Planifié",
                })),
              },
            })),
          },
        },
      });
    }
  } else {
    const jalonsData = JALON_TEMPLATES.map((t) => ({
      chantierId,
      phase: t.phase,
      nom: t.nom,
      ordre: t.ordre,
      date_cible: calculateDateCible(
        chantier.date_debut,
        chantier.date_fin,
        t.offsetPct
      ),
      statut: "Planifié",
      description: "",
      livrables: "",
      commentaire: "",
    }));
    await prisma.jalon.createMany({ data: jalonsData });
  }

  await recalculateChantierProgress(chantierId);
  revalidatePath("/");
  revalidatePath("/jalons");
  revalidatePath(`/chantiers/${chantierId}`);
}

// ── Jalon Templates (Settings) — Phase → Jalon → Workstream → Activité ──

const jalonTemplateTreeInclude = {
  workstreams: {
    orderBy: { ordre: "asc" as const },
    include: {
      activites: { orderBy: { ordre: "asc" as const } },
    },
  },
};

export async function getJalonTemplates() {
  await requireRole("Admin");
  return prisma.jalonTemplate.findMany({
    orderBy: [{ phase: "asc" }, { ordre: "asc" }],
    include: jalonTemplateTreeInclude,
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

export async function createWorkstreamTemplate(data: {
  jalonTemplateId: string;
  nom: string;
  ordre: number;
  description?: string;
}) {
  await requireRole("Admin");
  const parent = await prisma.jalonTemplate.findUnique({
    where: { id: data.jalonTemplateId },
    select: { id: true },
  });
  if (!parent) throw new Error("Jalon template introuvable.");
  await prisma.workstreamTemplate.create({
    data: {
      jalonTemplateId: data.jalonTemplateId,
      nom: data.nom.trim(),
      ordre: data.ordre,
      description: data.description?.trim() ?? "",
    },
  });
  revalidatePath("/settings");
}

export async function updateWorkstreamTemplate(
  id: string,
  data: { nom: string; ordre: number; description?: string }
) {
  await requireRole("Admin");
  await prisma.workstreamTemplate.update({
    where: { id },
    data: {
      nom: data.nom.trim(),
      ordre: data.ordre,
      description: data.description?.trim() ?? "",
    },
  });
  revalidatePath("/settings");
}

export async function deleteWorkstreamTemplate(id: string) {
  await requireRole("Admin");
  await prisma.workstreamTemplate.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function createActiviteTemplate(data: {
  workstreamTemplateId: string;
  nom: string;
  ordre: number;
  description?: string;
}) {
  await requireRole("Admin");
  const parent = await prisma.workstreamTemplate.findUnique({
    where: { id: data.workstreamTemplateId },
    select: { id: true },
  });
  if (!parent) throw new Error("Workstream template introuvable.");
  await prisma.activiteTemplate.create({
    data: {
      workstreamTemplateId: data.workstreamTemplateId,
      nom: data.nom.trim(),
      ordre: data.ordre,
      description: data.description?.trim() ?? "",
    },
  });
  revalidatePath("/settings");
}

export async function updateActiviteTemplate(
  id: string,
  data: { nom: string; ordre: number; description?: string }
) {
  await requireRole("Admin");
  await prisma.activiteTemplate.update({
    where: { id },
    data: {
      nom: data.nom.trim(),
      ordre: data.ordre,
      description: data.description?.trim() ?? "",
    },
  });
  revalidatePath("/settings");
}

export async function deleteActiviteTemplate(id: string) {
  await requireRole("Admin");
  await prisma.activiteTemplate.delete({ where: { id } });
  revalidatePath("/settings");
}

/** Export référentiel template → Excel (.xlsx) base64. */
export async function exportJalonTemplateExcel(): Promise<{
  fileName: string;
  base64: string;
}> {
  await requireRole("Admin");
  const { buildTemplateExcelBase64 } = await import("@/lib/jalon-template-excel");

  const rows = await prisma.jalonTemplate.findMany({
    orderBy: [{ phase: "asc" }, { ordre: "asc" }],
    include: jalonTemplateTreeInclude,
  });

  const tree = rows.map((j) => ({
    id: j.id,
    phase: j.phase,
    nom: j.nom,
    ordre: j.ordre,
    offsetPct: j.offsetPct,
    workstreams: j.workstreams.map((w) => ({
      id: w.id,
      nom: w.nom,
      ordre: w.ordre,
      description: w.description,
      activites: w.activites.map((a) => ({
        id: a.id,
        nom: a.nom,
        ordre: a.ordre,
        description: a.description,
      })),
    })),
  }));

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    fileName: `template_planning_jalons_${stamp}.xlsx`,
    base64: buildTemplateExcelBase64(tree),
  };
}

/** Empty Excel model (example rows + instructions). */
export async function downloadJalonTemplateExcelModel(): Promise<{
  fileName: string;
  base64: string;
}> {
  await requireRole("Admin");
  const { buildEmptyTemplateExcelBase64 } = await import(
    "@/lib/jalon-template-excel"
  );
  return {
    fileName: "modele_template_planning_jalons.xlsx",
    base64: buildEmptyTemplateExcelBase64(),
  };
}

/** Dry-run parse of Excel template (no DB write). */
export async function previewJalonTemplateExcel(base64: string): Promise<{
  ok: boolean;
  issues: { row: number; message: string }[];
  stats: {
    jalonCount: number;
    workstreamCount: number;
    activiteCount: number;
    rowCount: number;
  };
  /** Fingerprint for confirm (re-parse on confirm). */
  fingerprint: string;
}> {
  await requireRole("Admin");
  const { parseTemplateExcelBuffer, base64ToUint8Array } = await import(
    "@/lib/jalon-template-excel"
  );
  const bytes = base64ToUint8Array(base64);
  const parsed = parseTemplateExcelBuffer(bytes);
  // Simple fingerprint = stats + first/last jalon names
  const fingerprint = [
    parsed.stats.jalonCount,
    parsed.stats.workstreamCount,
    parsed.stats.activiteCount,
    parsed.jalons[0]?.nom ?? "",
    parsed.jalons[parsed.jalons.length - 1]?.nom ?? "",
    parsed.issues.length,
  ].join("|");

  return {
    ok: parsed.ok,
    issues: parsed.issues.slice(0, 50),
    stats: parsed.stats,
    fingerprint,
  };
}

/**
 * Replace entire JalonTemplate référentiel from Excel.
 * Cascade deletes previous workstreams / activités.
 */
export async function confirmImportJalonTemplateExcel(base64: string): Promise<{
  ok: boolean;
  message: string;
  stats?: {
    jalonCount: number;
    workstreamCount: number;
    activiteCount: number;
  };
}> {
  await requireRole("Admin");
  const { parseTemplateExcelBuffer, base64ToUint8Array } = await import(
    "@/lib/jalon-template-excel"
  );
  const bytes = base64ToUint8Array(base64);
  const parsed = parseTemplateExcelBuffer(bytes);
  if (!parsed.ok) {
    return {
      ok: false,
      message: `Import refusé : ${parsed.issues[0]?.message ?? "fichier invalide"} (${parsed.issues.length} problème(s)).`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.jalonTemplate.deleteMany();
    for (const j of parsed.jalons) {
      await tx.jalonTemplate.create({
        data: {
          phase: j.phase,
          nom: j.nom,
          ordre: j.ordre,
          offsetPct: j.offsetPct,
          workstreams: {
            create: j.workstreams.map((w) => ({
              nom: w.nom,
              ordre: w.ordre,
              description: w.description ?? "",
              activites: {
                create: w.activites.map((a) => ({
                  nom: a.nom,
                  ordre: a.ordre,
                  description: a.description ?? "",
                })),
              },
            })),
          },
        },
      });
    }
  });

  revalidatePath("/settings");
  return {
    ok: true,
    message: `Référentiel remplacé : ${parsed.stats.jalonCount} jalon(s), ${parsed.stats.workstreamCount} workstream(s), ${parsed.stats.activiteCount} activité(s).`,
    stats: {
      jalonCount: parsed.stats.jalonCount,
      workstreamCount: parsed.stats.workstreamCount,
      activiteCount: parsed.stats.activiteCount,
    },
  };
}

// ── Workstream / Activité (instances chantier) ────────

export type PlanningDetailMutationResult =
  | { mode: "direct" }
  | { mode: "validation"; requestId: string };

async function getPlanningDetailMode(
  session: Awaited<ReturnType<typeof requireAuth>>,
  operation: "create" | "update" | "delete"
) {
  const {
    getSessionJalonWorkflowCaps,
    modeForOperation,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");
  const { normalizePlanningDetailGouvernance, PLANNING_DETAIL_GOUVERNANCE } =
    await import("@/lib/planning-coherence");

  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  const gouv = normalizePlanningDetailGouvernance(
    settings?.planning_detail_gouvernance
  );
  if (gouv === PLANNING_DETAIL_GOUVERNANCE.LIBRE) {
    return { mode: "DIRECT" as const, gouv };
  }
  const caps = await getSessionJalonWorkflowCaps(session);
  const op =
    operation === "create"
      ? WORKFLOW_OPERATION.CREATE
      : operation === "update"
        ? WORKFLOW_OPERATION.UPDATE
        : WORKFLOW_OPERATION.DELETE;
  return { mode: modeForOperation(caps, op), gouv };
}

function optionalDate(iso: string | null | undefined): Date | null {
  if (!iso || !String(iso).trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function dateKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function createWorkstream(
  data: {
    jalonId: string;
    nom: string;
    ordre?: number;
    description?: string;
    date_debut?: string | null;
    date_fin?: string | null;
    date_reelle?: string | null;
    statut?: string;
    commentaire?: string;
  },
  options?: { motif?: string }
): Promise<PlanningDetailMutationResult> {
  const session = await requireAuth();
  const jalon = await prisma.jalon.findUnique({
    where: { id: data.jalonId },
    select: { id: true, nom: true, chantierId: true },
  });
  if (!jalon) throw new Error("Jalon introuvable.");
  await requireChantierAccess(jalon.chantierId);

  const { mode } = await getPlanningDetailMode(session, "create");
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à créer un workstream.");
  }

  const {
    createWorkflowRequest,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");
  const { buildWorkstreamEntityLabel } = await import("@/lib/workflow-shared");
  const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");

  const statut = data.statut ?? "Planifié";
  const date_reelle = resolvePlanningDateReelle({
    statut,
    dateReelle: data.date_reelle,
  });

  const payload = {
    jalonId: data.jalonId,
    nom: data.nom.trim(),
    ordre: data.ordre ?? 0,
    description: data.description ?? "",
    date_debut: data.date_debut || null,
    date_fin: data.date_fin || null,
    date_reelle,
    statut,
    commentaire: data.commentaire ?? "",
    chantierId: jalon.chantierId,
  };

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.WORKSTREAM,
      operation: WORKFLOW_OPERATION.CREATE,
      entityId: null,
      entityLabel: buildWorkstreamEntityLabel(jalon.nom, payload.nom),
      chantierId: jalon.chantierId,
      motif: options?.motif ?? "",
      oldValues: null,
      newValues: payload,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath(`/chantiers/${jalon.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  await prisma.workstream.create({
    data: {
      jalonId: data.jalonId,
      nom: payload.nom,
      ordre: payload.ordre,
      description: payload.description,
      date_debut: optionalDate(payload.date_debut),
      date_fin: optionalDate(payload.date_fin),
      date_reelle: optionalDate(payload.date_reelle),
      statut: payload.statut,
      commentaire: payload.commentaire,
    },
  });
  revalidatePath(`/chantiers/${jalon.chantierId}`);
  return { mode: "direct" };
}

export async function updateWorkstream(
  id: string,
  data: {
    nom: string;
    ordre?: number;
    description?: string;
    date_debut?: string | null;
    date_fin?: string | null;
    date_reelle?: string | null;
    statut?: string;
    commentaire?: string;
  },
  options?: { motif?: string }
): Promise<PlanningDetailMutationResult> {
  const session = await requireAuth();
  const existing = await prisma.workstream.findUnique({
    where: { id },
    include: { jalon: { select: { id: true, nom: true, chantierId: true } } },
  });
  if (!existing) throw new Error("Workstream introuvable.");
  await requireChantierAccess(existing.jalon.chantierId);

  const { mode } = await getPlanningDetailMode(session, "update");
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à modifier un workstream.");
  }

  const {
    createWorkflowRequest,
    createDirectOperationAudit,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");
  const { buildWorkstreamEntityLabel } = await import("@/lib/workflow-shared");
  const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");

  const statut = data.statut ?? existing.statut;
  if (statut === "Atteint") {
    const { assertWorkstreamCanBeAtteint } = await import(
      "@/lib/planning-status-assert"
    );
    await assertWorkstreamCanBeAtteint(id);
  }
  const date_reelle = resolvePlanningDateReelle({
    statut,
    dateReelle: data.date_reelle,
    previousDateReelle: existing.date_reelle,
  });

  const oldValues = {
    nom: existing.nom,
    ordre: existing.ordre,
    description: existing.description,
    date_debut: dateKey(existing.date_debut),
    date_fin: dateKey(existing.date_fin),
    date_reelle: dateKey(existing.date_reelle),
    statut: existing.statut,
    commentaire: existing.commentaire,
  };
  const newValues = {
    nom: data.nom.trim(),
    ordre: data.ordre ?? existing.ordre,
    description: data.description ?? "",
    date_debut: data.date_debut || null,
    date_fin: data.date_fin || null,
    date_reelle,
    statut,
    commentaire: data.commentaire ?? "",
  };

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.WORKSTREAM,
      operation: WORKFLOW_OPERATION.UPDATE,
      entityId: id,
      entityLabel: buildWorkstreamEntityLabel(existing.jalon.nom, newValues.nom),
      chantierId: existing.jalon.chantierId,
      motif: options?.motif ?? "",
      oldValues,
      newValues,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath(`/chantiers/${existing.jalon.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  if (options?.motif?.trim()) {
    await createDirectOperationAudit({
      entityType: WORKFLOW_ENTITY.WORKSTREAM,
      operation: WORKFLOW_OPERATION.UPDATE,
      entityId: id,
      entityLabel: buildWorkstreamEntityLabel(existing.jalon.nom, newValues.nom),
      chantierId: existing.jalon.chantierId,
      motif: options.motif,
      oldValues,
      newValues,
      session,
    });
  }

  await prisma.workstream.update({
    where: { id },
    data: {
      nom: newValues.nom,
      ordre: newValues.ordre,
      description: newValues.description,
      date_debut: optionalDate(newValues.date_debut),
      date_fin: optionalDate(newValues.date_fin),
      date_reelle: optionalDate(newValues.date_reelle),
      statut: newValues.statut,
      commentaire: newValues.commentaire,
    },
  });
  revalidatePath(`/chantiers/${existing.jalon.chantierId}`);
  return { mode: "direct" };
}

export async function deleteWorkstream(
  id: string,
  options?: { motif?: string }
): Promise<PlanningDetailMutationResult> {
  const session = await requireAuth();
  const existing = await prisma.workstream.findUnique({
    where: { id },
    include: {
      jalon: { select: { id: true, nom: true, chantierId: true } },
      _count: { select: { activites: true } },
    },
  });
  if (!existing) throw new Error("Workstream introuvable.");
  await requireChantierAccess(existing.jalon.chantierId);

  const { mode } = await getPlanningDetailMode(session, "delete");
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à supprimer un workstream.");
  }

  const {
    createWorkflowRequest,
    createDirectOperationAudit,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");
  const { buildWorkstreamEntityLabel } = await import("@/lib/workflow-shared");

  const label = buildWorkstreamEntityLabel(existing.jalon.nom, existing.nom);
  const oldValues = {
    nom: existing.nom,
    jalonId: existing.jalonId,
    activiteCount: existing._count.activites,
  };

  if (mode === "VALIDATION") {
    if (!options?.motif?.trim()) {
      throw new Error("Le motif de la demande est obligatoire.");
    }
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.WORKSTREAM,
      operation: WORKFLOW_OPERATION.DELETE,
      entityId: id,
      entityLabel: label,
      chantierId: existing.jalon.chantierId,
      motif: options.motif,
      oldValues,
      newValues: null,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath(`/chantiers/${existing.jalon.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  if (!options?.motif?.trim()) {
    throw new Error("Le commentaire est obligatoire pour supprimer un workstream.");
  }
  await createDirectOperationAudit({
    entityType: WORKFLOW_ENTITY.WORKSTREAM,
    operation: WORKFLOW_OPERATION.DELETE,
    entityId: id,
    entityLabel: label,
    chantierId: existing.jalon.chantierId,
    motif: options.motif,
    oldValues,
    newValues: null,
    session,
  });
  await prisma.workstream.delete({ where: { id } });
  revalidatePath(`/chantiers/${existing.jalon.chantierId}`);
  return { mode: "direct" };
}

export async function createActivite(
  data: {
    workstreamId: string;
    nom: string;
    ordre?: number;
    description?: string;
    date_debut?: string | null;
    date_fin?: string | null;
    date_reelle?: string | null;
    statut?: string;
    commentaire?: string;
  },
  options?: { motif?: string }
): Promise<PlanningDetailMutationResult> {
  const session = await requireAuth();
  const ws = await prisma.workstream.findUnique({
    where: { id: data.workstreamId },
    include: {
      jalon: { select: { chantierId: true, nom: true } },
    },
  });
  if (!ws) throw new Error("Workstream introuvable.");
  await requireChantierAccess(ws.jalon.chantierId);

  const { mode } = await getPlanningDetailMode(session, "create");
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à créer une activité.");
  }

  const {
    createWorkflowRequest,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");
  const { buildActiviteEntityLabel } = await import("@/lib/workflow-shared");
  const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");

  const statut = data.statut ?? "Planifié";
  const date_reelle = resolvePlanningDateReelle({
    statut,
    dateReelle: data.date_reelle,
  });

  const payload = {
    workstreamId: data.workstreamId,
    nom: data.nom.trim(),
    ordre: data.ordre ?? 0,
    description: data.description ?? "",
    date_debut: data.date_debut || null,
    date_fin: data.date_fin || null,
    date_reelle,
    statut,
    commentaire: data.commentaire ?? "",
    chantierId: ws.jalon.chantierId,
  };

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.ACTIVITE,
      operation: WORKFLOW_OPERATION.CREATE,
      entityId: null,
      entityLabel: buildActiviteEntityLabel(ws.nom, payload.nom),
      chantierId: ws.jalon.chantierId,
      motif: options?.motif ?? "",
      oldValues: null,
      newValues: payload,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath(`/chantiers/${ws.jalon.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  await prisma.activite.create({
    data: {
      workstreamId: data.workstreamId,
      nom: payload.nom,
      ordre: payload.ordre,
      description: payload.description,
      date_debut: optionalDate(payload.date_debut),
      date_fin: optionalDate(payload.date_fin),
      date_reelle: optionalDate(payload.date_reelle),
      statut: payload.statut,
      commentaire: payload.commentaire,
    },
  });
  revalidatePath(`/chantiers/${ws.jalon.chantierId}`);
  return { mode: "direct" };
}

export async function updateActivite(
  id: string,
  data: {
    nom: string;
    ordre?: number;
    description?: string;
    date_debut?: string | null;
    date_fin?: string | null;
    date_reelle?: string | null;
    statut?: string;
    commentaire?: string;
  },
  options?: { motif?: string }
): Promise<PlanningDetailMutationResult> {
  const session = await requireAuth();
  const existing = await prisma.activite.findUnique({
    where: { id },
    include: {
      workstream: {
        include: { jalon: { select: { chantierId: true, nom: true } } },
      },
    },
  });
  if (!existing) throw new Error("Activité introuvable.");
  await requireChantierAccess(existing.workstream.jalon.chantierId);

  const { mode } = await getPlanningDetailMode(session, "update");
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à modifier une activité.");
  }

  const {
    createWorkflowRequest,
    createDirectOperationAudit,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");
  const { buildActiviteEntityLabel } = await import("@/lib/workflow-shared");
  const { resolvePlanningDateReelle } = await import("@/lib/jalon-labels");

  const statut = data.statut ?? existing.statut;
  const date_reelle = resolvePlanningDateReelle({
    statut,
    dateReelle: data.date_reelle,
    previousDateReelle: existing.date_reelle,
  });

  const oldValues = {
    nom: existing.nom,
    ordre: existing.ordre,
    description: existing.description,
    date_debut: dateKey(existing.date_debut),
    date_fin: dateKey(existing.date_fin),
    date_reelle: dateKey(existing.date_reelle),
    statut: existing.statut,
    commentaire: existing.commentaire,
  };
  const newValues = {
    nom: data.nom.trim(),
    ordre: data.ordre ?? existing.ordre,
    description: data.description ?? "",
    date_debut: data.date_debut || null,
    date_fin: data.date_fin || null,
    date_reelle,
    statut,
    commentaire: data.commentaire ?? "",
  };

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.ACTIVITE,
      operation: WORKFLOW_OPERATION.UPDATE,
      entityId: id,
      entityLabel: buildActiviteEntityLabel(existing.workstream.nom, newValues.nom),
      chantierId: existing.workstream.jalon.chantierId,
      motif: options?.motif ?? "",
      oldValues,
      newValues,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath(`/chantiers/${existing.workstream.jalon.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  if (options?.motif?.trim()) {
    await createDirectOperationAudit({
      entityType: WORKFLOW_ENTITY.ACTIVITE,
      operation: WORKFLOW_OPERATION.UPDATE,
      entityId: id,
      entityLabel: buildActiviteEntityLabel(existing.workstream.nom, newValues.nom),
      chantierId: existing.workstream.jalon.chantierId,
      motif: options.motif,
      oldValues,
      newValues,
      session,
    });
  }

  await prisma.activite.update({
    where: { id },
    data: {
      nom: newValues.nom,
      ordre: newValues.ordre,
      description: newValues.description,
      date_debut: optionalDate(newValues.date_debut),
      date_fin: optionalDate(newValues.date_fin),
      date_reelle: optionalDate(newValues.date_reelle),
      statut: newValues.statut,
      commentaire: newValues.commentaire,
    },
  });
  revalidatePath(`/chantiers/${existing.workstream.jalon.chantierId}`);
  return { mode: "direct" };
}

export async function deleteActivite(
  id: string,
  options?: { motif?: string }
): Promise<PlanningDetailMutationResult> {
  const session = await requireAuth();
  const existing = await prisma.activite.findUnique({
    where: { id },
    include: {
      workstream: {
        include: { jalon: { select: { chantierId: true, nom: true } } },
      },
    },
  });
  if (!existing) throw new Error("Activité introuvable.");
  await requireChantierAccess(existing.workstream.jalon.chantierId);

  const { mode } = await getPlanningDetailMode(session, "delete");
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à supprimer une activité.");
  }

  const {
    createWorkflowRequest,
    createDirectOperationAudit,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");
  const { buildActiviteEntityLabel } = await import("@/lib/workflow-shared");

  const label = buildActiviteEntityLabel(existing.workstream.nom, existing.nom);
  const oldValues = {
    nom: existing.nom,
    workstreamId: existing.workstreamId,
  };

  if (mode === "VALIDATION") {
    if (!options?.motif?.trim()) {
      throw new Error("Le motif de la demande est obligatoire.");
    }
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.ACTIVITE,
      operation: WORKFLOW_OPERATION.DELETE,
      entityId: id,
      entityLabel: label,
      chantierId: existing.workstream.jalon.chantierId,
      motif: options.motif,
      oldValues,
      newValues: null,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath(`/chantiers/${existing.workstream.jalon.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  if (!options?.motif?.trim()) {
    throw new Error("Le commentaire est obligatoire pour supprimer une activité.");
  }
  await createDirectOperationAudit({
    entityType: WORKFLOW_ENTITY.ACTIVITE,
    operation: WORKFLOW_OPERATION.DELETE,
    entityId: id,
    entityLabel: label,
    chantierId: existing.workstream.jalon.chantierId,
    motif: options.motif,
    oldValues,
    newValues: null,
    session,
  });
  await prisma.activite.delete({ where: { id } });
  revalidatePath(`/chantiers/${existing.workstream.jalon.chantierId}`);
  return { mode: "direct" };
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

/** Single Q&A question for the dedicated edit page (access scoped by chantier). */
export async function getConsultationQuestionById(id: string) {
  await requireAuth();
  const question = await prisma.consultationQuestion.findUnique({
    where: { id },
    include: { chantier: { select: { id: true, code: true, nom: true } } },
  });
  if (!question) return null;
  await requireChantierAccess(question.chantierId);
  return question;
}

/**
 * Options for Q&A assignment block:
 * - Ressource : all accessible resources
 * - Équipe organisationnelle : full catalog of institutional teams
 * - Équipe chantier : members of the selected chantier (DC → Sup → PMO)
 * - Porteurs org : chantier members + Bureau Programme (for org assignment)
 */
export async function getConsultationAssignmentOptions(opts?: {
  chantierId?: string;
}) {
  await requireAuth();
  const chantierId = opts?.chantierId || undefined;

  const [personnes, equipesOrg, membresChantier, bureauProgTeam] =
    await Promise.all([
      getRessourcesForSelect(),
      prisma.equipe.findMany({
        where: { is_active: true, type: "institutionnelle" },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, name: true, type: true, description: true },
      }),
      chantierId
        ? prisma.membreEquipe.findMany({
            where: { chantierId },
            select: {
              ressourceId: true,
              role: true,
              is_directeur: true,
              equipe: true,
              ressource: {
                select: {
                  id: true,
                  nom_complet: true,
                  type: true,
                  organisation: true,
                  actif: true,
                },
              },
            },
          })
        : Promise.resolve(
            [] as {
              ressourceId: string;
              role: string;
              is_directeur: boolean;
              equipe: string;
              ressource: {
                id: string;
                nom_complet: string;
                type: string;
                organisation: string;
                actif: boolean;
              };
            }[]
          ),
      prisma.equipe.findFirst({
        where: {
          is_active: true,
          type: "institutionnelle",
          OR: [
            { name: { equals: "Bureau Programme", mode: "insensitive" } },
            { name: { contains: "Bureau Programme", mode: "insensitive" } },
            { name: { contains: "Programme Office", mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true },
      }),
    ]);

  const tagByRessource = new Map<string, "DC" | "Sup" | "PMO" | null>();
  const bestMembre = new Map<string, (typeof membresChantier)[number]>();

  for (const m of membresChantier) {
    if (!m.ressource?.actif) continue;
    const tag = resolveChantierRoleTag(m.role, m.is_directeur);
    const prevTag = tagByRessource.get(m.ressourceId);
    if (
      prevTag == null ||
      chantierRoleTagRank(tag) < chantierRoleTagRank(prevTag)
    ) {
      tagByRessource.set(m.ressourceId, tag);
      bestMembre.set(m.ressourceId, m);
    } else if (!bestMembre.has(m.ressourceId)) {
      bestMembre.set(m.ressourceId, m);
    }
  }

  const personnesEquipeChantier = Array.from(bestMembre.values())
    .map((m) => {
      const tag = tagByRessource.get(m.ressourceId) ?? null;
      return {
        id: m.ressourceId,
        label: m.ressource.nom_complet,
        hint: [m.equipe, m.role, m.ressource.organisation]
          .filter(Boolean)
          .join(" · "),
        tag,
        sortRank: chantierRoleTagRank(tag),
        group: "Équipe chantier" as const,
      };
    })
    .sort((a, b) => {
      if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
      return a.label.localeCompare(b.label, "fr");
    });

  let personnesBureauProgramme: {
    id: string;
    label: string;
    hint: string;
    tag: "DC" | "Sup" | "PMO" | null;
    sortRank: number;
    group: "Bureau Programme";
  }[] = [];

  if (bureauProgTeam?.id) {
    const bp = await prisma.ressource.findMany({
      where: { actif: true, equipeHierarchieId: bureauProgTeam.id },
      orderBy: { nom_complet: "asc" },
      select: {
        id: true,
        nom_complet: true,
        type: true,
        organisation: true,
      },
    });
    personnesBureauProgramme = bp.map((p) => ({
      id: p.id,
      label: p.nom_complet,
      hint: [bureauProgTeam.name, p.type, p.organisation]
        .filter(Boolean)
        .join(" · "),
      tag: null as "DC" | "Sup" | "PMO" | null,
      sortRank: 10,
      group: "Bureau Programme" as const,
    }));
  }

  // Porteurs for org assignment: chantier members first, then Bureau Programme (deduped)
  const porteurIds = new Set<string>();
  const porteursOrg: {
    id: string;
    label: string;
    hint: string;
    tag: "DC" | "Sup" | "PMO" | null;
    sortRank: number;
    group: string;
  }[] = [];

  for (const p of personnesEquipeChantier) {
    if (porteurIds.has(p.id)) continue;
    porteurIds.add(p.id);
    porteursOrg.push(p);
  }
  for (const p of personnesBureauProgramme) {
    if (porteurIds.has(p.id)) continue;
    porteurIds.add(p.id);
    porteursOrg.push(p);
  }

  return {
    personnes: personnes.map((p) => {
      const tag = tagByRessource.get(p.id) ?? null;
      return {
        id: p.id,
        label: p.nom_complet,
        hint: [p.type, p.organisation].filter(Boolean).join(" · "),
        tag,
        sortRank: chantierRoleTagRank(tag),
      };
    }),
    /** All organizational (institutional) teams. */
    equipesOrganisationnelles: equipesOrg.map((e) => ({
      id: e.id,
      label: e.name,
      hint: e.description?.trim() || "Équipe organisationnelle",
    })),
    /** Alias kept for older clients — same list. */
    equipesInstitutionnelles: equipesOrg.map((e) => ({
      id: e.id,
      label: e.name,
      hint: e.description?.trim() || "Équipe organisationnelle",
    })),
    /** Members of the selected chantier team, ordered DC → Sup → PMO. */
    personnesEquipeChantier,
    /** Alias for previous name. */
    personnesEquipeFunc: personnesEquipeChantier,
    /** Bureau Programme resources. */
    personnesBureauProgramme,
    /** Combined porteurs for org assignment (chantier + BP). */
    porteursOrg,
  };
}

export type QaMutationResult =
  | { mode: "direct" }
  | { mode: "validation"; requestId: string };

function qaPayloadForWorkflow(data: {
  chantierId: string;
  dossier_ref: string;
  question: string;
  categorie: string;
  priorite: string;
  statut: string;
  remontee_par: string;
  affectee_a: string;
  echeance: string | null;
  echeance_actualisee?: string | null;
  date_fin_reelle?: string | null;
  resolution: string;
}) {
  return {
    chantierId: data.chantierId,
    dossier_ref: data.dossier_ref,
    question: data.question,
    categorie: data.categorie,
    priorite: data.priorite,
    statut: data.statut,
    remontee_par: data.remontee_par,
    affectee_a: data.affectee_a,
    echeance: data.echeance,
    echeance_actualisee: data.echeance_actualisee ?? data.echeance,
    date_fin_reelle: data.date_fin_reelle ?? null,
    resolution: data.resolution,
  };
}

function ymdFromDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function resolveQaDateFinReelle(params: {
  statut: string;
  previousStatut?: string;
  previousDateFin?: Date | null;
}): Date | null {
  const closed =
    params.statut === "Résolue" || params.statut === "Abandonnée";
  if (!closed) return null;
  // Keep existing date if already closed before
  if (
    params.previousDateFin &&
    (params.previousStatut === "Résolue" ||
      params.previousStatut === "Abandonnée")
  ) {
    return params.previousDateFin;
  }
  return new Date();
}

function qaEntityLabel(dossier_ref: string, question: string): string {
  const ref = dossier_ref?.trim() || "";
  const q = question?.trim() || "";
  if (ref && q) return `${ref} · ${q.slice(0, 80)}${q.length > 80 ? "…" : ""}`;
  return q.slice(0, 100) || ref || "Question Q&A";
}

export async function getQaWorkflowUiState(): Promise<{
  create: string;
  update: string;
  delete: string;
}> {
  const session = await requireAuth();
  const { getSessionQaWorkflowCaps } = await import("@/lib/workflow");
  const caps = await getSessionQaWorkflowCaps(session);
  return {
    create: caps.create,
    update: caps.update,
    delete: caps.delete,
  };
}

export async function createConsultationQuestion(
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
  },
  options?: { motif?: string }
): Promise<QaMutationResult> {
  const session = await requireAuth();
  await requireChantierAccess(data.chantierId);

  const {
    getSessionQaWorkflowCaps,
    modeForOperation,
    createWorkflowRequest,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");

  const caps = await getSessionQaWorkflowCaps(session);
  const mode = modeForOperation(caps, WORKFLOW_OPERATION.CREATE);
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à créer une question Q&A.");
  }

  const payload = qaPayloadForWorkflow(data);
  const label = qaEntityLabel(data.dossier_ref, data.question);

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.CONSULTATION_QUESTION,
      operation: WORKFLOW_OPERATION.CREATE,
      entityId: null,
      entityLabel: label,
      chantierId: data.chantierId,
      motif: options?.motif ?? "",
      oldValues: null,
      newValues: payload,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath("/workflow/historique");
    revalidatePath("/workflow/dashboard");
    revalidatePath("/consultation-backlog");
    revalidatePath(`/chantiers/${data.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  if (
    (data.statut === "Résolue" || data.statut === "Abandonnée") &&
    !data.resolution.trim()
  ) {
    throw new Error(
      "La réponse est obligatoire lorsque le statut est « Résolue » ou « Abandonnée »."
    );
  }

  const echeanceDate = data.echeance ? new Date(data.echeance) : null;
  const dateFin = resolveQaDateFinReelle({ statut: data.statut });
  const createPayload = {
    ...payload,
    echeance: data.echeance,
    echeance_actualisee: data.echeance,
    date_fin_reelle: ymdFromDate(dateFin),
  };

  const created = await prisma.consultationQuestion.create({
    data: {
      chantierId: data.chantierId,
      dossier_ref: data.dossier_ref,
      question: data.question,
      categorie: data.categorie,
      priorite: data.priorite,
      statut: data.statut,
      remontee_par: data.remontee_par,
      affectee_a: data.affectee_a,
      echeance: echeanceDate,
      echeance_actualisee: echeanceDate,
      date_fin_reelle: dateFin,
      resolution: data.resolution,
    },
  });

  const { writeDirectWorkflowAudit } = await import("@/lib/workflow");
  await writeDirectWorkflowAudit({
    entityType: WORKFLOW_ENTITY.CONSULTATION_QUESTION,
    operation: WORKFLOW_OPERATION.CREATE,
    entityId: created.id,
    entityLabel: label,
    chantierId: data.chantierId,
    motif: "Création directe",
    oldValues: null,
    newValues: createPayload,
    session,
  });

  revalidatePath("/consultation-backlog");
  revalidatePath("/chantiers");
  revalidatePath(`/chantiers/${data.chantierId}`);
  revalidatePath("/workflow/historique");
  revalidatePath("/");
  return { mode: "direct" };
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
    /** Ignored on update — échéance initiale is immutable */
    echeance?: string | null;
    /** Mutable due date */
    echeance_actualisee?: string | null;
    resolution: string;
  },
  options?: { motif?: string }
): Promise<QaMutationResult> {
  const session = await requireAuth();
  const existing = await prisma.consultationQuestion.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("Question introuvable.");
  await requireChantierAccess(existing.chantierId);
  await requireChantierAccess(data.chantierId);

  if (
    (data.statut === "Résolue" || data.statut === "Abandonnée") &&
    !data.resolution.trim()
  ) {
    throw new Error(
      "La réponse est obligatoire lorsque le statut est « Résolue » ou « Abandonnée »."
    );
  }

  const {
    getSessionQaWorkflowCaps,
    modeForOperation,
    createWorkflowRequest,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");

  const caps = await getSessionQaWorkflowCaps(session);
  const mode = modeForOperation(caps, WORKFLOW_OPERATION.UPDATE);
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à modifier une question Q&A.");
  }

  // Texte de la question : modifiable uniquement en mode DIRECT
  const questionText = data.question?.trim() ?? "";
  if (mode !== "DIRECT" && questionText !== existing.question.trim()) {
    throw new Error(
      "Le texte de la question ne peut être modifié que par un rôle en mode Direct (sans workflow)."
    );
  }
  const effectiveQuestion =
    mode === "DIRECT" ? questionText || existing.question : existing.question;

  // Échéance initiale figée
  const echeanceInitialeYmd = ymdFromDate(existing.echeance);
  const echeanceActuYmd =
    data.echeance_actualisee !== undefined
      ? data.echeance_actualisee
      : ymdFromDate(existing.echeance_actualisee) ?? echeanceInitialeYmd;

  const dateFin = resolveQaDateFinReelle({
    statut: data.statut,
    previousStatut: existing.statut,
    previousDateFin: existing.date_fin_reelle,
  });

  const payload = qaPayloadForWorkflow({
    ...data,
    question: effectiveQuestion,
    echeance: echeanceInitialeYmd,
    echeance_actualisee: echeanceActuYmd,
    date_fin_reelle: ymdFromDate(dateFin),
  });
  const oldValues = {
    chantierId: existing.chantierId,
    dossier_ref: existing.dossier_ref,
    question: existing.question,
    categorie: existing.categorie,
    priorite: existing.priorite,
    statut: existing.statut,
    remontee_par: existing.remontee_par,
    affectee_a: existing.affectee_a,
    echeance: echeanceInitialeYmd,
    echeance_actualisee: ymdFromDate(existing.echeance_actualisee),
    date_fin_reelle: ymdFromDate(existing.date_fin_reelle),
    resolution: existing.resolution,
  };
  const label = qaEntityLabel(data.dossier_ref, effectiveQuestion);

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.CONSULTATION_QUESTION,
      operation: WORKFLOW_OPERATION.UPDATE,
      entityId: id,
      entityLabel: label,
      chantierId: data.chantierId,
      motif: options?.motif ?? "",
      oldValues,
      newValues: payload,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath("/workflow/historique");
    revalidatePath("/workflow/dashboard");
    revalidatePath("/consultation-backlog");
    revalidatePath(`/chantiers/${data.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  await prisma.consultationQuestion.update({
    where: { id },
    data: {
      chantierId: data.chantierId,
      dossier_ref: data.dossier_ref,
      question: effectiveQuestion,
      categorie: data.categorie,
      priorite: data.priorite,
      statut: data.statut,
      remontee_par: data.remontee_par,
      affectee_a: data.affectee_a,
      // never change existing.echeance
      echeance_actualisee: echeanceActuYmd
        ? new Date(echeanceActuYmd)
        : null,
      date_fin_reelle: dateFin,
      resolution: data.resolution,
    },
  });

  const { writeDirectWorkflowAudit } = await import("@/lib/workflow");
  await writeDirectWorkflowAudit({
    entityType: WORKFLOW_ENTITY.CONSULTATION_QUESTION,
    operation: WORKFLOW_OPERATION.UPDATE,
    entityId: id,
    entityLabel: label,
    chantierId: data.chantierId,
    motif: "Modification directe",
    oldValues,
    newValues: payload,
    session,
  });

  revalidatePath("/consultation-backlog");
  revalidatePath("/chantiers");
  revalidatePath(`/chantiers/${data.chantierId}`);
  revalidatePath("/workflow/historique");
  revalidatePath("/");
  return { mode: "direct" };
}

export async function deleteConsultationQuestion(
  id: string,
  options?: { motif?: string }
): Promise<QaMutationResult> {
  const session = await requireAuth();
  const existing = await prisma.consultationQuestion.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("Question introuvable.");
  await requireChantierAccess(existing.chantierId);

  const {
    getSessionQaWorkflowCaps,
    modeForOperation,
    createWorkflowRequest,
    WORKFLOW_ENTITY,
    WORKFLOW_OPERATION,
  } = await import("@/lib/workflow");

  const caps = await getSessionQaWorkflowCaps(session);
  const mode = modeForOperation(caps, WORKFLOW_OPERATION.DELETE);
  if (mode === "INTERDIT") {
    throw new Error("Vous n'êtes pas habilité à supprimer une question Q&A.");
  }

  const oldValues = {
    chantierId: existing.chantierId,
    dossier_ref: existing.dossier_ref,
    question: existing.question,
    categorie: existing.categorie,
    priorite: existing.priorite,
    statut: existing.statut,
    remontee_par: existing.remontee_par,
    affectee_a: existing.affectee_a,
    echeance: ymdFromDate(existing.echeance),
    echeance_actualisee: ymdFromDate(existing.echeance_actualisee),
    date_fin_reelle: ymdFromDate(existing.date_fin_reelle),
    resolution: existing.resolution,
  };
  const label = qaEntityLabel(existing.dossier_ref, existing.question);

  if (mode === "VALIDATION") {
    const req = await createWorkflowRequest({
      entityType: WORKFLOW_ENTITY.CONSULTATION_QUESTION,
      operation: WORKFLOW_OPERATION.DELETE,
      entityId: id,
      entityLabel: label,
      chantierId: existing.chantierId,
      motif: options?.motif ?? "",
      oldValues,
      newValues: null,
      session,
    });
    revalidatePath("/workflow/demandes");
    revalidatePath("/workflow/historique");
    revalidatePath("/workflow/dashboard");
    revalidatePath("/consultation-backlog");
    revalidatePath(`/chantiers/${existing.chantierId}`);
    return { mode: "validation", requestId: req.id };
  }

  await prisma.consultationQuestion.delete({ where: { id } });

  const { writeDirectWorkflowAudit } = await import("@/lib/workflow");
  await writeDirectWorkflowAudit({
    entityType: WORKFLOW_ENTITY.CONSULTATION_QUESTION,
    operation: WORKFLOW_OPERATION.DELETE,
    entityId: id,
    entityLabel: label,
    chantierId: existing.chantierId,
    motif: "Suppression directe",
    oldValues,
    newValues: null,
    session,
  });

  revalidatePath("/consultation-backlog");
  revalidatePath("/chantiers");
  revalidatePath(`/chantiers/${existing.chantierId}`);
  revalidatePath("/workflow/historique");
  revalidatePath("/");
  return { mode: "direct" };
}

/** Change tracking for a Q&A question (workflow + direct audits). */
export async function getConsultationQuestionHistory(questionId: string) {
  const session = await requireAuth();
  const question = await prisma.consultationQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, chantierId: true },
  });
  if (!question) throw new Error("Question introuvable.");
  await requireChantierAccess(question.chantierId);

  const { WORKFLOW_ENTITY } = await import("@/lib/workflow-shared");
  const rows = await prisma.workflowRequest.findMany({
    where: {
      entityType: WORKFLOW_ENTITY.CONSULTATION_QUESTION,
      entityId: questionId,
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    operation: r.operation,
    status: r.status,
    priority: r.priority,
    motif: r.motif,
    rejectMotif: r.rejectMotif,
    requesterName: r.requesterName,
    approverName: r.approverName,
    oldValues: r.oldValues,
    newValues: r.newValues,
    decisionHistory: r.decisionHistory,
    createdAt: r.createdAt,
    processedAt: r.processedAt,
  }));
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
      echeance: (r.date_echeance_actualisee ?? r.date_echeance)
        ? (r.date_echeance_actualisee ?? r.date_echeance)!.toISOString()
        : null,
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
      echeance: (r.date_echeance_actualisee ?? r.date_echeance)
        ? (r.date_echeance_actualisee ?? r.date_echeance)!.toISOString()
        : null,
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
