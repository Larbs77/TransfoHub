import { createPrismaClient } from "../lib/create-prisma";

const prisma = createPrismaClient();

async function main() {
  const roles = await prisma.appRole.findMany({
    select: {
      code: true,
      pages: true,
      jalon_create_mode: true,
      jalon_update_mode: true,
      jalon_delete_mode: true,
      workflow_can_approve: true,
    },
  });
  console.log("Roles workflow fields:", JSON.stringify(roles, null, 2));

  for (const code of ["Programme_Office", "PMO_Chantier"] as const) {
    const role = await prisma.appRole.findUnique({ where: { code } });
    if (!role) continue;
    const pages = Array.isArray(role.pages)
      ? [...(role.pages as string[])]
      : [];
    const extra =
      code === "Programme_Office"
        ? [
            "/workflow/demandes",
            "/workflow/historique",
            "/workflow/dashboard",
          ]
        : ["/workflow/demandes", "/workflow/historique"];
    let changed = false;
    for (const p of extra) {
      if (!pages.includes(p)) {
        pages.push(p);
        changed = true;
      }
    }
    if (changed) {
      await prisma.appRole.update({ where: { code }, data: { pages } });
      console.log("Updated pages for", code);
    } else {
      console.log("Pages already ok for", code);
    }
  }

  const count = await prisma.workflowRequest.count();
  console.log("WorkflowRequest count:", count);
  const jalons = await prisma.jalon.count();
  console.log("Jalon count:", jalons);

  // Engine unit checks (no session)
  const { normalizeWorkflowMode, resolveJalonWorkflowCaps } = await import(
    "../lib/workflow-shared"
  );
  if (normalizeWorkflowMode("VALIDATION") !== "VALIDATION") {
    throw new Error("normalizeWorkflowMode failed");
  }
  const adminCaps = resolveJalonWorkflowCaps({
    code: "Admin",
    is_active: true,
    jalon_create_mode: "INTERDIT",
    jalon_update_mode: "INTERDIT",
    jalon_delete_mode: "INTERDIT",
    workflow_can_approve: false,
  });
  if (adminCaps.create !== "DIRECT" || !adminCaps.canApprove) {
    throw new Error("Admin caps must always be full direct");
  }
  console.log("Engine unit checks OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
