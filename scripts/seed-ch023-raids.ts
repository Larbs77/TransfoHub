/**
 * Seed 20 RAID entries (Action / Risque / Information / Décision) on CH_023,
 * assigned to chantier team members with varied statuses.
 *
 * Run: npx tsx scripts/seed-ch023-raids.ts
 */
import { addDays, startOfDay } from "date-fns";
import { createPrismaClient } from "../lib/create-prisma";
import { allocateNextRaidCode } from "../lib/raid-code-server";
import { resolveRaidEquipeId } from "../lib/equipe-chantier";

const prisma = createPrismaClient();

type RaidSeed = {
  type: "Action" | "Risque" | "Information" | "Décision";
  intitule: string;
  description: string;
  statut: string;
  categorie: string;
  domaine: string;
  probabilite?: number;
  impact?: number;
  strategie?: string;
  mitigation?: string;
  commentaires?: string;
  /** Offset days from today for identification / revision / échéance */
  daysIdent?: number;
  daysRev?: number;
  daysEcheance?: number;
};

const SEEDS: RaidSeed[] = [
  // ── Actions (6) ─────────────────────────────────────────
  {
    type: "Action",
    intitule: "Valider le plan de bascule Core Banking CH_023",
    description:
      "Organiser le comité de go/no-go pour la bascule et formaliser le plan de rollback.",
    statut: "A planifier",
    categorie: "Projet",
    domaine: "Core Banking",
    daysIdent: -14,
    daysEcheance: 30,
  },
  {
    type: "Action",
    intitule: "Finaliser le mapping des données clients (CIF → CBS)",
    description:
      "Compléter les règles de transformation et valider un échantillon de 500 dossiers.",
    statut: "Planifié",
    categorie: "Data",
    domaine: "Intégration",
    daysIdent: -21,
    daysRev: 7,
    daysEcheance: 21,
  },
  {
    type: "Action",
    intitule: "Lancer les tests d'intégration paiement temps réel",
    description:
      "Scénarios bout-en-bout (virement, prélèvement, rejet) sur l'environnement de préprod.",
    statut: "A lancer",
    categorie: "Qualité",
    domaine: "Paiements",
    daysIdent: -10,
    daysEcheance: 14,
  },
  {
    type: "Action",
    intitule: "Former les utilisateurs clés agence sur le nouveau front",
    description:
      "Sessions régionales : Casablanca, Rabat, Tanger. Supports et attestation de présence.",
    statut: "En cours",
    categorie: "Conduite du changement",
    domaine: "Formation",
    daysIdent: -30,
    daysRev: 3,
    daysEcheance: 45,
  },
  {
    type: "Action",
    intitule: "Geler les évolutions non critiques pendant la freeze",
    description:
      "Communiquer le calendrier de freeze et la procédure d'exception change board.",
    statut: "Stand-By",
    categorie: "Gouvernance",
    domaine: "Change",
    daysIdent: -7,
    daysEcheance: 60,
  },
  {
    type: "Action",
    intitule: "Clôturer le lot de recettes UAT lot 2",
    description:
      "PV de recette signé, anomalies bloquantes traitées, backlog non bloquant priorisé.",
    statut: "Clôturé",
    categorie: "Qualité",
    domaine: "Recette",
    daysIdent: -60,
    daysRev: -5,
    daysEcheance: -3,
  },

  // ── Risques (6) ─────────────────────────────────────────
  {
    type: "Risque",
    intitule: "Retard fournisseur sur les connecteurs SI bancaires",
    description:
      "Délais de livraison des API métier susceptibles de décaler le planning d'intégration.",
    statut: "Ouvert",
    categorie: "Fournisseur",
    domaine: "Intégration",
    probabilite: 4,
    impact: 4,
    strategie: "Mitiger",
    mitigation: "Jalons contractuels + plan B via batchs manuels temporairement.",
    daysIdent: -20,
    daysRev: 10,
  },
  {
    type: "Risque",
    intitule: "Performance insuffisante sur le volume de comptes",
    description:
      "Risque de dépassement des SLA de réponse en pic mensuel de clôture.",
    statut: "En mitigation",
    categorie: "Technique",
    domaine: "Performance",
    probabilite: 3,
    impact: 5,
    strategie: "Mitiger",
    mitigation: "Campagne de load-test + tuning index / cache.",
    daysIdent: -40,
    daysRev: 5,
  },
  {
    type: "Risque",
    intitule: "Non-conformité BAM sur la localisation des données",
    description:
      "Composants cloud hors périmètre réglementaire potentiels dans l'architecture cible.",
    statut: "Surveillé",
    categorie: "Conformité",
    domaine: "Réglementaire",
    probabilite: 2,
    impact: 5,
    strategie: "Éviter",
    mitigation: "Revue architecture + validation sécurité & conformité.",
    daysIdent: -15,
    daysRev: 14,
  },
  {
    type: "Risque",
    intitule: "Indisponibilité des ressources métier pour les ateliers",
    description:
      "Charge concurrente sur les métiers pouvant freiner les validations de spécifications.",
    statut: "Planifié",
    categorie: "Ressources",
    domaine: "Organisation",
    probabilite: 3,
    impact: 3,
    strategie: "Accepter",
    mitigation: "Planning d'ateliers validé en comité programme.",
    daysIdent: -5,
    daysRev: 20,
  },
  {
    type: "Risque",
    intitule: "Fuite d'informations sensibles pendant la migration",
    description:
      "Extraction de données de production pour tests sans masquage adéquat.",
    statut: "Clos",
    categorie: "Sécurité",
    domaine: "Sécurité",
    probabilite: 2,
    impact: 5,
    strategie: "Mitiger",
    mitigation: "Anonymisation systématique + contrôle DSI/sécurité validés.",
    daysIdent: -90,
    daysRev: -10,
  },
  {
    type: "Risque",
    intitule: "Échec de bascule sur le lot agences pilotes",
    description:
      "Incident majeur sur le pilote entraînant un rollback partiel et un report national.",
    statut: "Matérialisé",
    categorie: "Opérationnel",
    domaine: "Bascule",
    probabilite: 3,
    impact: 4,
    strategie: "Mitiger",
    mitigation: "Cellule de crise activée ; plan de remédiation en cours.",
    daysIdent: -12,
    daysRev: 2,
    commentaires: "Incident déclaré en pilote — suivi hebdo.",
  },

  // ── Informations (4) ────────────────────────────────────
  {
    type: "Information",
    intitule: "Publication du calendrier de bascule par vague",
    description:
      "Vagues 1 à 4 communiquées au réseau ; freeze des demandes d'évolution non prioritaires.",
    statut: "Ouvert",
    categorie: "Communication",
    domaine: "Pilotogramme",
    daysIdent: -3,
    daysRev: 7,
  },
  {
    type: "Information",
    intitule: "Mise à disposition de l'environnement de préprod V3",
    description:
      "Accès VPN et comptes de test fournis aux équipes métier et SI.",
    statut: "Ouvert",
    categorie: "Infrastructure",
    domaine: "Environnements",
    daysIdent: -8,
  },
  {
    type: "Information",
    intitule: "Note de cadrage sur le périmètre produits migrés",
    description:
      "Liste des produits inclus / exclus de la première vague validée par le métier.",
    statut: "Clôturé",
    categorie: "Périmètre",
    domaine: "Métier",
    daysIdent: -45,
    daysRev: -20,
  },
  {
    type: "Information",
    intitule: "Point d'avancement mensuel envoyé au comité de direction",
    description:
      "Synthèse KPI, risques majeurs et décisions attendues pour le mois.",
    statut: "Clôturé",
    categorie: "Reporting",
    domaine: "Gouvernance",
    daysIdent: -25,
    daysRev: -22,
  },

  // ── Décisions (4) ───────────────────────────────────────
  {
    type: "Décision",
    intitule: "Arbitrer le scénario de bascule big-bang vs progressive",
    description:
      "Choisir le mode de bascule national au regard des risques opérationnels et du coût.",
    statut: "En attente",
    categorie: "Stratégie",
    domaine: "Bascule",
    daysIdent: -6,
    daysRev: 10,
  },
  {
    type: "Décision",
    intitule: "Valider le budget complémentaire tests de charge",
    description:
      "Allouer le budget outils et jours d'experts performance pour le lot 3.",
    statut: "Validée",
    categorie: "Budget",
    domaine: "Performance",
    daysIdent: -35,
    daysRev: -28,
  },
  {
    type: "Décision",
    intitule: "Reporter le lot cartes prépayées hors vague 1",
    description:
      "Exclusion temporaire du périmètre pour sécuriser la date de bascule prioritaire.",
    statut: "Reportée",
    categorie: "Périmètre",
    domaine: "Produits",
    daysIdent: -18,
    daysRev: 30,
  },
  {
    type: "Décision",
    intitule: "Refuser l'hébergement hors Maroc des données clients",
    description:
      "Décision conformité / juridique suite à la proposition d'architecture cloud régionale.",
    statut: "Refusée",
    categorie: "Conformité",
    domaine: "Réglementaire",
    daysIdent: -50,
    daysRev: -40,
  },
];

function dayOffset(days: number | undefined): Date | null {
  if (days == null) return null;
  return startOfDay(addDays(new Date(), days));
}

async function main() {
  if (SEEDS.length !== 20) {
    throw new Error(`Attendu 20 seeds, trouvé ${SEEDS.length}`);
  }

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

  console.log(`Chantier: ${chantier.code} — ${chantier.nom}`);

  const membres = await prisma.membreEquipe.findMany({
    where: { chantierId: chantier.id },
    select: {
      role: true,
      is_directeur: true,
      ressource: {
        select: { id: true, nom_complet: true, actif: true },
      },
    },
    orderBy: { role: "asc" },
  });

  const acteurs = membres
    .filter((m) => m.ressource?.actif && m.ressource.id)
    .map((m) => ({
      id: m.ressource!.id,
      nom: m.ressource!.nom_complet,
      role: m.role || (m.is_directeur ? "Directeur de chantier" : "Membre"),
    }));

  // Dédupliquer par ressource (un même acteur peut avoir plusieurs rôles)
  const seen = new Set<string>();
  const acteursUniques = acteurs.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  if (acteursUniques.length === 0) {
    throw new Error(
      "Aucun acteur actif sur l'équipe de CH_023. Impossible d'affecter les RAID."
    );
  }

  console.log(
    `Acteurs (${acteursUniques.length}):`,
    acteursUniques.map((a) => `${a.nom} [${a.role}]`).join(" · ")
  );

  let created = 0;
  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i];
    const acteur = acteursUniques[i % acteursUniques.length];
    const code = await allocateNextRaidCode(seed.type, prisma);
    const team = await resolveRaidEquipeId({
      responsableRessourceId: acteur.id,
      chantierId: chantier.id,
      db: prisma as never,
    });

    const row = await prisma.raid.create({
      data: {
        code,
        type: seed.type,
        intitule: seed.intitule,
        description: seed.description,
        categorie: seed.categorie,
        domaine: seed.domaine,
        chantierId: chantier.id,
        probabilite:
          seed.probabilite == null
            ? null
            : seed.probabilite <= 2
              ? 1
              : seed.probabilite === 3
                ? 2
                : 3,
        impact:
          seed.impact == null
            ? null
            : seed.impact <= 2
              ? 1
              : seed.impact === 3
                ? 2
                : 3,
        niveau_maitrise: seed.type === "Risque" ? "Modéré" : "",
        strategie: seed.strategie ?? "",
        mitigation: seed.mitigation ?? "",
        responsable: acteur.nom,
        responsableRessourceId: acteur.id,
        equipeId: team.equipeId,
        statut: seed.statut,
        date_identification: dayOffset(seed.daysIdent),
        date_revision: dayOffset(seed.daysRev),
        date_echeance:
          seed.type === "Action" ? dayOffset(seed.daysEcheance) : null,
        date_echeance_actualisee:
          seed.type === "Action" ? dayOffset(seed.daysEcheance) : null,
        date_fin_reelle:
          seed.statut === "Clôturé" ||
          seed.statut === "Clos" ||
          seed.statut === "Abandonné" ||
          seed.statut === "Validée" ||
          seed.statut === "Refusée" ||
          seed.statut === "Matérialisé"
            ? dayOffset(seed.daysRev ?? -1)
            : null,
        commentaires:
          seed.commentaires ??
          `Seed CH_023 — affecté à ${acteur.nom} (${acteur.role}).`,
        createdByName: "Seed script CH_023",
      },
    });

    created += 1;
    console.log(
      `  [${String(created).padStart(2, "0")}/20] ${row.code} · ${row.type} · ${row.statut} → ${acteur.nom}`
    );
  }

  const byType = await prisma.raid.groupBy({
    by: ["type"],
    where: { chantierId: chantier.id },
    _count: true,
  });

  console.log("\n✓ 20 RAID créés sur CH_023.");
  console.log(
    "Répartition actuelle sur le chantier:",
    byType.map((g) => `${g.type}: ${g._count}`).join(", ")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
