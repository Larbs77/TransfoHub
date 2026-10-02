/**
 * Guide utilisateur TransfoHub — PMO Chantier / Directeur / Suppléant
 * Usage: node scripts/generate-guide-pmo-chantier.js
 */
const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  Header,
  Footer,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageNumber,
  PageBreak,
  TableOfContents,
  ImageRun,
  LevelFormat,
} = require("docx");

const NAVY = "0A3C74";
const TEAL = "00BDBB";
const NAVY_SOFT = "E8EEF5";
const TEAL_SOFT = "E6F7F7";
const GRAY = "F4F5F7";
const LINE = "D0D5DD";

const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1134;
const CONTENT_W = PAGE_W - MARGIN * 2;

const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: thin, bottom: thin, left: thin, right: thin };

function cell(text, width, opts = {}) {
  const {
    fill = "FFFFFF",
    bold = false,
    color = "1F2933",
    fontSize = 18,
    align = AlignmentType.LEFT,
    header = false,
  } = opts;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: header ? NAVY : fill, type: ShadingType.CLEAR },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            font: "Arial",
            size: fontSize,
            bold: header ? true : bold,
            color: header ? "FFFFFF" : color,
          }),
        ],
      }),
    ],
  });
}

function table(colWidths, rows) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: colWidths,
    rows,
  });
}

function headerRow(labels, widths) {
  return new TableRow({
    children: labels.map((l, i) =>
      cell(l, widths[i], { header: true, fontSize: 16 })
    ),
  });
}

function dataRow(values, widths, fill) {
  return new TableRow({
    children: values.map((v, i) =>
      cell(String(v), widths[i], { fill: fill || "FFFFFF", fontSize: 16 })
    ),
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 140, before: opts.before ?? 0 },
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: opts.size ?? 21,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color ?? "1F2933",
      }),
    ],
  });
}

function rich(runs, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 140, before: opts.before ?? 0 },
    children: runs.map((r) =>
      new TextRun({
        text: r.text,
        font: "Arial",
        size: r.size ?? 21,
        bold: r.bold,
        italics: r.italics,
        color: r.color ?? "1F2933",
      })
    ),
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 },
    },
    spacing: { before: 320, after: 160 },
    children: [
      new TextRun({ text, font: "Arial", size: 30, bold: true, color: NAVY }),
    ],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    children: [
      new TextRun({ text, font: "Arial", size: 24, bold: true, color: NAVY }),
    ],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 50 },
    children: [new TextRun({ text, font: "Arial", size: 20 })],
  });
}

function capture(ecran) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.DASHED, size: 12, color: TEAL },
              bottom: { style: BorderStyle.DASHED, size: 12, color: TEAL },
              left: { style: BorderStyle.DASHED, size: 12, color: TEAL },
              right: { style: BorderStyle.DASHED, size: 12, color: TEAL },
            },
            width: { size: CONTENT_W, type: WidthType.DXA },
            shading: { fill: TEAL_SOFT, type: ShadingType.CLEAR },
            margins: { top: 180, bottom: 180, left: 140, right: 140 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "[CAPTURE D’ÉCRAN]",
                    font: "Arial",
                    size: 20,
                    italics: true,
                    color: TEAL,
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60 },
                children: [
                  new TextRun({
                    text: ecran,
                    font: "Arial",
                    size: 18,
                    color: NAVY,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: "Insérez ici la capture correspondante.",
                    font: "Arial",
                    size: 16,
                    italics: true,
                    color: "6B7280",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function pageBlock({ title, acces, quoi, actions, uses, shots }) {
  const out = [h1(title)];
  if (acces) {
    out.push(
      rich(
        [
          { text: "Accès : ", bold: true, color: NAVY },
          { text: acces },
        ],
        { after: 100 }
      )
    );
  }
  out.push(h2("À quoi sert cette page ?"));
  out.push(p(quoi, { size: 21 }));
  if (actions && actions.length) {
    out.push(h2("Ce que vous pouvez faire"));
    for (const a of actions) out.push(bullet(a));
  }
  if (uses && uses.length) {
    out.push(h2("Cas d’usage"));
    for (const u of uses) out.push(bullet(u, "uses"));
  }
  for (const s of shots || []) {
    out.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [] }));
    out.push(capture(s));
  }
  return out;
}

async function main() {
  const logoPath = path.join(__dirname, "..", "public", "boa-logo.png");
  const logoData = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;

  const coverKids = [];
  if (logoData) {
    coverKids.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 200 },
        children: [
          new ImageRun({
            type: "png",
            data: logoData,
            transformation: { width: 220, height: 62 },
            altText: {
              name: "Logo Bank of Africa",
              description: "Logo Bank of Africa",
              title: "Bank of Africa",
            },
          }),
        ],
      })
    );
  }

  const W3 = [3212, 3213, 3213];
  const W4 = [2600, 1800, 2600, 2638];

  const children = [
    ...coverKids,
    p("BANK OF AFRICA", { size: 22, bold: true, color: NAVY, after: 40 }),
    p("Programme de Transformation Bancaire", {
      size: 20,
      color: TEAL,
      after: 280,
    }),
    p("TransfoHub", { size: 52, bold: true, color: NAVY, after: 60 }),
    p("Guide utilisateur", {
      size: 28,
      bold: true,
      color: NAVY,
      after: 40,
    }),
    p("PMO Chantier · Directeur de chantier · Suppléant", {
      size: 22,
      color: TEAL,
      after: 280,
    }),
    table(W3, [
      headerRow(["Public", "Périmètre", "Version"], W3),
      dataRow(
        [
          "PMO Chantier, Directeur, Suppléant",
          "Chantiers assignés",
          "TransfoHub 0.4 — main",
        ],
        W3
      ),
    ]),
    p("", { after: 200 }),
    p(
      "Ce guide décrit les écrans auxquels vous avez accès et les actions du quotidien. Il est volontairement court : chaque page indique à quoi elle sert, ce que vous pouvez faire, et quelques cas d’usage. Les cadres en pointillés marquent l’emplacement des captures d’écran à insérer.",
      { size: 20, after: 80 }
    ),
    p("Septembre 2026", { size: 18, color: "6B7280", after: 0 }),

    new Paragraph({ children: [new PageBreak()] }),
    h1("Sommaire"),
    new TableOfContents("Sommaire", {
      hyperlink: true,
      headingStyleRange: "1-2",
    }),

    new Paragraph({ children: [new PageBreak()] }),
    h1("1. TransfoHub en bref"),
    p(
      "TransfoHub est l’outil de pilotage PMO de la transformation bancaire de Bank of Africa. Il centralise le suivi des chantiers, des risques et actions (RAID), des jalons, des adhérences, des comités et des questions/réponses."
    ),
    p(
      "Pour votre profil (PMO Chantier, Directeur de chantier ou Suppléant), l’application affiche uniquement les chantiers auxquels vous êtes rattaché : membre d’équipe ou accès en consultation. Vous pilotez votre périmètre, pas l’ensemble du programme."
    ),
    capture("Page d’accueil TransfoHub (tableau de bord) — vue PMO Chantier"),

    h1("2. Les vues en un coup d’œil"),
    p(
      "Le menu se trouve dans la barre latérale gauche. Seuls les écrans autorisés pour votre rôle y apparaissent. Cliquez sur votre nom ou votre photo (bas de la barre) pour ouvrir le profil. Le bouton de thème (clair / sombre) est un réglage temporaire ; le thème par défaut se choisit dans le profil."
    ),
    table(W4, [
      headerRow(["Menu", "Écran", "Accès", "Usage principal"], W4),
      dataRow(["Général", "Tableau de bord", "Lecture", "Vue d’ensemble du périmètre"], W4, NAVY_SOFT),
      dataRow(["Général", "Mon tableau de bord", "Lecture", "Mon RAID et mes actions"], W4),
      dataRow(["Suivi opérationnel", "Chantiers", "Écriture", "Fiches et suivi des chantiers"], W4, NAVY_SOFT),
      dataRow(["Suivi opérationnel", "Adhérences", "Écriture", "Dépendances entre chantiers"], W4),
      dataRow(["Suivi opérationnel", "RAID", "Écriture", "Risques, actions, infos, décisions"], W4, NAVY_SOFT),
      dataRow(["Suivi opérationnel", "Jalons", "Écriture", "Jalons et avancement"], W4),
      dataRow(["Suivi opérationnel", "Gantt Portefeuille", "Lecture", "Planning consolidé"], W4, NAVY_SOFT),
      dataRow(["Suivi opérationnel", "Saisie Temps", "Écriture", "Temps passés"], W4),
      dataRow(["Suivi opérationnel", "Backlog Q&A", "Écriture", "Questions / réponses"], W4, NAVY_SOFT),
      dataRow(["Suivi opérationnel", "Favoris", "Lecture", "Chantiers épinglés"], W4),
      dataRow(["Gouvernance", "Comités", "Écriture", "Séances de gouvernance"], W4, NAVY_SOFT),
      dataRow(["Gouvernance", "RMD", "Lecture", "Annuaire des responsables"], W4),
      dataRow(["Gouvernance", "Calendrier", "Lecture", "Échéances et instances"], W4, NAVY_SOFT),
      dataRow(["Workflow", "Centre de validation", "Lecture", "Suivi des demandes"], W4),
      dataRow(["Workflow", "Historique des demandes", "Lecture", "Demandes traitées"], W4, NAVY_SOFT),
      dataRow(["Compte", "Profil", "Self-service", "Photo, téléphone, mot de passe"], W4),
    ]),
    p("", { after: 80 }),
    capture("Barre latérale — menu d’un PMO Chantier"),

    h1("3. Se connecter"),
    h2("Connexion"),
    p(
      "Ouvrez TransfoHub dans le navigateur. Saisissez votre nom d’utilisateur et votre mot de passe, puis validez. En cas d’erreur répétée, le compte peut être temporairement verrouillé : contactez un administrateur."
    ),
    capture("Écran de connexion (logo Bank of Africa + TransfoHub)"),

    h2("Première connexion — changer le mot de passe"),
    p(
      "Lors de la première connexion (ou après réinitialisation par un administrateur), TransfoHub impose un nouveau mot de passe avant d’accéder à l’application."
    ),
    p("Le mot de passe doit contenir :", { after: 80 }),
    bullet("au moins 8 caractères"),
    bullet("une lettre minuscule et une majuscule"),
    bullet("un chiffre"),
    bullet("un caractère spécial (!@#$%…)"),
    p(
      "Saisissez le mot de passe actuel, le nouveau, puis la confirmation. Après enregistrement, vous accédez à l’application."
    ),
    capture("Écran de changement de mot de passe (première connexion)"),

    h2("Se déconnecter"),
    p(
      "Utilisez le bouton de déconnexion dans la barre latérale. Fermez ensuite l’onglet si vous quittez un poste partagé."
    ),

    ...pageBlock({
      title: "4. Mon profil",
      acces: "Toujours disponible — cliquez sur votre avatar ou votre nom dans la barre latérale.",
      quoi: "Le profil regroupe votre identité et les réglages personnels. Le nom, l’e-mail et le rôle sont en lecture seule (gérés par l’administrateur). Vous pouvez mettre à jour le téléphone, le mot de passe, le thème d’affichage et la photo.",
      actions: [
        "Consulter votre identité et votre rôle.",
        "Modifier votre numéro de téléphone.",
        "Changer votre mot de passe (mêmes règles de complexité).",
        "Choisir le mode d’affichage par défaut : clair ou sombre.",
        "Ajouter, recadrer (zoom type LinkedIn) ou supprimer votre photo.",
      ],
      uses: [
        "Je viens d’avoir mon compte : je complète mon téléphone et je mets une photo.",
        "Je change de mot de passe depuis le profil, sans passer par un administrateur.",
        "Je préfère le thème sombre : je l’enregistre pour qu’il s’applique à chaque connexion.",
      ],
      shots: [
        "Page Profil — identité, téléphone, thème, mot de passe",
        "Fenêtre de recadrage de la photo (zoom / cadre)",
      ],
    }),

    ...pageBlock({
      title: "5. Tableau de bord",
      acces: "Lecture — menu Tableau de bord.",
      quoi: "Vue d’ensemble de vos chantiers assignés : indicateurs (chantiers lancés, actions, risques, échéances), graphiques RAID, matrice des risques et timeline des chantiers. Les chiffres reflètent uniquement votre périmètre.",
      actions: [
        "Lire les KPI et cliquer dessus pour ouvrir la liste concernée (ex. risques).",
        "Repérer les risques dans la matrice (cases colorées + effectifs).",
        "Parcourir la timeline des chantiers.",
      ],
      uses: [
        "En début de semaine, je vérifie les actions échues et les risques critiques.",
        "Je clique sur une case de la matrice des risques pour ouvrir la liste filtrée.",
        "Je contrôle d’un coup d’œil l’avancement des chantiers sur la timeline.",
      ],
      shots: ["Tableau de bord PMO — KPI, matrice des risques, timeline"],
    }),

    ...pageBlock({
      title: "6. Mon tableau de bord",
      acces: "Lecture — menu Mon tableau de bord.",
      quoi: "Espace personnel : les RAID qui vous sont assignés (et ceux de vos chantiers / équipes), avec tableau, kanban des actions et calendrier. Utile pour le suivi quotidien de « ce qui est à moi ».",
      actions: [
        "Filtrer Mon RAID / RAID équipes & chantiers.",
        "Trier et rechercher vos actions et risques.",
        "Passer en vue Kanban (actions) ou Calendrier.",
      ],
      uses: [
        "Je liste les actions qui me sont assignées et je priorise celles en retard.",
        "Je bascule en kanban pour déplacer le statut d’une action (avec commentaire si demandé).",
        "Je consulte le calendrier pour voir mes échéances de la semaine.",
      ],
      shots: ["Mon tableau de bord — liste RAID personnelle"],
    }),

    ...pageBlock({
      title: "7. Chantiers",
      acces: "Écriture — menu Chantiers. Périmètre : vos chantiers uniquement.",
      quoi: "Registre des chantiers auxquels vous êtes rattaché. Un clic ouvre la fiche : indicateurs, équipe, RAID, backlog Q&A, adhérences, capacité & coûts, jalons.",
      actions: [
        "Parcourir et rechercher un chantier (code, nom, domaine).",
        "Épingler un chantier en favori.",
        "Ouvrir la fiche et naviguer entre les onglets.",
        "Consulter l’équipe, les RAID du chantier, les jalons et le planning.",
      ],
      uses: [
        "Je cherche CH_023 et j’ouvre sa fiche pour voir l’avancement.",
        "Je vérifie la composition de l’équipe (Directeur, PMO, métiers).",
        "Depuis la fiche, je consulte le RAID du chantier sans passer par le registre global.",
        "J’épingle les chantiers que je suis chaque semaine.",
      ],
      shots: [
        "Liste des chantiers (cartes / recherche)",
        "Fiche chantier — onglets Indicateurs, Équipe, RAID, Jalons…",
      ],
    }),

    ...pageBlock({
      title: "8. Adhérences",
      acces: "Écriture — menu Adhérences.",
      quoi: "Les adhérences décrivent les dépendances entre chantiers (technique, métier, planning). Vous voyez celles qui touchent vos chantiers, en liste et en graphe.",
      actions: [
        "Consulter le registre (criticité, statut, chantiers source / dépendant).",
        "Ouvrir le graphe des dépendances.",
        "Créer ou mettre à jour une adhérence sur votre périmètre.",
      ],
      uses: [
        "Je vérifie si mon chantier est bloqué par une adhérence « bloquante ».",
        "Je crée une adhérence vers un chantier fournisseur d’environnement.",
        "Je mets à jour le statut une fois le contrat d’interface honoré.",
      ],
      shots: ["Registre des adhérences et/ou graphe des dépendances"],
    }),

    ...pageBlock({
      title: "9. RAID",
      acces: "Écriture — menu RAID. Création possible sur vos chantiers.",
      quoi: "Le RAID regroupe Risques, Actions, Informations et Décisions. Liste filtrable, fiche détaillée (commentaires, journal, circulation), kanban pour les actions. La création est limitée aux chantiers de votre périmètre.",
      actions: [
        "Filtrer par type, statut, chantier, responsable, criticité.",
        "Créer un RAID rattaché à l’un de vos chantiers (ou à un comité).",
        "Modifier une fiche (formulaire crayon) si vous y êtes autorisé (assigné, DC / Suppléant / PMO du chantier).",
        "Commenter, changer le statut (commentaire obligatoire) et suivre le journal d’audit.",
        "Exporter la sélection en Excel.",
      ],
      uses: [
        "Je crée une action de mitigation sur mon chantier et je l’assigne à un membre.",
        "Je mets à jour un risque (probabilité, impact) depuis le formulaire.",
        "Je clôture une action au kanban en laissant un commentaire.",
        "Je prépare le comité en filtrant les décisions « En attente ».",
      ],
      shots: ["Registre RAID (liste / filtres)", "Fiche RAID — conversation et journal"],
    }),

    ...pageBlock({
      title: "10. Jalons",
      acces: "Écriture — menu Jalons (également onglet Jalons de la fiche chantier).",
      quoi: "Les jalons structurent l’avancement du chantier (précadrage, cadrage, exécution, clôture). Vous pouvez créer un jalon directement. Une modification ou une suppression passe par une demande de validation (workflow).",
      actions: [
        "Consulter les jalons de vos chantiers (dates, statut, phase).",
        "Créer un jalon (prise en compte immédiate).",
        "Demander une modification ou une suppression (suivi dans le Centre de validation).",
      ],
      uses: [
        "J’ajoute un jalon de recette sur mon chantier.",
        "Je demande le report d’une date cible : la demande part en validation.",
        "Je suis l’avancement du chantier via les jalons atteints.",
      ],
      shots: ["Liste ou arbre des jalons d’un chantier"],
    }),

    ...pageBlock({
      title: "11. Gantt Portefeuille",
      acces: "Lecture — menu Gantt Portefeuille.",
      quoi: "Planning consolidé des chantiers (barres de durée, priorités). Consultation uniquement : vous ne modifiez pas le planning depuis cet écran.",
      actions: [
        "Parcourir le Gantt (zoom, filtres de périmètre selon l’écran).",
        "Repérer les recouvrements et les échéances.",
      ],
      uses: [
        "Je prépare un point programme en montrant le Gantt de mes chantiers.",
        "Je vérifie qu’un jalon clé ne tombe pas en même temps qu’une autre livraison.",
      ],
      shots: ["Gantt portefeuille"],
    }),

    ...pageBlock({
      title: "12. Saisie temps",
      acces: "Écriture — menu Saisie Temps.",
      quoi: "Saisie des jours travaillés par semaine et par activité / chantier, pour le suivi de charge et de consommation.",
      actions: [
        "Saisir ou corriger vos temps (ou ceux de votre périmètre, selon l’écran).",
        "Consulter l’historique des semaines.",
      ],
      uses: [
        "En fin de semaine, je déclare mes jours sur CH_023.",
        "Je corrige une saisie de la semaine précédente.",
      ],
      shots: ["Grille de saisie des temps"],
    }),

    ...pageBlock({
      title: "13. Backlog Q&A",
      acces: "Écriture — menu Backlog Q&A (et onglet Backlog Consultation de la fiche chantier).",
      quoi: "File de questions / réponses liée aux chantiers. Vous pouvez créer et modifier une question. La suppression n’est pas autorisée pour ce profil : une question se clôture par le workflow métier, elle n’est pas effacée.",
      actions: [
        "Créer une question (chantier, destinataire, échéance).",
        "Mettre à jour le contenu ou le statut selon le circuit.",
        "Suivre les questions ouvertes de vos chantiers.",
      ],
      uses: [
        "Je pose une question au métier sur une règle de déduplication.",
        "Je relance une question ouverte proche de l’échéance.",
        "Depuis la fiche chantier, je vois uniquement le backlog de ce chantier.",
      ],
      shots: ["Backlog Q&A — liste des questions"],
    }),

    ...pageBlock({
      title: "14. Favoris",
      acces: "Lecture — menu Favoris.",
      quoi: "Raccourci vers les chantiers que vous avez épinglés depuis la liste des chantiers. Consultation : l’ajout / retrait se fait depuis les chantiers.",
      actions: [
        "Ouvrir rapidement un chantier suivi régulièrement.",
      ],
      uses: [
        "Le lundi, j’ouvre mes 3 chantiers favoris sans chercher dans la liste complète.",
      ],
      shots: ["Page Favoris"],
    }),

    ...pageBlock({
      title: "15. Comités",
      acces: "Écriture — menu Comités. Périmètre : instances liées à vos chantiers (dont comités opérationnels de chantier).",
      quoi: "Préparation et suivi des séances : ordre du jour, RAID rattachés, décisions. Vous gérez les comités de votre maille chantier.",
      actions: [
        "Consulter le calendrier des séances.",
        "Ouvrir une séance et voir les RAID / points rattachés.",
        "Créer ou mettre à jour une séance de chantier.",
        "Rattacher un RAID à un comité depuis le formulaire RAID.",
      ],
      uses: [
        "Je prépare le comité opérationnel de CH_023 et je rattache les décisions à valider.",
        "Après la séance, je mets à jour le statut des points.",
      ],
      shots: ["Liste des comités / fiche d’une séance"],
    }),

    ...pageBlock({
      title: "16. RMD",
      acces: "Lecture — menu RMD.",
      quoi: "Annuaire des Responsables de Mise à Disposition (et responsables associés) rattachés aux chantiers. Consultation pour identifier un interlocuteur.",
      actions: [
        "Rechercher un RMD par chantier ou par nom.",
        "Consulter les coordonnées affichées.",
      ],
      uses: [
        "Je cherche le RMD d’un chantier dont je dépends pour une adhérence.",
      ],
      shots: ["Annuaire RMD"],
    }),

    ...pageBlock({
      title: "17. Calendrier",
      acces: "Lecture — menu Calendrier.",
      quoi: "Vue calendaire des échéances RAID, jalons et séances de comités de votre périmètre.",
      actions: [
        "Naviguer mois / semaine.",
        "Cliquer un événement pour ouvrir l’élément (RAID, comité…).",
      ],
      uses: [
        "Je prépare la semaine suivante en listant les échéances du calendrier.",
      ],
      shots: ["Calendrier TransfoHub"],
    }),

    ...pageBlock({
      title: "18. Centre de validation",
      acces: "Lecture — menu Workflow > Centre de validation. Vous ne validez ni ne refusez les demandes.",
      quoi: "Suivi des demandes de modification ou suppression de jalons (et autres flux de validation). Vous y voyez l’avancement de vos demandes ; l’approbation est du ressort d’un autre profil.",
      actions: [
        "Consulter le statut d’une demande (en cours, acceptée, refusée).",
        "Ouvrir le détail pour relire le motif et l’historique.",
      ],
      uses: [
        "J’ai demandé le report d’un jalon : je vérifie si la demande est encore en attente.",
      ],
      shots: ["Centre de validation — liste des demandes"],
    }),

    ...pageBlock({
      title: "19. Historique des demandes",
      acces: "Lecture — menu Workflow > Historique des demandes.",
      quoi: "Archive des demandes déjà traitées. Utile pour retracer une décision de planning.",
      actions: [
        "Filtrer l’historique (chantier, type, période).",
        "Ouvrir une demande close pour en relire le résultat.",
      ],
      uses: [
        "On me demande pourquoi un jalon a bougé : je retrouve la demande validée dans l’historique.",
      ],
      shots: ["Historique des demandes workflow"],
    }),
  ];

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 21 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 30, bold: true, font: "Arial", color: NAVY },
          paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: NAVY },
          paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 420, hanging: 220 } },
              },
            },
          ],
        },
        {
          reference: "uses",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 420, hanging: 220 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 8,
                    color: TEAL,
                    space: 4,
                  },
                },
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: "Bank of Africa  ·  TransfoHub",
                    font: "Arial",
                    size: 16,
                    color: NAVY,
                    bold: true,
                  }),
                  new TextRun({
                    text: "     Guide utilisateur — PMO Chantier",
                    font: "Arial",
                    size: 16,
                    color: "6B7280",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: LINE,
                    space: 6,
                  },
                },
                spacing: { before: 80 },
                children: [
                  new TextRun({
                    text: "Confidentiel — usage interne  ·  ",
                    font: "Arial",
                    size: 15,
                    color: "6B7280",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Arial",
                    size: 15,
                    color: NAVY,
                  }),
                  new TextRun({
                    text: " / ",
                    font: "Arial",
                    size: 15,
                    color: "6B7280",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: "Arial",
                    size: 15,
                    color: NAVY,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const out = path.join(
    __dirname,
    "..",
    "docs",
    "TransfoHub_Guide_Utilisateur_PMO_Chantier.docx"
  );
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(out, buf);
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
