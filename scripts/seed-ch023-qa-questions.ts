/**
 * Seed 10 Q&A questions on CH_023 for Backlog Consultation.
 * Run: npx tsx scripts/seed-ch023-qa-questions.ts
 */
import { createPrismaClient } from "../lib/create-prisma";
import { encodeAffecteeA } from "../lib/consultation-affectation";
import {
  resolveChantierRoleTag,
  chantierRoleTagRank,
} from "../lib/consultation-affectation";

const prisma = createPrismaClient();

async function main() {
  const chantier = await prisma.chantier.findFirst({
    where: {
      OR: [
        { code: "CH_023" },
        { code: "CH023" },
        { code: { contains: "023", mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true, nom: true },
  });

  if (!chantier) {
    throw new Error("Chantier CH_023 introuvable.");
  }

  console.log(`Chantier: ${chantier.code} — ${chantier.nom} (${chantier.id})`);

  const membres = await prisma.membreEquipe.findMany({
    where: { chantierId: chantier.id },
    select: {
      role: true,
      is_directeur: true,
      ressource: {
        select: { id: true, nom_complet: true, actif: true },
      },
    },
  });

  type Person = { id: string; nom: string; tag: "DC" | "Sup" | "PMO" | null };
  const byTag = new Map<"DC" | "Sup" | "PMO", Person>();

  for (const m of membres) {
    if (!m.ressource?.actif) continue;
    const tag = resolveChantierRoleTag(m.role, m.is_directeur);
    if (tag !== "DC" && tag !== "Sup" && tag !== "PMO") continue;
    const existing = byTag.get(tag);
    if (
      !existing ||
      chantierRoleTagRank(tag) <= chantierRoleTagRank(existing.tag)
    ) {
      byTag.set(tag, {
        id: m.ressource.id,
        nom: m.ressource.nom_complet,
        tag,
      });
    }
  }

  const directeur = byTag.get("DC");
  const suppleant = byTag.get("Sup");

  if (!directeur) {
    console.log(
      "Membres chantier:",
      membres.map((m) => ({
        role: m.role,
        is_directeur: m.is_directeur,
        nom: m.ressource?.nom_complet,
      }))
    );
    throw new Error(
      "Aucun Directeur de chantier (DC) trouvé sur CH_023. Impossible d'affecter 8 questions."
    );
  }
  if (!suppleant) {
    throw new Error(
      "Aucun Suppléant (Sup) trouvé sur CH_023. Impossible d'affecter 2 questions."
    );
  }

  console.log(`DC  : ${directeur.nom} (${directeur.id})`);
  console.log(`Sup : ${suppleant.nom} (${suppleant.id})`);

  const affectDc = encodeAffecteeA("person", directeur.id, directeur.nom);
  const affectSup = encodeAffecteeA("person", suppleant.id, suppleant.nom);

  /**
   * 10 questions:
   * - 4 Ouvertes (2 Critique)
   * - 4 En cours
   * - 1 Abandonnée
   * - 1 Résolue
   * Affectation: 8 → DC, 2 → Sup
   */
  const questions: {
    dossier_ref: string;
    question: string;
    categorie: string;
    priorite: string;
    statut: string;
    remontee_par: string;
    affectee_a: string;
    echeance: Date | null;
    resolution: string;
  }[] = [
    // ── 4 Ouvertes (2 critiques) ── 3 DC + 1 Sup
    {
      dossier_ref: "DCE-CH023-Q01",
      question:
        "Quels sont les prérequis d'infrastructure pour le déploiement de la solution sur l'environnement de préproduction CH_023 ?",
      categorie: "Technique",
      priorite: "Critique",
      statut: "Ouverte",
      remontee_par: "DSI Infrastructure",
      affectee_a: affectDc,
      echeance: new Date("2026-04-15"),
      resolution: "",
    },
    {
      dossier_ref: "DCE-CH023-Q02",
      question:
        "Comment garantir la conformité BAM (localisation des données) pour les flux d'intégration prévus sur le chantier CH_023 ?",
      categorie: "Juridique",
      priorite: "Critique",
      statut: "Ouverte",
      remontee_par: "Direction Conformité",
      affectee_a: affectDc,
      echeance: new Date("2026-04-20"),
      resolution: "",
    },
    {
      dossier_ref: "DCE-CH023-Q03",
      question:
        "Le modèle de licensing retenu couvre-t-il les utilisateurs internes et les partenaires externes du périmètre CH_023 ?",
      categorie: "Commerciale",
      priorite: "Haute",
      statut: "Ouverte",
      remontee_par: "Direction Achats",
      affectee_a: affectDc,
      echeance: new Date("2026-05-01"),
      resolution: "",
    },
    {
      dossier_ref: "DCE-CH023-Q04",
      question:
        "Quels indicateurs métier doivent figurer au tableau de bord de pilotage post-mise en production ?",
      categorie: "Fonctionnelle",
      priorite: "Moyenne",
      statut: "Ouverte",
      remontee_par: "Métier sponsor",
      affectee_a: affectSup,
      echeance: new Date("2026-05-10"),
      resolution: "",
    },
    // ── 4 En cours ── 3 DC + 1 Sup
    {
      dossier_ref: "DCE-CH023-Q05",
      question:
        "Quel est le plan de bascule (cut-over) et la fenêtre de gel des évolutions pendant la migration ?",
      categorie: "Technique",
      priorite: "Haute",
      statut: "En cours",
      remontee_par: "MOE",
      affectee_a: affectDc,
      echeance: new Date("2026-04-25"),
      resolution: "",
    },
    {
      dossier_ref: "DCE-CH023-Q06",
      question:
        "Les scénarios de tests UAT couvrent-ils les cas de non-régression sur les parcours prioritaires ?",
      categorie: "Fonctionnelle",
      priorite: "Haute",
      statut: "En cours",
      remontee_par: "AMOA",
      affectee_a: affectDc,
      echeance: new Date("2026-04-28"),
      resolution: "",
    },
    {
      dossier_ref: "DCE-CH023-Q07",
      question:
        "Quel dispositif d'hypercare est prévu sur les 30 premiers jours après le go-live ?",
      categorie: "Générale",
      priorite: "Moyenne",
      statut: "En cours",
      remontee_par: "Bureau Programme",
      affectee_a: affectDc,
      echeance: new Date("2026-05-05"),
      resolution: "",
    },
    {
      dossier_ref: "DCE-CH023-Q08",
      question:
        "Comment sont gérées les habilitations et la séparation des devoirs dans le nouveau module ?",
      categorie: "Technique",
      priorite: "Basse",
      statut: "En cours",
      remontee_par: "RSSI",
      affectee_a: affectSup,
      echeance: new Date("2026-05-12"),
      resolution: "",
    },
    // ── 1 Abandonnée ── DC
    {
      dossier_ref: "DCE-CH023-Q09",
      question:
        "Faut-il conserver l'interface legacy de consultation en parallèle pendant 12 mois (option abandonnée faute de budget) ?",
      categorie: "Fonctionnelle",
      priorite: "Basse",
      statut: "Abandonnée",
      remontee_par: "Direction Financière",
      affectee_a: affectDc,
      echeance: null,
      resolution: "",
    },
    // ── 1 Résolue ── DC
    {
      dossier_ref: "DCE-CH023-Q10",
      question:
        "La solution propose-t-elle un export réglementaire compatible avec les formats BAM en vigueur ?",
      categorie: "Fonctionnelle",
      priorite: "Haute",
      statut: "Résolue",
      remontee_par: "Reporting réglementaire",
      affectee_a: affectDc,
      echeance: new Date("2026-03-30"),
      resolution:
        "Confirmé par l'éditeur : export natif aux formats BAM requis, documentation livrée et validée en comité du 28/03/2026.",
    },
  ];

  // Idempotent: remove previous seed batch for same dossier refs
  const refs = questions.map((q) => q.dossier_ref);
  const deleted = await prisma.consultationQuestion.deleteMany({
    where: {
      chantierId: chantier.id,
      dossier_ref: { in: refs },
    },
  });
  if (deleted.count > 0) {
    console.log(`Nettoyage: ${deleted.count} question(s) existante(s) (mêmes réfs).`);
  }

  let created = 0;
  for (const q of questions) {
    await prisma.consultationQuestion.create({
      data: {
        chantierId: chantier.id,
        dossier_ref: q.dossier_ref,
        question: q.question,
        categorie: q.categorie,
        priorite: q.priorite,
        statut: q.statut,
        remontee_par: q.remontee_par,
        affectee_a: q.affectee_a,
        echeance: q.echeance,
        resolution: q.resolution,
      },
    });
    created++;
  }

  console.log(`\n✓ ${created} questions créées sur ${chantier.code}`);
  console.log("  4 Ouvertes (dont 2 Critiques)");
  console.log("  4 En cours");
  console.log("  1 Abandonnée");
  console.log("  1 Résolue");
  console.log(`  8 affectées au DC (${directeur.nom})`);
  console.log(`  2 affectées au Sup (${suppleant.nom})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
