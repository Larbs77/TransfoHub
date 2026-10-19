import { redirect } from "next/navigation";
import { raidCalendarDay } from "@/lib/raid-labels";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  RAID_PERF_NONE,
  buildRaidPerformance,
  canSeeRaidPerformance,
  parseCycleStart,
  parseMedianOrigin,
  resolvePerfWindow,
  withPerfSearch,
  toPerfInputs,
  type PerfScreen,
  type RaidPerformancePayload,
} from "@/lib/raid-performance";

export async function requireRaidPerformance() {
  const session = await requireAuth();
  if (!canSeeRaidPerformance(session.role)) redirect("/raid");
  return session;
}

function screenFor(
  focus: { id: string; label: string; code: string } | null,
  search: string
): PerfScreen {
  if (!focus) {
    return {
      basePath: "/raid/performance",
      backHref: "/raid",
      backLabel: "Registre RAID",
      heading: "Performance des actions",
      kicker: "Vue programme",
    };
  }
  return {
    basePath: `/raid/performance/${focus.id}`,
    backHref: `/raid/performance?${search}`,
    backLabel: "Vue programme",
    heading: focus.label,
    kicker: focus.code || "Équipe chantier",
  };
}

export async function loadRaidPerformance(opts: {
  now: Date;
  preset?: string;
  from?: string;
  to?: string;
  origine?: string;
  cycle?: string;
  teamId?: string;
}): Promise<RaidPerformancePayload | null> {
  const origin = parseMedianOrigin(opts.origine);
  const cycleStart = parseCycleStart(opts.cycle);
  const window = resolvePerfWindow(opts.now, opts.preset, opts.from, opts.to);
  const [raids, logs] = await Promise.all([
    prisma.raid.findMany({
      where: {
        type: "Action",
        deletedAt: null,
        NOT: { statut: { in: ["Doublon", "NA"] } },
      },
      select: {
        id: true,
        code: true,
        intitule: true,
        chantierId: true,
        statut: true,
        responsable: true,
        responsableRessourceId: true,
        createdAt: true,
        date_identification: true,
        date_echeance: true,
        date_echeance_actualisee: true,
        date_fin_reelle: true,
        chantier: {
          select: {
            code: true,
            nom: true,
            equipeFonctionnelle: { select: { name: true } },
          },
        },
      },
    }),
    prisma.raidAuditLog.findMany({
      where: {
        action: "status_changed",
        field: "statut",
        raid: {
          type: "Action",
          deletedAt: null,
          NOT: { statut: { in: ["Doublon", "NA"] } },
        },
      },
      select: { raidId: true, newValue: true, createdAt: true },
    }),
  ]);

  const inputs = toPerfInputs(
    raids.map((raid) => ({
      id: raid.id,
      code: raid.code,
      intitule: raid.intitule,
      chantierId: raid.chantierId,
      teamLabel:
        raid.chantier?.equipeFonctionnelle?.name ||
        raid.chantier?.nom ||
        "Non rattaché",
      teamCode: raid.chantier?.code ?? "",
      responsableId: raid.responsableRessourceId,
      responsable: raid.responsable,
      statut: raid.statut,
      createdAt: raid.createdAt,
      dateIdentification: raid.date_identification,
      initiale: raid.date_echeance,
      actualisee: raid.date_echeance_actualisee,
      dateFinReelle: raid.date_fin_reelle,
    })),
    logs.flatMap((log) =>
      log.raidId
        ? [{ raidId: log.raidId, newValue: log.newValue, createdAt: log.createdAt }]
        : []
    )
  );

  let focus: { id: string; label: string; code: string } | null = null;
  if (opts.teamId === RAID_PERF_NONE) {
    focus = { id: RAID_PERF_NONE, label: "Non rattaché", code: "" };
  } else if (opts.teamId) {
    const sample = inputs.find((row) => row.chantierId === opts.teamId);
    if (sample) {
      focus = {
        id: opts.teamId,
        label: sample.teamLabel,
        code: sample.teamCode,
      };
    } else {
      const chantier = await prisma.chantier.findUnique({
        where: { id: opts.teamId },
        select: {
          code: true,
          nom: true,
          equipeFonctionnelle: { select: { name: true } },
        },
      });
      if (!chantier) return null;
      focus = {
        id: opts.teamId,
        label: chantier.equipeFonctionnelle?.name || chantier.nom,
        code: chantier.code,
      };
    }
  }

  if (focus) {
    const ids = inputs
      .filter((row) => (row.chantierId ?? RAID_PERF_NONE) === focus!.id)
      .map((row) => row.id);
    if (ids.length > 0) {
      const moves = await prisma.raidAuditLog.groupBy({
        by: ["raidId"],
        where: { raidId: { in: ids } },
        _max: { createdAt: true },
      });
      const last = new Map(
        moves.map((row) => [
          row.raidId,
          row._max.createdAt ? raidCalendarDay(row._max.createdAt) : null,
        ])
      );
      for (const row of inputs) {
        if ((row.chantierId ?? RAID_PERF_NONE) !== focus.id) continue;
        row.lastMoveDay = last.get(row.id) ?? null;
      }
    }
  }

  return buildRaidPerformance(
    inputs,
    window,
    opts.now,
    focus,
    screenFor(focus, withPerfSearch(window.search, origin, cycleStart)),
    origin,
    cycleStart
  );
}
