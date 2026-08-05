/**
 * Audit + fix: remplace le statut "Terminé" (et variantes) par "Atteint"
 * sur Jalon, Workstream, Activite.
 *
 * Run: npx tsx scripts/fix-termine-to-atteint.ts
 * Dry-run: npx tsx scripts/fix-termine-to-atteint.ts --dry
 */
import { createPrismaClient } from "../lib/create-prisma";

const prisma = createPrismaClient();
const dry = process.argv.includes("--dry");

/** Statuts non standard à normaliser vers Atteint */
const BAD = [
  "Terminé",
  "Termine",
  "terminé",
  "termine",
  "TERMINÉ",
  "TERMINE",
  "Terminée",
  "Terminee",
  "terminée",
  "terminee",
];

async function dumpStatuts() {
  const [jalons, workstreams, activites] = await Promise.all([
    prisma.jalon.groupBy({
      by: ["statut"],
      _count: { _all: true },
      orderBy: { statut: "asc" },
    }),
    prisma.workstream.groupBy({
      by: ["statut"],
      _count: { _all: true },
      orderBy: { statut: "asc" },
    }),
    prisma.activite.groupBy({
      by: ["statut"],
      _count: { _all: true },
      orderBy: { statut: "asc" },
    }),
  ]);
  console.log("=== Statuts Jalon ===");
  for (const r of jalons) console.log(`  ${JSON.stringify(r.statut)} → ${r._count._all}`);
  console.log("=== Statuts Workstream ===");
  for (const r of workstreams)
    console.log(`  ${JSON.stringify(r.statut)} → ${r._count._all}`);
  console.log("=== Statuts Activite ===");
  for (const r of activites)
    console.log(`  ${JSON.stringify(r.statut)} → ${r._count._all}`);
}

async function main() {
  console.log(dry ? "Mode DRY-RUN (aucune écriture)\n" : "Mode APPLY\n");
  await dumpStatuts();

  const where = { statut: { in: BAD } };

  const [jCount, wCount, aCount] = await Promise.all([
    prisma.jalon.count({ where }),
    prisma.workstream.count({ where }),
    prisma.activite.count({ where }),
  ]);

  console.log("\n=== À corriger (Terminé* → Atteint) ===");
  console.log(`  Jalon:      ${jCount}`);
  console.log(`  Workstream: ${wCount}`);
  console.log(`  Activite:   ${aCount}`);

  if (jCount + wCount + aCount === 0) {
    console.log("\nRien à corriger.");
    return;
  }

  if (dry) {
    const samples = await Promise.all([
      prisma.jalon.findMany({
        where,
        select: { id: true, nom: true, statut: true },
        take: 10,
      }),
      prisma.workstream.findMany({
        where,
        select: { id: true, nom: true, statut: true },
        take: 10,
      }),
      prisma.activite.findMany({
        where,
        select: { id: true, nom: true, statut: true },
        take: 10,
      }),
    ]);
    console.log("\nÉchantillons Jalon:", samples[0]);
    console.log("Échantillons Workstream:", samples[1]);
    console.log("Échantillons Activite:", samples[2]);
    return;
  }

  const [j, w, a] = await Promise.all([
    prisma.jalon.updateMany({ where, data: { statut: "Atteint" } }),
    prisma.workstream.updateMany({ where, data: { statut: "Atteint" } }),
    prisma.activite.updateMany({ where, data: { statut: "Atteint" } }),
  ]);

  console.log("\n=== Mises à jour ===");
  console.log(`  Jalon:      ${j.count}`);
  console.log(`  Workstream: ${w.count}`);
  console.log(`  Activite:   ${a.count}`);

  console.log("\n=== Statuts après correction ===");
  await dumpStatuts();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
