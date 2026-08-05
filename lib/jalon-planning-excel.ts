import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { PHASES, STATUT_JALON_LIST } from "@/lib/jalon-labels";

export type PlanningLevel = "JALON" | "WORKSTREAM" | "ACTIVITE";
export type PlanningAction = "CREATE" | "UPDATE" | "SKIP" | "ERROR";
export type ExcelPlanningNode = {
  id:string; level:PlanningLevel; parentId:string|null; phase:string; jalon:string;
  workstream:string; activite:string; ordre:number; dateDebut:Date|null;
  dateFin:Date|null; dateReelle:Date|null; statut:string; description:string;
  livrables:string; commentaire:string; updatedAt:Date;
};
export type ExcelTemplateNode = Omit<ExcelPlanningNode,"updatedAt">;
export type PlanningChange = { field:string; from:string; to:string };
export type ExcelPlanningOp = { kind:"CREATE"|"UPDATE"; level:PlanningLevel; ref:string; id?:string; parentRef?:string; data:Record<string,string|number|null> };
export type ExcelPreviewRow = { line:number; level:PlanningLevel; action:PlanningAction; label:string; parent:string; errors:string[]; warnings:string[]; changes:PlanningChange[]; apply?:ExcelPlanningOp };
export type ExcelPlanningPreview = { chantierId:string; chantierCode:string; chantierNom:string; total:number; createCount:number; updateCount:number; skipCount:number; errorCount:number; rows:ExcelPreviewRow[]; formatErrors:string[]; fingerprint:string; counts:Record<PlanningLevel,{create:number;update:number;skip:number;error:number}> };

export const PLANNING_HEADERS = ["Niveau *","Phase","Élément *","Ordre","Date de début","Date de fin / cible","Date réelle","Statut","Description","Livrables","Commentaire","ID technique"] as const;
/** Même catalogue que les jalons (Atteint = terminé métier). */
const DETAIL_STATUSES=["Planifié","En cours","Atteint","Reporté","Annulé"];
const norm=(v:unknown)=>String(v??"").normalize("NFC").trim().replace(/\s+/g," ");
const key=(v:unknown)=>norm(v).toLocaleLowerCase("fr");
const iso=(d:Date|null)=>d?`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`:"";
const display=(v:unknown)=>v instanceof Date?iso(v).split("-").reverse().join("/"):String(v??"");
const labelOf=(n:ExcelPlanningNode|ExcelTemplateNode)=>n.activite||n.workstream||n.jalon;
const dateTime=(n:ExcelPlanningNode|ExcelTemplateNode)=>n.dateDebut?.getTime()??n.dateFin?.getTime()??Number.MAX_SAFE_INTEGER;

export function orderPlanningNodes(nodes:Array<ExcelPlanningNode|ExcelTemplateNode>, mode:"current"|"template") {
  const jalons=nodes.filter(n=>n.level==="JALON");
  const compare=(a:ExcelPlanningNode|ExcelTemplateNode,b:ExcelPlanningNode|ExcelTemplateNode)=>mode==="current"?(dateTime(a)-dateTime(b)||a.ordre-b.ordre||labelOf(a).localeCompare(labelOf(b),"fr")):(a.ordre-b.ordre||labelOf(a).localeCompare(labelOf(b),"fr"));
  jalons.sort((a,b)=>mode==="template"?((PHASES as readonly string[]).indexOf(a.phase)-(PHASES as readonly string[]).indexOf(b.phase)||compare(a,b)):compare(a,b));
  const out:Array<ExcelPlanningNode|ExcelTemplateNode>=[];
  for(const j of jalons){
    out.push(j);
    const workstreams=nodes.filter(n=>n.level==="WORKSTREAM"&&(n.parentId===j.id||(!n.parentId&&key(n.jalon)===key(j.jalon)&&key(n.phase)===key(j.phase)))).sort(compare);
    for(const w of workstreams){
      out.push(w);
      out.push(...nodes.filter(n=>n.level==="ACTIVITE"&&(n.parentId===w.id||(!n.parentId&&key(n.workstream)===key(w.workstream)&&key(n.jalon)===key(j.jalon)&&key(n.phase)===key(j.phase)))).sort(compare));
    }
  }
  return out;
}

function parseDate(value:unknown):Date|null|"INVALID"{
  if(value===null||value===undefined||value==="")return null;
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return new Date(Date.UTC(value.getFullYear(),value.getMonth(),value.getDate()));
  if(typeof value==="number"){const p=XLSX.SSF.parse_date_code(value);return p?new Date(Date.UTC(p.y,p.m-1,p.d)):"INVALID";}
  const s=norm(value),fr=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s),ymd=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const p=fr?[+fr[3],+fr[2],+fr[1]]:ymd?[+ymd[1],+ymd[2],+ymd[3]]:null;if(!p)return "INVALID";
  const d=new Date(Date.UTC(p[0],p[1]-1,p[2]));return d.getUTCFullYear()===p[0]&&d.getUTCMonth()===p[1]-1&&d.getUTCDate()===p[2]?d:"INVALID";
}

export async function buildPlanningWorkbookBase64(args:{chantierCode:string;chantierNom:string;nodes:Array<ExcelPlanningNode|ExcelTemplateNode>}):Promise<string>{
  const wb=new ExcelJS.Workbook(); wb.creator="TransfoHub"; wb.created=new Date();
  const guide=wb.addWorksheet("Mode d'emploi",{views:[{showGridLines:false}]});
  guide.columns=[{width:32},{width:95}];
  guide.addRow(["PLANNING DES JALONS",`${args.chantierCode} — ${args.chantierNom}`]);
  guide.addRow(["Principe","L'ordre des lignes définit l'arborescence : un workstream dépend du jalon placé juste avant ; une activité dépend du workstream placé juste avant."]);
  guide.addRow(["Ajouter","Insérez une ligne au bon endroit, choisissez son Niveau et laissez l'ID technique vide."]);
  guide.addRow(["Modifier / déplacer","Modifiez la ligne ou déplacez-la sous son nouveau parent. Ne modifiez jamais l'ID technique."]);
  guide.addRow(["Conservation","Un élément absent du fichier reste en base. Aucune suppression automatique."]);
  guide.addRow(["Dates","Utilisez le format JJ/MM/AAAA. Une date cible est obligatoire pour chaque jalon."]);
  guide.getRow(1).height=28; guide.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"},size:14}; guide.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0A3C74"}};
  for(let r=2;r<=6;r++){guide.getCell(r,1).font={bold:true,color:{argb:"FF0A3C74"}};guide.getCell(r,2).alignment={wrapText:true,vertical:"top"};guide.getRow(r).height=34;}

  const planning=wb.addWorksheet("Planning",{views:[{state:"frozen",ySplit:1,showGridLines:false}],properties:{outlineLevelRow:2}});
  planning.columns=[
    {header:PLANNING_HEADERS[0],key:"niveau",width:15},{header:PLANNING_HEADERS[1],key:"phase",width:18},{header:PLANNING_HEADERS[2],key:"element",width:48},{header:PLANNING_HEADERS[3],key:"ordre",width:10},
    {header:PLANNING_HEADERS[4],key:"debut",width:17},{header:PLANNING_HEADERS[5],key:"fin",width:19},{header:PLANNING_HEADERS[6],key:"reelle",width:17},{header:PLANNING_HEADERS[7],key:"statut",width:18},
    {header:PLANNING_HEADERS[8],key:"description",width:42},{header:PLANNING_HEADERS[9],key:"livrables",width:34},{header:PLANNING_HEADERS[10],key:"commentaire",width:38},{header:PLANNING_HEADERS[11],key:"id",width:14,hidden:true},
  ];
  planning.autoFilter={from:"A1",to:"K1"}; planning.getRow(1).height=28;
  planning.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:"FFFFFFFF"}};cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF0A3C74"}};cell.alignment={vertical:"middle"};});
  for(const n of args.nodes){
    const row=planning.addRow({niveau:n.level==="ACTIVITE"?"Activité":n.level==="WORKSTREAM"?"Workstream":"Jalon",phase:n.level==="JALON"?n.phase:"",element:labelOf(n),ordre:n.ordre,debut:n.dateDebut??null,fin:n.dateFin??null,reelle:n.dateReelle??null,statut:n.statut,description:n.description,livrables:n.livrables,commentaire:n.commentaire,id:n.id||""});
    const isJ=n.level==="JALON",isW=n.level==="WORKSTREAM"; row.height=isJ?26:23; row.outlineLevel=isJ?0:isW?1:2;
    row.eachCell({includeEmpty:true},cell=>{cell.alignment={vertical:"middle",wrapText:typeof cell.col==="number"&&[9,10,11].includes(cell.col)};cell.border={bottom:{style:"hair",color:{argb:"FFD9E2EC"}}};});
    const fill=isJ?"FF0A3C74":isW?"FFDDF7F6":"FFF4F7FB",font=isJ?"FFFFFFFF":"FF17324D";
    for(let c=1;c<=11;c++){row.getCell(c).fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};row.getCell(c).font={color:{argb:font},bold:isJ||(isW&&c<=3)};}
    row.getCell(3).alignment={vertical:"middle",indent:isJ?0:isW?1:2,wrapText:false};
    for(const c of [5,6,7])row.getCell(c).numFmt="dd/mm/yyyy";
  }
  for(let r=2;r<=1000;r++){
    planning.getCell(r,1).dataValidation={type:"list",allowBlank:false,formulae:["'Listes'!$E$2:$E$4"],showErrorMessage:true,errorTitle:"Niveau invalide",error:"Choisissez Jalon, Workstream ou Activité."};
    planning.getCell(r,2).dataValidation={type:"list",allowBlank:true,formulae:["'Listes'!$A$2:$A$5"]};
    planning.getCell(r,8).dataValidation={type:"list",allowBlank:true,formulae:["'Listes'!$D$2:$D$10"]};
  }
  planning.addConditionalFormatting({ref:"A2:K1000",rules:[
    {type:"expression",priority:1,formulae:['$A2="Jalon"'],style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:"FF0A3C74"},fgColor:{argb:"FF0A3C74"}},font:{bold:true,color:{argb:"FFFFFFFF"}}}},
    {type:"expression",priority:2,formulae:['$A2="Workstream"'],style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:"FFDDF7F6"},fgColor:{argb:"FFDDF7F6"}},font:{color:{argb:"FF17324D"}}}},
    {type:"expression",priority:3,formulae:['$A2="Activité"'],style:{fill:{type:"pattern",pattern:"solid",bgColor:{argb:"FFF4F7FB"},fgColor:{argb:"FFF4F7FB"}},font:{color:{argb:"FF17324D"}}}},
  ]});
  const lists=wb.addWorksheet("Listes",{state:"veryHidden"});
  lists.addRow(["Phases","Statuts jalon","Statuts détail","Tous statuts","Niveaux"]);
  const allStatuses=[...new Set([...STATUT_JALON_LIST,...DETAIL_STATUSES])];
  const max=Math.max(PHASES.length,STATUT_JALON_LIST.length,DETAIL_STATUSES.length,allStatuses.length);
  const levels=["Jalon","Workstream","Activité"];
  for(let i=0;i<max;i++)lists.addRow([PHASES[i]??"",STATUT_JALON_LIST[i]??"",DETAIL_STATUSES[i]??"",allStatuses[i]??"",levels[i]??""]);
  const buffer=await wb.xlsx.writeBuffer(); return Buffer.from(buffer).toString("base64");
}

function fingerprint(nodes:ExcelPlanningNode[]){return nodes.map(n=>`${n.level}:${n.id}:${n.updatedAt.toISOString()}`).sort().join("|");}

export function buildExcelPlanningPreview(args:{chantierId:string;chantierCode:string;chantierNom:string;chantierStart:Date;chantierEnd:Date;base64:string;existing:ExcelPlanningNode[]}):ExcelPlanningPreview{
  const formatErrors:string[]=[],preview:ExcelPreviewRow[]=[];let wb:XLSX.WorkBook;
  try{wb=XLSX.read(args.base64,{type:"base64",cellDates:true});}catch{wb=XLSX.utils.book_new();formatErrors.push("Classeur Excel illisible.");}
  const ws=wb.Sheets.Planning;if(!ws)formatErrors.push("Onglet obligatoire « Planning » introuvable.");
  const raw=ws?XLSX.utils.sheet_to_json<Record<string,unknown>>(ws,{defval:"",raw:true}):[];
  const byId=new Map(args.existing.map(n=>[n.id,n]));
  const restoreIntoEmptyPlanning=args.existing.length===0;
  let currentJalon:{ref:string;id?:string;phase:string;label:string}|null=null;
  let currentWs:{ref:string;id?:string;label:string}|null=null;
  const seen=new Map<string,number>();
  raw.forEach((r,index)=>{
    const line=index+2,errors:string[]=[],warnings:string[]=[];const nk=key(r["Niveau *"]);
    const level:PlanningLevel=nk==="jalon"?"JALON":nk==="workstream"?"WORKSTREAM":nk==="activite"||nk==="activité"?"ACTIVITE":"JALON";
    if(!["jalon","workstream","activite","activité"].includes(nk))errors.push("Niveau invalide.");
    const label=norm(r["Élément *"]),phaseRaw=norm(r.Phase),phase=level==="JALON"?((PHASES as readonly string[]).find(p=>key(p)===key(phaseRaw))??phaseRaw):(currentJalon?.phase??"");
    if(!label)errors.push("Élément obligatoire."); if(level==="JALON"&&!PHASES.some(p=>key(p)===key(phase)))errors.push("Phase obligatoire ou invalide pour un jalon.");
    if(level==="WORKSTREAM"&&!currentJalon)errors.push("Placez ce workstream après son jalon parent.");
    if(level==="ACTIVITE"&&(!currentJalon||!currentWs))errors.push("Placez cette activité après son workstream parent.");
    const start=parseDate(r["Date de début"]),end=parseDate(r["Date de fin / cible"]),actual=parseDate(r["Date réelle"]);
    if(start==="INVALID")errors.push("Date de début invalide.");if(end==="INVALID")errors.push("Date de fin / cible invalide.");if(actual==="INVALID")errors.push("Date réelle invalide.");
    if(level==="JALON"&&!end)errors.push("Date cible obligatoire pour un jalon.");if(start instanceof Date&&end instanceof Date&&start>end)errors.push("Date de début postérieure à la date de fin / cible.");
    if(start instanceof Date&&(start<args.chantierStart||start>args.chantierEnd))warnings.push("Date de début hors période du chantier.");if(end instanceof Date&&(end<args.chantierStart||end>args.chantierEnd))warnings.push("Date de fin / cible hors période du chantier.");
    const ordre=Number(r.Ordre||0);if(!Number.isInteger(ordre)||ordre<0)errors.push("Ordre invalide.");
    // Ancien libellé Excel « Terminé » / « Bloqué » → catalogue unifié jalons
    let statut=norm(r.Statut)||"Planifié";
    if(key(statut)==="termine"||key(statut)==="terminee")statut="Atteint";
    if(key(statut)==="bloque")statut="Reporté";
    if(level==="JALON"&&!STATUT_JALON_LIST.some(s=>key(s)===key(statut)))errors.push("Statut de jalon invalide.");
    if(level!=="JALON"&&!DETAIL_STATUSES.some(s=>key(s)===key(statut)))errors.push("Statut de workstream ou d'activité invalide.");
    const id=norm(r["ID technique"]);let existing=id?byId.get(id):undefined;if(id&&!existing&&!restoreIntoEmptyPlanning)errors.push("ID technique inconnu.");if(id&&!existing&&restoreIntoEmptyPlanning)warnings.push("ID technique de sauvegarde ignoré : l'élément sera recréé avec un nouvel identifiant.");if(existing&&existing.level!==level)errors.push("L'ID ne correspond pas au niveau indiqué.");
    if(!existing&&!id){
      existing=args.existing.find(n=>n.level===level&&key(labelOf(n))===key(label)&&(level==="JALON"?key(n.phase)===key(phase):level==="WORKSTREAM"?n.parentId===currentJalon?.id:n.parentId===currentWs?.id));
    }
    const parentRef=level==="WORKSTREAM"?currentJalon?.ref:level==="ACTIVITE"?currentWs?.ref:undefined;
    const duplicateKey=`${level}|${parentRef??phase}|${key(label)}`;const first=seen.get(duplicateKey);if(first)errors.push(`Doublon dans le classeur (ligne ${first}).`);else seen.set(duplicateKey,line);
    const data:Record<string,string|number|null>={phase,jalon:level==="JALON"?label:(currentJalon?.label??""),workstream:level==="WORKSTREAM"?label:level==="ACTIVITE"?(currentWs?.label??""):"",activite:level==="ACTIVITE"?label:"",ordre,date_debut:start instanceof Date?iso(start):null,date_fin:end instanceof Date?iso(end):null,date_reelle:actual instanceof Date?iso(actual):null,statut,description:norm(r.Description),livrables:norm(r.Livrables),commentaire:norm(r.Commentaire)};
    const changes:PlanningChange[]=[];
    if(existing){const old:Record<string,unknown>={phase:existing.phase,jalon:existing.jalon,workstream:existing.workstream,activite:existing.activite,ordre:existing.ordre,date_debut:iso(existing.dateDebut),date_fin:iso(existing.dateFin),date_reelle:iso(existing.dateReelle),statut:existing.statut,description:existing.description,livrables:existing.livrables,commentaire:existing.commentaire,parent:existing.parentId??""};for(const [f,v]of Object.entries(data))if(String(old[f]??"")!==String(v??""))changes.push({field:f,from:display(old[f]),to:display(v)});if(level!=="JALON"&&existing.parentId!==parentRef)changes.push({field:"rattachement",from:existing.parentId??"—",to:parentRef??"—"});}
    const ref=existing?.id??`new:${line}`,action:PlanningAction=errors.length?"ERROR":existing?(changes.length?"UPDATE":"SKIP"):"CREATE";
    if(level==="JALON"){currentJalon={ref,id:existing?.id,phase,label};currentWs=null;}else if(level==="WORKSTREAM"){currentWs={ref,id:existing?.id,label};}
    preview.push({line,level,action,label,parent:level==="JALON"?phase:level==="WORKSTREAM"?(currentJalon?.label??"—"):(currentWs?.label??"—"),errors,warnings,changes,apply:action==="CREATE"||action==="UPDATE"?{kind:action,level,ref,id:existing?.id,parentRef,data}:undefined});
  });
  const counts={JALON:{create:0,update:0,skip:0,error:0},WORKSTREAM:{create:0,update:0,skip:0,error:0},ACTIVITE:{create:0,update:0,skip:0,error:0}};for(const r of preview)counts[r.level][r.action.toLowerCase() as "create"|"update"|"skip"|"error"]++;
  return{chantierId:args.chantierId,chantierCode:args.chantierCode,chantierNom:args.chantierNom,total:preview.length,createCount:preview.filter(r=>r.action==="CREATE").length,updateCount:preview.filter(r=>r.action==="UPDATE").length,skipCount:preview.filter(r=>r.action==="SKIP").length,errorCount:preview.filter(r=>r.action==="ERROR").length,rows:preview,formatErrors,fingerprint:fingerprint(args.existing),counts};
}

export const excelPlanningFingerprint=fingerprint;
