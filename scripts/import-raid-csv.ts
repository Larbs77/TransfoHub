/**
 * Import Raid.csv (pipe-separated maintenance export) into current DB.
 * - Maps chantierId / responsableRessourceId to current DB
 * - Random assignee if resource not found
 * - Computes equipeId (fonctionnelle chantier vs institutionnelle)
 *
 * Usage: npx tsx scripts/import-raid-csv.ts "E:\path\to\Raid.csv"
 */
import { readFileSync } from "fs";
import { createPrismaClient } from "../lib/create-prisma";
import { resolveRaidEquipeId } from "../lib/equipe-chantier";
import {
  isValidRaidCodeFormat,
  normalizeRaidCode,
  parseRaidCodeNumber,
  raidCodeMatchesType,
} from "../lib/raid-code";
import {
  allocateNextRaidCode,
  bumpRaidCodeSequenceIfNeeded,
} from "../lib/raid-code-server";

const prisma = createPrismaClient();
const CSV_SEP = "|";

function parsePipeCsv(content: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip BOM
  const text = content.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(CSV_SEP).map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitPipeLine(lines[i], headers.length);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

/** Split a pipe line into exactly n columns (trailing empties preserved). */
function splitPipeLine(line: string, n: number): string[] {
  const parts = line.split(CSV_SEP);
  while (parts.length < n) parts.push("");
  if (parts.length > n) {
    // Merge overflow into last field (shouldn't happen with clean export)
    const head = parts.slice(0, n - 1);
    const tail = parts.slice(n - 1).join(CSV_SEP);
    return [...head, tail];
  }
  return parts;
}

function parseDate(v: string): Date | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIntOrNull(v: string): number | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const filePath =
    process.argv[2] ||
    "E:\\Bank-Of-Africa\\TRANSFO-HUB-DB\\20260713\\Raid.csv";

  console.log("Reading:", filePath);
  const raw = readFileSync(filePath, "utf8");
  const { headers, rows } = parsePipeCsv(raw);
  console.log("Headers:", headers.join(", "));
  console.log("Rows:", rows.length);

  if (rows.length === 0) {
    console.error("No data rows.");
    process.exit(1);
  }

  const [chantiers, ressources] = await Promise.all([
    prisma.chantier.findMany({
      select: { id: true, code: true, nom: true },
    }),
    prisma.ressource.findMany({
      where: { actif: true },
      select: {
        id: true,
        nom_complet: true,
        email: true,
        equipeHierarchieId: true,
      },
    }),
  ]);

  const chantierById = new Map(chantiers.map((c) => [c.id, c]));
  const chantierByCode = new Map(
    chantiers.map((c) => [c.code.toUpperCase(), c])
  );
  const ressourceById = new Map(ressources.map((r) => [r.id, r]));
  const ressourceByName = new Map(
    ressources.map((r) => [r.nom_complet.trim().toLowerCase(), r])
  );

  if (ressources.length === 0) {
    console.error("No active ressources in DB — cannot assign RAID.");
    process.exit(1);
  }

  console.log(
    `DB: ${chantiers.length} chantiers, ${ressources.length} active ressources`
  );

  // Optional: extract code from description/intitule patterns CH_xxx for remapping
  function resolveChantierId(oldId: string, row: Record<string, string>): string | null {
    const id = (oldId ?? "").trim();
    if (id && chantierById.has(id)) return id;

    // Try codes mentioned in domaine/description/intitule
    const blob = `${row.intitule} ${row.description} ${row.domaine}`;
    const codes = blob.match(/CH_\d{3}/gi) ?? [];
    for (const code of codes) {
      const c = chantierByCode.get(code.toUpperCase());
      if (c) return c.id;
    }
    return null;
  }

  function resolveRessource(
    oldId: string,
    responsableName: string
  ): { id: string; nom: string; source: string } {
    const id = (oldId ?? "").trim();
    if (id && ressourceById.has(id)) {
      const r = ressourceById.get(id)!;
      return { id: r.id, nom: r.nom_complet, source: "id" };
    }
    const name = (responsableName ?? "").trim().toLowerCase();
    if (name && ressourceByName.has(name)) {
      const r = ressourceByName.get(name)!;
      return { id: r.id, nom: r.nom_complet, source: "name" };
    }
    // Partial name match
    if (name) {
      for (const r of ressources) {
        const n = r.nom_complet.toLowerCase();
        if (n.includes(name) || name.includes(n)) {
          return { id: r.id, nom: r.nom_complet, source: "partial-name" };
        }
      }
    }
    const r = pickRandom(ressources);
    return { id: r.id, nom: r.nom_complet, source: "random" };
  }

  type Prep = {
    id: string;
    code: string;
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
    responsableRessourceId: string;
    statut: string;
    date_identification: Date | null;
    date_revision: Date | null;
    date_echeance: Date | null;
    commentaires: string;
    comiteId: string | null;
    equipeId: string | null;
    createdAt: Date;
    updatedAt: Date;
    assignSource: string;
    chantierMapped: boolean;
  };

  const prepared: Prep[] = [];
  let randomAssign = 0;
  let nameAssign = 0;
  let idAssign = 0;
  let chantierOk = 0;
  let chantierMiss = 0;

  for (const row of rows) {
    const chantierId = resolveChantierId(row.chantierId ?? "", row);
    if (chantierId) chantierOk++;
    else chantierMiss++;

    const res = resolveRessource(
      row.responsableRessourceId ?? "",
      row.responsable ?? ""
    );
    if (res.source === "random") randomAssign++;
    else if (res.source === "id") idAssign++;
    else nameAssign++;

    const team = await resolveRaidEquipeId({
      responsableRessourceId: res.id,
      chantierId,
    });

    const createdAt = parseDate(row.createdAt) ?? new Date();
    const updatedAt = parseDate(row.updatedAt) ?? createdAt;

    prepared.push({
      id: (row.id ?? "").trim() || crypto.randomUUID(),
      code: (row.code ?? "").trim(),
      type: (row.type ?? "Action").trim() || "Action",
      intitule: (row.intitule ?? "").trim() || "(sans intitulé)",
      description: row.description ?? "",
      categorie: row.categorie ?? "",
      chantierId,
      domaine: row.domaine ?? "",
      probabilite: parseIntOrNull(row.probabilite ?? ""),
      impact: parseIntOrNull(row.impact ?? ""),
      strategie: row.strategie ?? "",
      mitigation: row.mitigation ?? "",
      responsable: res.nom,
      responsableRessourceId: res.id,
      statut: (row.statut ?? "").trim() || "Ouvert",
      date_identification: parseDate(row.date_identification ?? ""),
      date_revision: parseDate(row.date_revision ?? ""),
      date_echeance: parseDate(row.date_echeance ?? ""),
      commentaires: row.commentaires ?? "",
      // comiteId from export may not exist in current DB
      comiteId: null,
      equipeId: team.equipeId,
      createdAt,
      updatedAt,
      assignSource: res.source,
      chantierMapped: !!chantierId,
    });
  }

  console.log("\nMapping summary:");
  console.log(`  assignee by id:     ${idAssign}`);
  console.log(`  assignee by name:   ${nameAssign}`);
  console.log(`  assignee random:    ${randomAssign}`);
  console.log(`  chantier mapped:    ${chantierOk}`);
  console.log(`  chantier missing:   ${chantierMiss}`);

  // Replace all existing RAID (export is full table dump style)
  console.log("\nClearing existing RaidComment / RaidAuditLog / Raid…");
  await prisma.raidComment.deleteMany({});
  await prisma.raidAuditLog.deleteMany({});
  const deleted = await prisma.raid.deleteMany({});
  console.log(`  deleted raids: ${deleted.count}`);
  // Reset sequences so re-import can reuse A_00001… or keep explicit codes
  await prisma.raidCodeSequence.deleteMany({});

  console.log("Inserting…");
  let inserted = 0;
  const usedCodes = new Set<string>();
  for (const p of prepared) {
    let code: string;
    if (p.code.trim()) {
      const normalized = normalizeRaidCode(p.code);
      if (
        isValidRaidCodeFormat(normalized) &&
        raidCodeMatchesType(normalized, p.type) &&
        !usedCodes.has(normalized)
      ) {
        code = normalized;
      } else {
        code = await allocateNextRaidCode(p.type);
      }
    } else {
      code = await allocateNextRaidCode(p.type);
    }
    usedCodes.add(code);
    const num = parseRaidCodeNumber(code);
    if (num != null) await bumpRaidCodeSequenceIfNeeded(p.type, num);

    await prisma.raid.create({
      data: {
        id: p.id,
        code,
        type: p.type,
        intitule: p.intitule,
        description: p.description,
        categorie: p.categorie,
        chantierId: p.chantierId,
        domaine: p.domaine,
        probabilite: p.probabilite,
        impact: p.impact,
        strategie: p.strategie,
        mitigation: p.mitigation,
        responsable: p.responsable,
        responsableRessourceId: p.responsableRessourceId,
        equipeId: p.equipeId,
        statut: p.statut,
        date_identification: p.date_identification,
        date_revision: p.date_revision,
        date_echeance: p.date_echeance,
        commentaires: p.commentaires,
        comiteId: p.comiteId,
        createdByName: "Import CSV",
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
    });
    await prisma.raidAuditLog.create({
      data: {
        raidId: p.id,
        action: "created",
        summary: `Import CSV — assigné à ${p.responsable} (${p.assignSource})${
          p.equipeId ? " · équipe résolue" : ""
        }`,
        actorName: "Import CSV",
        newValue: p.statut,
        createdAt: p.createdAt,
      },
    });
    inserted++;
  }

  console.log(`\nDone. Inserted ${inserted} RAID entries.`);
  const byType = await prisma.raid.groupBy({
    by: ["type"],
    _count: true,
  });
  console.log("By type:", byType.map((t) => `${t.type}=${t._count}`).join(", "));
  const withTeam = await prisma.raid.count({ where: { equipeId: { not: null } } });
  const withChantier = await prisma.raid.count({
    where: { chantierId: { not: null } },
  });
  console.log(`With chantier: ${withChantier}, with equipe: ${withTeam}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
