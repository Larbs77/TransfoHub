import { prisma } from "@/lib/prisma";
import {
  buildRaidForecast,
  parseForecastHorizon,
  type ForecastHorizon,
  type RaidForecastPayload,
} from "@/lib/raid-forecast";

export async function loadRaidForecast(opts: {
  now: Date;
  horizonRaw?: string;
  teamId?: string;
}): Promise<RaidForecastPayload> {
  const horizon: ForecastHorizon = parseForecastHorizon(opts.horizonRaw);
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
        createdAt: true,
        date_echeance: true,
        chantier: {
          select: {
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
      select: { raidId: true, oldValue: true, newValue: true, createdAt: true },
    }),
  ]);

  return buildRaidForecast(
    raids.map((raid) => ({
      id: raid.id,
      code: raid.code,
      intitule: raid.intitule,
      chantierId: raid.chantierId,
      teamLabel:
        raid.chantier?.equipeFonctionnelle?.name ||
        raid.chantier?.nom ||
        "Non rattaché",
      responsable: raid.responsable,
      statut: raid.statut,
      createdAt: raid.createdAt,
      initiale: raid.date_echeance,
    })),
    logs.flatMap((log) =>
      log.raidId
        ? [
            {
              raidId: log.raidId,
              oldValue: log.oldValue,
              newValue: log.newValue,
              createdAt: log.createdAt,
            },
          ]
        : []
    ),
    opts.now,
    horizon,
    opts.teamId?.trim() || null
  );
}
