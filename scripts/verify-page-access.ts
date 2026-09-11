/**
 * Contrôles unitaires du modèle Accès vues (lecture / écriture).
 * Usage: npx tsx scripts/verify-page-access.ts
 */
import {
  APP_PAGES,
  isAppPageWriteable,
  getOwningAppPagePath,
} from "../lib/app-pages";
import { isRaidAssignee } from "../lib/raid-labels";
import {
  PAGE_ACCESS_MODE_UI_PATHS,
  isPageWriteEnforced,
  parsePageGrants,
  serializePageGrants,
  grantsToPaths,
  pageGrantMode,
  showsPageAccessMode,
} from "../lib/page-access";

let failed = 0;
let passed = 0;

function assert(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  OK  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n== Catalogue ==");
assert(
  "Centre de Validation n'est pas écrivable",
  isAppPageWriteable("/workflow/demandes") === false
);
assert("RMD est écrivable", isAppPageWriteable("/rmds") === true);
assert("Profils est écrivable", isAppPageWriteable("/profils") === true);
assert("Ressources est écrivable", isAppPageWriteable("/ressources") === true);
assert(
  "Saisie temps est écrivable",
  isAppPageWriteable("/saisie-temps") === true
);
assert("Adhérences est écrivable", isAppPageWriteable("/adherences") === true);
assert("Jalons est écrivable", isAppPageWriteable("/jalons") === true);
assert(
  "Backlog Q&A est écrivable",
  isAppPageWriteable("/consultation-backlog") === true
);
assert("RAID est écrivable (lot 2)", isAppPageWriteable("/raid") === true);
assert(
  "Chantiers est écrivable (lot 2)",
  isAppPageWriteable("/chantiers") === true
);
assert("Comités est écrivable (lot 2)", isAppPageWriteable("/comites") === true);
assert(
  "Tableau de bord n'est pas écrivable",
  isAppPageWriteable("/") === false
);

console.log("\n== UI / enforcement (sous-lot 1) ==");
const lot1 = [
  "/rmds",
  "/profils",
  "/ressources",
  "/saisie-temps",
  "/adherences",
  "/jalons",
  "/consultation-backlog",
  "/raid",
  "/chantiers",
  "/comites",
];
assert(
  "PAGE_ACCESS_MODE_UI_PATHS = sous-lot 1 + RMD",
  PAGE_ACCESS_MODE_UI_PATHS.length === lot1.length &&
    lot1.every((p) => showsPageAccessMode(p))
);
assert("Admin users pas encore Lecture/Écriture UI", showsPageAccessMode("/admin/users") === false);
assert("RAID enforced", isPageWriteEnforced("/raid") === true);
assert("Chantiers enforced", isPageWriteEnforced("/chantiers") === true);
assert("Comités enforced", isPageWriteEnforced("/comites") === true);
assert(
  "RAID détail enforced via owning path",
  isPageWriteEnforced("/raid/xyz") === true
);
assert("Admin users pas enforced", isPageWriteEnforced("/admin/users") === false);
assert(
  "Fiche RMD enforced via owning path",
  isPageWriteEnforced("/rmds/abc") === true
);
assert(
  "Modifier Q&A enforced via owning path",
  isPageWriteEnforced("/consultation-backlog/x/modifier") === true
);
assert(
  "Fiche ressource enforced",
  isPageWriteEnforced("/ressources/xyz") === true
);

console.log("\n== parsePageGrants (legacy string[]) ==");
const legacy = parsePageGrants(["/", "/rmds", "/raid", "/profils"]);
assert(
  "legacy paths conservés",
  grantsToPaths(legacy).join(",") === "/, /rmds, /raid, /profils".replace(/ /g, "")
    ? grantsToPaths(legacy).join(",") === "/,/rmds,/raid,/profils"
    : grantsToPaths(legacy).sort().join(",") ===
        ["/", "/rmds", "/raid", "/profils"].sort().join(",")
);
assert(
  "legacy RMD = write",
  legacy.find((g) => g.path === "/rmds")?.mode === "write"
);
assert(
  "legacy Tableau de bord forcé read (non writeable)",
  legacy.find((g) => g.path === "/")?.mode === "read"
);

console.log("\n== parsePageGrants (objets) ==");
const grants = parsePageGrants([
  { path: "/rmds", mode: "read" },
  { path: "/profils", mode: "write" },
  { path: "/jalons", mode: "read" },
]);
assert(
  "lecture RMD",
  grants.find((g) => g.path === "/rmds")?.mode === "read"
);
assert(
  "écriture Profils",
  grants.find((g) => g.path === "/profils")?.mode === "write"
);
assert(
  "pageGrantMode owning /rmds/id",
  pageGrantMode(grants, "/rmds/id-1") === "read"
);
assert(
  "pageGrantMode absent = none",
  pageGrantMode(grants, "/adherences") === "none"
);

console.log("\n== serializePageGrants ==");
const serialized = serializePageGrants(
  ["/", "/rmds", "/profils", "/unknown-path"],
  { "/rmds": "read", "/profils": "write" }
);
assert(
  "chemin inconnu exclu",
  serialized.every((g) => g.path !== "/unknown-path")
);
assert(
  "RMD lecture sérialisée",
  serialized.find((g) => g.path === "/rmds")?.mode === "read"
);
assert(
  "Profils écriture sérialisée",
  serialized.find((g) => g.path === "/profils")?.mode === "write"
);
assert(
  "/ forcé read",
  serialized.find((g) => g.path === "/")?.mode === "read"
);

console.log("\n== Mixte string + objet ==");
const mixed = parsePageGrants(["/raid", { path: "/rmds", mode: "read" }]);
assert(
  "mixte RAID write (legacy)",
  mixed.find((g) => g.path === "/raid")?.mode === "write"
);
assert(
  "mixte RMD read",
  mixed.find((g) => g.path === "/rmds")?.mode === "read"
);

console.log("\n== Owning paths ==");
assert(
  "owning /rmds/x = /rmds",
  getOwningAppPagePath("/rmds/x") === "/rmds"
);
assert(
  "owning /consultation-backlog/1/modifier",
  getOwningAppPagePath("/consultation-backlog/1/modifier") ===
    "/consultation-backlog"
);
assert(
  "toutes les pages UI ont un writeable cohérent",
  PAGE_ACCESS_MODE_UI_PATHS.every((p) => {
    const page = APP_PAGES.find((x) => x.path === p);
    return !!page && page.writeable === true;
  })
);

console.log("\n== RAID assignee ==");
assert("assigné identique", isRaidAssignee("r1", "r1") === true);
assert("pas assigné", isRaidAssignee("r1", "r2") === false);
assert("null ressource", isRaidAssignee(null, "r1") === false);
assert("null responsable", isRaidAssignee("r1", null) === false);

console.log(`\nRésultat: ${passed} OK, ${failed} FAIL\n`);
if (failed > 0) process.exit(1);
