import { createPrismaClient } from "../lib/create-prisma";

const p = createPrismaClient();

async function main() {
  const r = {
    chantier: await p.chantier.count(),
    jalon: await p.jalon.count(),
    raid: await p.raid.count(),
    saisie: await p.saisieTemps.count(),
    membre: await p.membreEquipe.count(),
    user: await p.user.count(),
    role: await p.appRole.count(),
    equipe: await p.equipe.count(),
    workflow: await p.workflowRequest.count(),
    raidCoded: await p.raid.count({ where: { code: { not: "" } } }),
  };
  console.log("Counts:", r);
  const modes = await p.appRole.findMany({
    select: {
      code: true,
      jalon_create_mode: true,
      jalon_update_mode: true,
      jalon_delete_mode: true,
      workflow_can_approve: true,
    },
  });
  console.log("Roles workflow:", modes);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await p.$disconnect();
  });
