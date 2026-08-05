"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, requirePageAccess } from "@/lib/auth";
import { PHASES } from "@/lib/jalon-labels";
import {
  type PlanningPreviewReport,
  type ExistingJalonRow,
  type TemplateRow,
  buildPlanningPreview,
  buildPlanningCsvFromSnapshots,
  emptyPlanningTemplateCsv,
  fallbackTemplates,
  formatDateYmd,
  formatPlanningDateFr,
  sortByPhasePath,
  ymdToUtcDate,
} from "@/lib/jalon-planning-import";
import {
  getSessionJalonWorkflowCaps,
  modeForOperation,
  WORKFLOW_OPERATION,
} from "@/lib/workflow";
import {
  buildPlanningWorkbookBase64,
  buildExcelPlanningPreview,
  excelPlanningFingerprint,
  orderPlanningNodes,
  type ExcelPlanningNode,
  type ExcelPlanningPreview,
  type ExcelTemplateNode,
} from "@/lib/jalon-planning-excel";

async function requireDataAdmin() {
  await requireRole("Admin");
  await requirePageAccess("/admin/donnees");
}

async function assertJalonBulkDirect() {
  const session = await requireAuth();
  const caps = await getSessionJalonWorkflowCaps(session);
  const createMode = modeForOperation(caps, WORKFLOW_OPERATION.CREATE);
  const updateMode = modeForOperation(caps, WORKFLOW_OPERATION.UPDATE);
  if (createMode !== "DIRECT" || updateMode !== "DIRECT") {
    throw new Error(
      "L'import de planning jalons n'est disponible qu'en mode Direct (création et modification). Ajustez les droits workflow du rôle Administrateur."
    );
  }
}

async function assertJalonPurgeDirect() {
  const session = await requireAuth();
  const caps = await getSessionJalonWorkflowCaps(session);
  const deleteMode = modeForOperation(caps, WORKFLOW_OPERATION.DELETE);
  if (deleteMode !== "DIRECT") {
    throw new Error(
      "La purge d'un planning n'est disponible qu'en mode Direct pour la suppression des jalons. Ajustez les droits workflow du rôle Administrateur."
    );
  }
}

const PHASE_WEIGHT_KEYS: Record<string, string> = {
  Précadrage: "poids_precadrage",
  Cadrage: "poids_cadrage",
  Exécution: "poids_execution",
  Clôture: "poids_cloture",
};

const PHASE_TO_STATUT: Record<string, string> = {
  Précadrage: "Pré cadrage",
  Cadrage: "Cadrage",
  Exécution: "Exécution",
  Clôture: "Clôture",
};

async function recalculateChantierProgress(chantierId: string) {
  const settings = await prisma.settings.findFirst({ where: { id: 1 } });
  const jalons = await prisma.jalon.findMany({
    where: { chantierId },
    select: { phase: true, statut: true },
  });

  let totalProgress = 0;
  let currentStatut = "Non démarré";

  for (const phase of PHASES) {
    const phaseJalons = jalons.filter((j) => j.phase === phase);
    if (phaseJalons.length === 0) continue;

    const weightKey = PHASE_WEIGHT_KEYS[phase];
    const weight =
      ((settings as Record<string, unknown> | null)?.[weightKey] as number) ??
      0;
    const completed = phaseJalons.filter((j) => j.statut === "Atteint").length;
    const hasStarted = phaseJalons.some(
      (j) => j.statut === "En cours" || j.statut === "Atteint"
    );
    totalProgress += (completed / phaseJalons.length) * weight;

    if (hasStarted) {
      currentStatut = PHASE_TO_STATUT[phase];
    }
  }

  if (currentStatut === "Clôture") {
    const clotureJalons = jalons.filter((j) => j.phase === "Clôture");
    if (
      clotureJalons.length > 0 &&
      clotureJalons.every((j) => j.statut === "Atteint")
    ) {
      currentStatut = "Clôturé";
    }
  }

  await prisma.chantier.update({
    where: { id: chantierId },
    data: { avancement: Math.round(totalProgress), statut: currentStatut },
  });
}

export type ChantierPlanningOption = {
  id: string;
  code: string;
  nom: string;
  jalonCount: number;
  date_debut: string;
  date_fin: string;
};

export async function listChantiersForPlanningImport(): Promise<
  ChantierPlanningOption[]
> {
  await requireDataAdmin();
  const rows = await prisma.chantier.findMany({
    select: {
      id: true,
      code: true,
      nom: true,
      date_debut: true,
      date_fin: true,
      _count: { select: { jalons: true } },
    },
    orderBy: { code: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    nom: r.nom,
    jalonCount: r._count.jalons,
    date_debut: formatPlanningDateFr(r.date_debut),
    date_fin: formatPlanningDateFr(r.date_fin),
  }));
}

async function loadTemplates(): Promise<TemplateRow[]> {
  const dbTemplates = await prisma.jalonTemplate.findMany({
    orderBy: [{ ordre: "asc" }],
  });
  if (dbTemplates.length > 0) {
    return sortByPhasePath(
      dbTemplates.map((t) => ({
        phase: t.phase,
        nom: t.nom,
        ordre: t.ordre,
        offsetPct: t.offsetPct,
      }))
    );
  }
  // JALON_TEMPLATES is already in phase-path order
  return fallbackTemplates();
}

async function loadChantierContext(chantierId: string) {
  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    select: {
      id: true,
      code: true,
      nom: true,
      date_debut: true,
      date_fin: true,
    },
  });
  if (!chantier) throw new Error("Chantier non trouvé");

  const existingRaw = await prisma.jalon.findMany({
    where: { chantierId },
  });

  // Métier : Précadrage > Cadrage > Exécution > Clôture, puis ordre
  const existing: ExistingJalonRow[] = sortByPhasePath(
    existingRaw.map((j) => ({
      id: j.id,
      phase: j.phase,
      nom: j.nom,
      ordre: j.ordre,
      date_cible: j.date_cible,
      date_reelle: j.date_reelle,
      statut: j.statut,
      description: j.description,
      livrables: j.livrables,
      commentaire: j.commentaire,
      updatedAt: j.updatedAt,
    }))
  );

  const templates = await loadTemplates();

  return { chantier, existing, templates };
}

/**
 * Export planning actuel du chantier (ou modèle template si vide).
 */
export async function exportJalonPlanningCsv(
  chantierId: string,
  mode: "current" | "template" | "empty" = "current"
): Promise<{ fileName: string; csv: string }> {
  await requireDataAdmin();
  if (!chantierId) throw new Error("Chantier requis");

  const { chantier, existing, templates } = await loadChantierContext(
    chantierId
  );
  const date = new Date().toISOString().slice(0, 10);
  const code = chantier.code;

  if (mode === "empty") {
    return {
      fileName: `planning_jalons_${code}_modele_vide_${date}.csv`,
      csv: emptyPlanningTemplateCsv(),
    };
  }

  if (mode === "template" || existing.length === 0) {
    const { calculateDateCible } = await import("@/lib/jalon-labels");
    const rows = templates.map((t) => ({
      phase: t.phase,
      nom: t.nom,
      ordre: t.ordre,
      date_cible: formatDateYmd(
        calculateDateCible(chantier.date_debut, chantier.date_fin, t.offsetPct)
      ),
      date_reelle: "",
      statut: "Planifié",
      description: "",
      livrables: "",
      commentaire: "",
    }));
    return {
      fileName: `planning_jalons_${code}_template_${date}.csv`,
      csv: buildPlanningCsvFromSnapshots(code, rows),
    };
  }

  const rows = existing.map((j) => ({
    phase: j.phase,
    nom: j.nom,
    ordre: j.ordre,
    date_cible: formatDateYmd(j.date_cible),
    date_reelle: formatDateYmd(j.date_reelle),
    statut: j.statut,
    description: j.description,
    livrables: j.livrables,
    commentaire: j.commentaire,
  }));
  return {
    fileName: `planning_jalons_${code}_export_${date}.csv`,
    csv: buildPlanningCsvFromSnapshots(code, rows),
  };
}

/**
 * Chargement à blanc — aucune écriture DB.
 */
export async function previewJalonPlanningImport(
  chantierId: string,
  csvText: string
): Promise<PlanningPreviewReport> {
  await requireDataAdmin();
  await assertJalonBulkDirect();
  if (!chantierId) throw new Error("Chantier requis");
  if (!csvText?.trim()) throw new Error("Fichier CSV vide");

  const { chantier, existing, templates } = await loadChantierContext(
    chantierId
  );

  return buildPlanningPreview({
    chantierId: chantier.id,
    chantierCode: chantier.code,
    chantierNom: chantier.nom,
    dateDebut: chantier.date_debut,
    dateFin: chantier.date_fin,
    existing,
    templates,
    csvText,
  });
}

export type ConfirmPlanningResult = {
  created: number;
  updated: number;
  skipped: number;
  willApplyTemplate: boolean;
  chantierCode: string;
};

/**
 * Rejoue le dry-run serveur puis injecte si 0 erreur et fingerprint OK.
 */
export async function confirmJalonPlanningImport(
  chantierId: string,
  csvText: string,
  expectedFingerprint: string
): Promise<ConfirmPlanningResult> {
  await requireDataAdmin();
  await assertJalonBulkDirect();
  if (!chantierId) throw new Error("Chantier requis");
  if (!csvText?.trim()) throw new Error("Fichier CSV vide");

  const { chantier, existing, templates } = await loadChantierContext(
    chantierId
  );

  const report = buildPlanningPreview({
    chantierId: chantier.id,
    chantierCode: chantier.code,
    chantierNom: chantier.nom,
    dateDebut: chantier.date_debut,
    dateFin: chantier.date_fin,
    existing,
    templates,
    csvText,
  });

  if (report.formatErrors.length > 0) {
    throw new Error(report.formatErrors.join(" · "));
  }
  if (report.errorCount > 0) {
    throw new Error(
      `Import refusé : ${report.errorCount} ligne(s) en erreur. Corrigez le fichier et relancez l'analyse à blanc.`
    );
  }
  if (report.fingerprint !== expectedFingerprint) {
    throw new Error(
      "Les jalons du chantier ont changé depuis la simulation. Relancez l'analyse à blanc puis confirmez à nouveau."
    );
  }

  const ops = report.rows
    .filter((r) => r.apply && (r.action === "CREATE" || r.action === "UPDATE"))
    .map((r) => r.apply!);

  if (ops.length === 0 && report.skipCount === report.total) {
    return {
      created: 0,
      updated: 0,
      skipped: report.skipCount,
      willApplyTemplate: report.willApplyTemplate,
      chantierCode: chantier.code,
    };
  }

  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    // Safety: cas 1 must still be empty at write time
    if (report.willApplyTemplate) {
      const count = await tx.jalon.count({ where: { chantierId } });
      if (count > 0) {
        throw new Error(
          "Des jalons ont été créés entre la simulation et la confirmation. Relancez l'analyse à blanc."
        );
      }
    }

    for (const op of ops) {
      if (op.kind === "CREATE") {
        await tx.jalon.create({
          data: {
            chantierId,
            phase: op.phase,
            nom: op.nom,
            ordre: op.ordre,
            date_cible: ymdToUtcDate(op.date_cible),
            date_reelle: op.date_reelle ? ymdToUtcDate(op.date_reelle) : null,
            statut: op.statut,
            description: op.description,
            livrables: op.livrables,
            commentaire: op.commentaire,
          },
        });
        created++;
      } else {
        const data: {
          ordre?: number;
          date_cible?: Date;
          date_reelle?: Date | null;
          statut?: string;
          description?: string;
          livrables?: string;
          commentaire?: string;
        } = {};
        if (op.data.ordre !== undefined) data.ordre = op.data.ordre;
        if (op.data.date_cible) data.date_cible = ymdToUtcDate(op.data.date_cible);
        if (op.data.clear_date_reelle) data.date_reelle = null;
        else if (op.data.date_reelle)
          data.date_reelle = ymdToUtcDate(op.data.date_reelle);
        if (op.data.statut !== undefined) data.statut = op.data.statut;
        if (op.data.description !== undefined)
          data.description = op.data.description;
        if (op.data.livrables !== undefined) data.livrables = op.data.livrables;
        if (op.data.commentaire !== undefined)
          data.commentaire = op.data.commentaire;

        await tx.jalon.update({
          where: { id: op.id },
          data,
        });
        updated++;
      }
    }
  });

  await recalculateChantierProgress(chantierId);

  revalidatePath("/");
  revalidatePath("/jalons");
  revalidatePath("/chantiers");
  revalidatePath(`/chantiers/${chantierId}`);
  revalidatePath("/admin/donnees");

  return {
    created,
    updated,
    skipped: report.skipCount,
    willApplyTemplate: report.willApplyTemplate,
    chantierCode: chantier.code,
  };
}

async function loadExcelPlanningContext(chantierId: string) {
  const chantier = await prisma.chantier.findUnique({
    where: { id: chantierId },
    select: {
      id: true, code: true, nom: true, date_debut: true, date_fin: true,
      jalons: {
        orderBy: [{ ordre: "asc" }],
        include: {
          workstreams: {
            orderBy: [{ ordre: "asc" }],
            include: { activites: { orderBy: [{ ordre: "asc" }] } },
          },
        },
      },
    },
  });
  if (!chantier) throw new Error("Chantier non trouvé");
  const nodes: ExcelPlanningNode[] = [];
  for (const j of chantier.jalons) {
    nodes.push({ id:j.id,level:"JALON",parentId:null,phase:j.phase,jalon:j.nom,workstream:"",activite:"",ordre:j.ordre,dateDebut:j.date_debut,dateFin:j.date_cible,dateReelle:j.date_reelle,statut:j.statut,description:j.description,livrables:j.livrables,commentaire:j.commentaire,updatedAt:j.updatedAt });
    for (const w of j.workstreams) {
      nodes.push({ id:w.id,level:"WORKSTREAM",parentId:j.id,phase:j.phase,jalon:j.nom,workstream:w.nom,activite:"",ordre:w.ordre,dateDebut:w.date_debut,dateFin:w.date_fin,dateReelle:w.date_reelle,statut:w.statut,description:w.description,livrables:"",commentaire:w.commentaire,updatedAt:w.updatedAt });
      for (const a of w.activites) nodes.push({ id:a.id,level:"ACTIVITE",parentId:w.id,phase:j.phase,jalon:j.nom,workstream:w.nom,activite:a.nom,ordre:a.ordre,dateDebut:a.date_debut,dateFin:a.date_fin,dateReelle:a.date_reelle,statut:a.statut,description:a.description,livrables:"",commentaire:a.commentaire,updatedAt:a.updatedAt });
    }
  }
  return { chantier, nodes };
}

async function loadExcelTemplateNodes(chantierStart: Date, chantierEnd: Date): Promise<ExcelTemplateNode[]> {
  const templates = await prisma.jalonTemplate.findMany({
    orderBy: [{ ordre: "asc" }],
    include: { workstreams: { orderBy: [{ ordre: "asc" }], include: { activites: { orderBy: [{ ordre: "asc" }] } } } },
  });
  const source = templates.length ? templates : [];
  const nodes: ExcelTemplateNode[] = [];
  const { calculateDateCible } = await import("@/lib/jalon-labels");
  if (!source.length) {
    for (const j of fallbackTemplates()) {
      nodes.push({id:"",level:"JALON",parentId:null,phase:j.phase,jalon:j.nom,workstream:"",activite:"",ordre:j.ordre,dateDebut:null,dateFin:calculateDateCible(chantierStart,chantierEnd,j.offsetPct),dateReelle:null,statut:"Planifié",description:"",livrables:"",commentaire:""});
    }
    return nodes;
  }
  for (const j of source) {
    const target = calculateDateCible(chantierStart, chantierEnd, j.offsetPct);
    nodes.push({id:"",level:"JALON",parentId:null,phase:j.phase,jalon:j.nom,workstream:"",activite:"",ordre:j.ordre,dateDebut:null,dateFin:target,dateReelle:null,statut:"Planifié",description:"",livrables:"",commentaire:""});
    for(const w of j.workstreams){
      nodes.push({id:"",level:"WORKSTREAM",parentId:null,phase:j.phase,jalon:j.nom,workstream:w.nom,activite:"",ordre:w.ordre,dateDebut:null,dateFin:null,dateReelle:null,statut:"Planifié",description:w.description,livrables:"",commentaire:""});
      for(const a of w.activites) nodes.push({id:"",level:"ACTIVITE",parentId:null,phase:j.phase,jalon:j.nom,workstream:w.nom,activite:a.nom,ordre:a.ordre,dateDebut:null,dateFin:null,dateReelle:null,statut:"Planifié",description:a.description,livrables:"",commentaire:""});
    }
  }
  return nodes;
}

export async function exportJalonPlanningExcel(chantierId:string, mode:"current"|"template"|"empty"="current") {
  await requireDataAdmin();
  const { chantier, nodes } = await loadExcelPlanningContext(chantierId);
  const templateNodes = mode === "template" ? await loadExcelTemplateNodes(chantier.date_debut, chantier.date_fin) : [];
  const rawNodes = mode === "empty" ? [] : mode === "template" ? templateNodes : nodes.length ? nodes : await loadExcelTemplateNodes(chantier.date_debut, chantier.date_fin);
  const exportedNodes = orderPlanningNodes(rawNodes, mode === "template" || (!nodes.length && mode === "current") ? "template" : "current");
  const suffix = mode === "empty" ? "vide" : mode === "template" ? "template" : "planning";
  return { fileName:`planning_${chantier.code}_${suffix}_${new Date().toISOString().slice(0,10)}.xlsx`, base64:await buildPlanningWorkbookBase64({chantierCode:chantier.code,chantierNom:chantier.nom,nodes:exportedNodes}), fingerprint:excelPlanningFingerprint(nodes) };
}

export type PurgeJalonPlanningResult = {
  chantierCode: string;
  jalons: number;
  workstreams: number;
  activites: number;
};

export async function purgeJalonPlanning(
  chantierId: string,
  expectedFingerprint: string,
  chantierCodeConfirmation: string,
  keywordConfirmation: string
): Promise<PurgeJalonPlanningResult> {
  await requireDataAdmin();
  await assertJalonPurgeDirect();
  const { chantier, nodes } = await loadExcelPlanningContext(chantierId);
  if (chantierCodeConfirmation.trim() !== chantier.code) {
    throw new Error(`Le code de confirmation doit être exactement « ${chantier.code} ».`);
  }
  if (keywordConfirmation.trim() !== "PURGE") {
    throw new Error("Le mot de confirmation doit être exactement « PURGE ».");
  }
  if (nodes.length === 0) {
    throw new Error(`Le chantier ${chantier.code} ne contient aucun planning à purger.`);
  }
  if (excelPlanningFingerprint(nodes) !== expectedFingerprint) {
    throw new Error(
      "Le planning a changé depuis la sauvegarde. Téléchargez une nouvelle sauvegarde avant de recommencer la purge."
    );
  }

  const counts = {
    jalons: nodes.filter((node) => node.level === "JALON").length,
    workstreams: nodes.filter((node) => node.level === "WORKSTREAM").length,
    activites: nodes.filter((node) => node.level === "ACTIVITE").length,
  };

  await prisma.$transaction(async (tx) => {
    await tx.jalon.deleteMany({ where: { chantierId } });
    await tx.chantier.update({
      where: { id: chantierId },
      data: { avancement: 0, statut: "Non démarré" },
    });
  });

  revalidatePath(`/chantiers/${chantierId}`);
  revalidatePath(`/chantiers/${chantierId}/gantt`);
  revalidatePath("/gantt");
  revalidatePath("/jalons");
  revalidatePath("/admin/donnees");
  revalidatePath("/");
  return { chantierCode: chantier.code, ...counts };
}

export async function previewJalonPlanningExcel(chantierId:string, base64:string):Promise<ExcelPlanningPreview>{
  await requireDataAdmin(); await assertJalonBulkDirect();
  if(base64.length>20_000_000) throw new Error("Fichier Excel trop volumineux");
  const {chantier,nodes}=await loadExcelPlanningContext(chantierId);
  return buildExcelPlanningPreview({chantierId,chantierCode:chantier.code,chantierNom:chantier.nom,chantierStart:chantier.date_debut,chantierEnd:chantier.date_fin,base64,existing:nodes});
}

export async function confirmJalonPlanningExcel(chantierId:string,base64:string,expectedFingerprint:string){
  await requireDataAdmin(); await assertJalonBulkDirect();
  const {chantier,nodes}=await loadExcelPlanningContext(chantierId);
  if(excelPlanningFingerprint(nodes)!==expectedFingerprint) throw new Error("Le planning a changé depuis la simulation. Relancez l'analyse à blanc.");
  const report=buildExcelPlanningPreview({chantierId,chantierCode:chantier.code,chantierNom:chantier.nom,chantierStart:chantier.date_debut,chantierEnd:chantier.date_fin,base64,existing:nodes});
  if(report.formatErrors.length||report.errorCount) throw new Error("Import refusé : le fichier contient des erreurs.");
  const ops=report.rows.flatMap(r=>r.apply?[r.apply]:[]); let created=0,updated=0;
  const { isAtteintStatut } = await import("@/lib/planning-status-rules");
  await prisma.$transaction(async tx=>{
    const refs=new Map<string,string>(); for(const n of nodes) refs.set(n.id,n.id);
    const date=(v:unknown)=>typeof v==="string"&&v?ymdToUtcDate(v):null;
    // Appliquer d'abord les niveaux bas (ACTIVITE → WORKSTREAM → JALON) pour la règle Atteint
    const ordered=[...ops].sort((a,b)=>{
      const rank=(l:string)=>l==="ACTIVITE"?0:l==="WORKSTREAM"?1:2;
      return rank(a.level)-rank(b.level);
    });
    for(const op of ordered){
      const d=op.data;
      if(op.kind==="UPDATE"&&op.id){
        if(op.level==="JALON") {
          if(isAtteintStatut(String(d.statut))) {
            const { assertJalonCanBeAtteint } = await import("@/lib/planning-status-assert");
            await assertJalonCanBeAtteint(op.id, tx as never);
          }
          await tx.jalon.update({where:{id:op.id},data:{phase:String(d.phase),nom:String(d.jalon),ordre:Number(d.ordre),date_debut:date(d.date_debut),date_cible:date(d.date_fin)!,date_reelle:date(d.date_reelle),statut:String(d.statut),description:String(d.description??""),livrables:String(d.livrables??""),commentaire:String(d.commentaire??"")}});
        }
        else if(op.level==="WORKSTREAM") {
          const parent=refs.get(op.parentRef??""); if(!parent) throw new Error("Parent jalon introuvable pendant le déplacement");
          if(isAtteintStatut(String(d.statut))) {
            const { assertWorkstreamCanBeAtteint } = await import("@/lib/planning-status-assert");
            await assertWorkstreamCanBeAtteint(op.id, tx as never);
          }
          await tx.workstream.update({where:{id:op.id},data:{jalonId:parent,nom:String(d.workstream),ordre:Number(d.ordre),date_debut:date(d.date_debut),date_fin:date(d.date_fin),date_reelle:date(d.date_reelle),statut:String(d.statut),description:String(d.description??""),commentaire:String(d.commentaire??"")}});
        } else {
          const parent=refs.get(op.parentRef??""); if(!parent) throw new Error("Parent workstream introuvable pendant le déplacement");
          await tx.activite.update({where:{id:op.id},data:{workstreamId:parent,nom:String(d.activite),ordre:Number(d.ordre),date_debut:date(d.date_debut),date_fin:date(d.date_fin),date_reelle:date(d.date_reelle),statut:String(d.statut),description:String(d.description??""),commentaire:String(d.commentaire??"")}});
        }
        refs.set(op.ref,op.id); updated++; continue;
      }
      if(op.level==="JALON") { const x=await tx.jalon.create({data:{chantierId,phase:String(d.phase),nom:String(d.jalon),ordre:Number(d.ordre),date_debut:date(d.date_debut),date_cible:date(d.date_fin)!,date_reelle:date(d.date_reelle),statut:String(d.statut),description:String(d.description??""),livrables:String(d.livrables??""),commentaire:String(d.commentaire??"")}}); refs.set(op.ref,x.id); }
      else if(op.level==="WORKSTREAM") { const parent=refs.get(op.parentRef??""); if(!parent) throw new Error("Parent jalon introuvable pendant l'import"); const x=await tx.workstream.create({data:{jalonId:parent,nom:String(d.workstream),ordre:Number(d.ordre),date_debut:date(d.date_debut),date_fin:date(d.date_fin),date_reelle:date(d.date_reelle),statut:String(d.statut),description:String(d.description??""),commentaire:String(d.commentaire??"")}}); refs.set(op.ref,x.id); }
      else { const parent=refs.get(op.parentRef??""); if(!parent) throw new Error("Parent workstream introuvable pendant l'import"); const x=await tx.activite.create({data:{workstreamId:parent,nom:String(d.activite),ordre:Number(d.ordre),date_debut:date(d.date_debut),date_fin:date(d.date_fin),date_reelle:date(d.date_reelle),statut:String(d.statut),description:String(d.description??""),commentaire:String(d.commentaire??"")}}); refs.set(op.ref,x.id); }
      created++;
    }
  });
  await recalculateChantierProgress(chantierId); revalidatePath(`/chantiers/${chantierId}`); revalidatePath("/jalons");
  return {created,updated,skipped:report.skipCount,chantierCode:chantier.code,counts:report.counts};
}
