/**
 * Production-oriented data purge (keeps structure / catalogs / chantiers).
 *
 * DELETES:
 * - MailServerConfig (all)
 * - Equipe named "Achat Groupe"
 * - AppRole except Admin, Programme_Office, Workforce_Manager, PMO_Chantier
 * - User except username "admin" (case-insensitive)
 * - Ressource (all) — unlinks admin first
 * - Comite (instances) all
 * - ConsultationQuestion all
 * - SaisieTemps all
 * - Raid (+ comments / audit) all
 * - MembreEquipe all (empty chantier teams)
 * - RessourceEquipeFonctionnelle all
 * - Notification all
 * - RaidCodeSequence reset
 *
 * KEEPS: Chantier, Jalon, Adherence, Rmd, ChantierRmd, ProfilRessource,
 * Settings, StatusConfig, RaidFieldOption, JalonTemplate, ComiteParametre,
 * other Equipes, FavoriChantier, admin user, 4 system roles.
 *
 * Usage: npx tsx scripts/purge-prod-data.ts
 * Confirm: set CONFIRM_PURGE=YES
 */
import { createPrismaClient } from "../lib/create-prisma";

const prisma = createPrismaClient();

const KEEP_ROLE_CODES = [
  "Admin",
  "Programme_Office",
  "Workforce_Manager",
  "PMO_Chantier",
] as const;

const ADMIN_USERNAME = "admin";

async function main() {
  if (process.env.CONFIRM_PURGE !== "YES") {
    console.error(
      "Refus : définissez CONFIRM_PURGE=YES pour exécuter ce script destructif."
    );
    console.error('Exemple: $env:CONFIRM_PURGE="YES"; npx tsx scripts/purge-prod-data.ts');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL ?? "";
  console.log("DATABASE_URL host:", url.replace(/:[^:@/]+@/, ":****@"));
  console.log("Starting purge…\n");

  // ── Counts before ─────────────────────────────────
  const before = {
    mail: await prisma.mailServerConfig.count(),
    users: await prisma.user.count(),
    ressources: await prisma.ressource.count(),
    raids: await prisma.raid.count(),
    comites: await prisma.comite.count(),
    qa: await prisma.consultationQuestion.count(),
    temps: await prisma.saisieTemps.count(),
    membres: await prisma.membreEquipe.count(),
    roles: await prisma.appRole.count(),
    notif: await prisma.notification.count(),
  };
  console.log("Before:", before);

  // 1) RAID + collab (cascade comments / audit)
  const delRaid = await prisma.raid.deleteMany({});
  console.log(`✓ Raid: ${delRaid.count}`);
  const delSeq = await prisma.raidCodeSequence.deleteMany({});
  console.log(`✓ RaidCodeSequence: ${delSeq.count}`);

  // 2) Saisie temps
  const delTemps = await prisma.saisieTemps.deleteMany({});
  console.log(`✓ SaisieTemps: ${delTemps.count}`);

  // 3) Q&A backlog
  const delQa = await prisma.consultationQuestion.deleteMany({});
  console.log(`✓ ConsultationQuestion: ${delQa.count}`);

  // 4) Comités (instances)
  const delComites = await prisma.comite.deleteMany({});
  console.log(`✓ Comite: ${delComites.count}`);

  // 5) Équipes chantier (membres) + liens fonctionnels ressources
  const delMembres = await prisma.membreEquipe.deleteMany({});
  console.log(`✓ MembreEquipe: ${delMembres.count}`);
  const delRef = await prisma.ressourceEquipeFonctionnelle.deleteMany({});
  console.log(`✓ RessourceEquipeFonctionnelle: ${delRef.count}`);

  // 6) Notifications
  const delNotif = await prisma.notification.deleteMany({});
  console.log(`✓ Notification: ${delNotif.count}`);

  // 7) Unlink admin + delete other users
  await prisma.user.updateMany({
    data: { ressourceId: null },
  });
  const delUsers = await prisma.user.deleteMany({
    where: {
      NOT: { username: { equals: ADMIN_USERNAME, mode: "insensitive" } },
    },
  });
  console.log(`✓ User (sauf ${ADMIN_USERNAME}): ${delUsers.count}`);

  // Ensure remaining admin has Admin role
  await prisma.user.updateMany({
    where: { username: { equals: ADMIN_USERNAME, mode: "insensitive" } },
    data: { role: "Admin", ressourceId: null },
  });

  // 8) All ressources
  const delRes = await prisma.ressource.deleteMany({});
  console.log(`✓ Ressource: ${delRes.count}`);

  // 9) Mail server configs
  const delMail = await prisma.mailServerConfig.deleteMany({});
  console.log(`✓ MailServerConfig: ${delMail.count}`);

  // 10) Equipe "Achat Groupe"
  const achat = await prisma.equipe.findFirst({
    where: { name: { equals: "Achat Groupe", mode: "insensitive" } },
  });
  if (achat) {
    await prisma.equipeRaidCategorieAccess.deleteMany({
      where: { equipeId: achat.id },
    });
    await prisma.comiteParametre.updateMany({
      where: { equipeId: achat.id },
      data: { equipeId: null, owner: "" },
    });
    // any leftover hierarchy / raid equipe already cleared
    await prisma.equipe.delete({ where: { id: achat.id } });
    console.log(`✓ Equipe « Achat Groupe » supprimée (${achat.id})`);
  } else {
    console.log("· Equipe « Achat Groupe » : introuvable (ok)");
  }

  // 11) Roles except the four keepers
  const delRoles = await prisma.appRole.deleteMany({
    where: { code: { notIn: [...KEEP_ROLE_CODES] } },
  });
  console.log(
    `✓ AppRole (sauf ${KEEP_ROLE_CODES.join(", ")}): ${delRoles.count}`
  );

  const after = {
    mail: await prisma.mailServerConfig.count(),
    users: await prisma.user.count(),
    ressources: await prisma.ressource.count(),
    raids: await prisma.raid.count(),
    comites: await prisma.comite.count(),
    qa: await prisma.consultationQuestion.count(),
    temps: await prisma.saisieTemps.count(),
    membres: await prisma.membreEquipe.count(),
    roles: await prisma.appRole.count(),
    notif: await prisma.notification.count(),
    chantiers: await prisma.chantier.count(),
    equipes: await prisma.equipe.count(),
    admin: await prisma.user.findFirst({
      where: { username: { equals: ADMIN_USERNAME, mode: "insensitive" } },
      select: { username: true, role: true, ressourceId: true },
    }),
    roleCodes: (
      await prisma.appRole.findMany({ select: { code: true }, orderBy: { code: "asc" } })
    ).map((r) => r.code),
  };

  console.log("\nAfter:", JSON.stringify(after, null, 2));
  console.log("\nPurge terminée.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
