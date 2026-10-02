/**
 * Addendum fonctionnel TransfoHub V1.2 — même modèle que V1.1.
 * Usage: node scripts/generate-addendum-v1.2.js
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
const AMBER = "FFF8E6";
const GRAY = "F4F5F7";
const LINE = "D0D5DD";

const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1134;
const CONTENT_W = PAGE_W - MARGIN * 2; // 9638

const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorder = {
  style: BorderStyle.NONE,
  size: 0,
  color: "FFFFFF",
};
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

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

function metaRow(label, value) {
  const c1 = 2400;
  const c2 = CONTENT_W - 2400;
  return new TableRow({
    children: [
      cell(label, c1, { fill: NAVY_SOFT, bold: true, fontSize: 18, color: NAVY }),
      cell(value, c2, { fontSize: 18 }),
    ],
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
    spacing: { after: opts.after ?? 160, before: opts.before ?? 0 },
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: opts.size ?? 22,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color ?? "1F2933",
      }),
    ],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 } },
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: NAVY })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: NAVY })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color: "14532D" })],
  });
}

function labelValue(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: label + " : ", font: "Arial", size: 20, bold: true, color: NAVY }),
      new TextRun({ text: value, font: "Arial", size: 20, color: "1F2933" }),
    ],
  });
}

function bullet(text, ref = "bullets") {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 60 },
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
            margins: { top: 200, bottom: 200, left: 160, right: 160 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Emplacement capture d’écran",
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
                spacing: { before: 80 },
                children: [
                  new TextRun({
                    text: ecran,
                    font: "Arial",
                    size: 18,
                    color: NAVY,
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

function featureBlock(id, title, fields) {
  const order = [
    ["Objectif", fields.objectif],
    ["Contexte métier", fields.contexte],
    ["Description détaillée", fields.description],
    ["Processus couvert", fields.processus],
    ["Valeur ajoutée", fields.valeur],
    ["Utilisateurs concernés", fields.users],
    ["Règles métier", fields.regles],
    ["Préconditions", fields.pre],
    ["Postconditions", fields.post],
    ["Exceptions", fields.ex],
    ["Restrictions", fields.rest],
    ["Notifications", fields.notif],
    ["Audit / Traçabilité", fields.audit],
  ];
  const out = [h3(`${id} — ${title}`)];
  for (const [k, v] of order) {
    if (v) out.push(labelValue(k, v));
  }
  return out;
}

function spacer() {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
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
            transformation: { width: 220, height: 48 },
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

  const W5 = [1100, 2100, 1400, 2519, 2519]; // 9638
  const W3 = [1800, 3919, 3919];
  const W4 = [1400, 2800, 2719, 2719];
  const WBR = [900, 2800, 2400, 1769, 1769]; // 9638
  const W2 = [3200, 6438];
  const WScr = [2800, 3419, 3419];

  const children = [
    ...coverKids,
    p("BANK OF AFRICA", { size: 22, bold: true, color: NAVY, after: 40 }),
    p("Programme de Transformation Bancaire", { size: 20, color: TEAL, after: 280 }),
    p("TransfoHub", { size: 56, bold: true, color: NAVY, after: 80 }),
    p("Plateforme de pilotage PMO de la transformation", {
      size: 22,
      italics: true,
      color: "4B5563",
      after: 200,
    }),
    p("Notes de version fonctionnelles & Addendum", {
      size: 28,
      bold: true,
      color: NAVY,
      after: 40,
    }),
    p("Version 1.2", { size: 24, bold: true, color: TEAL, after: 280 }),
    table(
      W2,
      [
        metaRow("Référence", "TH-DOC-ADD-V1.2"),
        metaRow("Type", "Notes de version fonctionnelles & Addendum"),
        metaRow("Version document", "1.2"),
        metaRow(
          "Baseline V1",
          "TH-DOC-FONCT-001 — Documentation fonctionnelle V1 (18/07/2026)"
        ),
        metaRow(
          "Addendum précédent",
          "TH-DOC-ADD-V1.1 — Addendum V1.1 (06/08/2026)"
        ),
        metaRow(
          "Version application cible",
          "Post-0.4.0 / main — septembre 2026 (lots d’optimisation et d’accès)"
        ),
        metaRow("Date", "11 septembre 2026"),
        metaRow("Classification", "Confidentiel — Usage interne BANK OF AFRICA"),
        metaRow(
          "Public",
          "Direction Programme, Program Office, Equipes Chantier, Métiers, IT, QA, Audit"
        ),
        metaRow(
          "Nature",
          "Addendum uniquement — ne remplace pas la documentation V1 ni l’addendum V1.1"
        ),
      ]
    ),
    spacer(),
    p(
      "Document complémentaire à la Documentation fonctionnelle officielle V1 et à l’Addendum V1.1. Il décrit exclusivement les évolutions livrées entre la baseline de l’addendum V1.1 (août 2026) et la version applicative actuelle (septembre 2026).",
      { size: 20, after: 120 }
    ),
    p(
      "Ce document ne recopie pas la V1 ni la V1.1. Le lecteur dispose de la V1 pour le socle produit et de la V1.1 pour le planning / Gantt / dual échéances. Le présent addendum couvre uniquement le delta fonctionnel d’accès, de gouvernance des comités, d’ergonomie opérationnelle et d’espace documentaire.",
      { size: 20, italics: true, after: 200 }
    ),

    new Paragraph({ children: [new PageBreak()] }),
    h1("Table des matières"),
    new TableOfContents("Table des matières", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),

    new Paragraph({ children: [new PageBreak()] }),
    h1("1. Executive Summary"),
    h2("1.1 Objectif de la release"),
    p(
      "La release fonctionnelle post-V1.1 (août → septembre 2026) formalise le droit de consultation dans TransfoHub et affine le pilotage quotidien : lecture / écriture par écran, chantiers extra en consultation, exception RAID affecté, comités de gouvernance versus opérationnels, et lien vers l’espace documentaire SharePoint du chantier. Elle s’accompagne d’un lot d’ergonomie (filtres RAID, export Excel, pagination, fiche chantier, équipe)."
    ),
    h2("1.2 Portée fonctionnelle"),
    p(
      "Le périmètre est le delta par rapport à l’Addendum V1.1 (TH-DOC-ADD-V1.1, 06/08/2026). Les modules déjà décrits en V1 et V1.1 (planning hiérarchisé, Gantt, dual échéances, import planning, workflow jalons / Q&A, RAID collaboratif, SMTP, etc.) ne sont pas redécrits, sauf lorsqu’ils ont été modifiés."
    ),
    bullet("Accès vues : Aucun / Lecture / Écriture par écran métier."),
    bullet("Règle RAID de domaine sur trois surfaces, avec exception du responsable."),
    bullet("Chantiers extra accordés à un utilisateur en consultation uniquement."),
    bullet("Comités : niveau gouvernance vs opérationnel et périmètre tous / assignés."),
    bullet("Lien Espace Documentaire (SharePoint) sur la fiche chantier."),
    bullet("Ergonomie opérationnelle : export RAID, filtres, pagination, KPI, équipe."),
    h2("1.3 Principaux bénéfices"),
    bullet("Un rôle « consultant » peut voir le portefeuille sans modifier les données."),
    bullet("Le responsable d’un RAID reste actionnable même en lecture d’écran."),
    bullet("Un PMO voit ses chantiers en écriture et d’autres chantiers en lecture."),
    bullet("Les comités institutionnels ne se confondent plus avec les comités chantier."),
    bullet("Accès direct à la documentation SharePoint depuis la fiche chantier."),
    h2("1.4 Impacts utilisateurs"),
    p(
      "Les administrateurs paramètrent Lecture / Écriture dans l’onglet Accès vues des rôles, et accordent des chantiers extra sur la fiche utilisateur. Les PMO et contributeurs voient des boutons de création / modification masqués en lecture. Les responsables RAID conservent l’édition de « leur » entrée. Le Centre de Validation n’est pas modifié : approuver / rejeter reste dans Autorisations."
    ),

    h1("2. Scope of Changes — Périmètre des évolutions"),
    p("Le tableau synthétise les écarts fonctionnels retenus pour la V1.2."),
    table(W5, [
      headerRow(["ID", "Module", "Nature", "Impact métier", "Impact utilisateur"], W5),
      dataRow(["F01", "Rôles — Accès vues", "Ajout", "Lecture vs écriture par écran", "Admin Rôles + boutons masqués"], W5, NAVY_SOFT),
      dataRow(["F02", "RAID — 3 surfaces", "Ajout / Modif.", "Droit RAID unique registre / chantier / comité", "Crayon, Kanban, commentaires"], W5),
      dataRow(["F03", "RAID — Exception affecté", "Ajout", "Le responsable agit malgré la lecture d’écran", "Formulaire / Kanban / commentaires"], W5, NAVY_SOFT),
      dataRow(["F04", "Utilisateur — chantiers extra", "Ajout", "Consultation hors équipes fonctionnelles", "Fiche utilisateur + badge Consultation"], W5),
      dataRow(["F05", "Comités — niveaux", "Ajout", "Gouvernance vs opérationnel", "Création séance, RAID rattaché"], W5, NAVY_SOFT),
      dataRow(["F06", "Comités — périmètre", "Ajout", "Tous chantiers vs assignés", "CRUD séances opérationnelles"], W5),
      dataRow(["F07", "Chantier — Espace documentaire", "Ajout", "Lien SharePoint du dossier chantier", "Bouton fiche chantier"], W5, NAVY_SOFT),
      dataRow(["F08", "RAID — Export Excel", "Ajout", "Extraction métier sans UUID", "Bouton export registre"], W5),
      dataRow(["F09", "RAID — Filtres & échéance", "Optim.", "Pilotage liste unifié", "Filtres, bandeau initiale dépassée"], W5, NAVY_SOFT),
      dataRow(["F10", "RAID — Détail comité", "Ajout", "Lecture rapide sans ouvrir le formulaire", "Chevron sous le RAID"], W5),
      dataRow(["F11", "RAID — Suppression", "Modif.", "Motif obligatoire + conservation d’audit", "Dialogue de suppression"], W5, NAVY_SOFT),
      dataRow(["F12", "Fiche chantier — UX", "Optim.", "Lisibilité instance", "Onglets, panneaux, description, KPI"], W5),
      dataRow(["F13", "Équipe chantier", "Modif.", "Multi-directeurs, catalogue ressources", "Organigramme, Ajouter un membre"], W5, NAVY_SOFT),
      dataRow(["F14", "Listes — Pagination", "Optim.", "Listes longues exploitables", "Sélecteur Afficher"], W5),
      dataRow(["F15", "Sécurité — Mot de passe", "Ajout", "Règles de complexité visibles", "Création / changement MDP"], W5, NAVY_SOFT),
      dataRow(["F16", "Centre de Validation", "Sans changement", "Approbation déjà gérée en Autorisations", "Pas de Lecture/Écriture Accès vues"], W5),
    ]),

    h1("3. Nouvelles fonctionnalités"),
    p("Cette section détaille les objets absents de la V1.1 ou dont l’introduction constitue un dispositif métier nouveau."),

    ...featureBlock("F01", "Accès vues — Lecture / Écriture par écran", {
      objectif:
        "Permettre, pour chaque écran métier, trois états : Aucun, Lecture, Écriture, sans dupliquer les autorisations fines déjà existantes.",
      contexte:
        "En V1, l’onglet Accès vues ne disait que « l’écran est dans le menu ou pas ». Un rôle consultant devait soit tout modifier, soit ne pas voir l’écran.",
      description:
        "Pour chaque page du catalogue, l’administrateur choisit Aucun / Lecture / Écriture (l’écriture implique la lecture). Les écrans intrinsèquement consultatifs (tableaux de bord, Gantt, calendrier, capacité, historique workflow, Centre de Validation) n’offrent pas d’écriture dans Accès vues. L’onglet Autorisations conserve le raffinement : périmètre chantier, création RAID, modes jalon / Q&A, approbation workflow.",
      processus:
        "Admin Rôles → Accès vues → cocher l’écran → Lecture ou Écriture → enregistrer → l’utilisateur se reconnecte → boutons de mutation masqués si lecture ; le serveur refuse toute écriture.",
      valeur:
        "Création de profils consultation (métiers, audit, direction) sans multiplier les rôles techniques.",
      users: "Administrateur (paramétrage) ; tous les rôles (effet à l’exécution).",
      regles:
        "Le plus restrictif l’emporte. Lecture d’écran = aucune création / modification / suppression, sous réserve de l’exception RAID affecté (F03). Écriture d’écran = le mécanisme V1/V1.1 s’applique ensuite (périmètre tous / assignés, DIRECT / VALIDATION / INTERDIT).",
      pre: "Rôle actif ; page Administration / Rôles.",
      post: "Menu inchangé si Lecture ou Écriture ; mutations alignées.",
      ex: "Tentative d’écriture en Lecture : message « Action non autorisée : accès en lecture seule ».",
      rest:
        "Admin et Technique (utilisateurs, rôles, messagerie, import / purge, paramètres) restent hors de ce mode : accessibles selon le catalogue de pages, sans Lecture/Écriture dédié. Centre de Validation : F16.",
      notif: "Non applicable.",
      audit: "Le refus serveur constitue le contrôle ; pas de journal d’accès vues séparé.",
    }),
    capture("Administration → Rôles → onglet Accès vues (Lecture / Écriture)"),

    ...featureBlock("F02 / F03", "RAID — droit de domaine et exception du responsable", {
      objectif:
        "Appliquer une seule règle RAID partout où le RAID apparaît, tout en laissant le responsable agir sur « son » RAID.",
      contexte:
        "Le RAID est visible dans le registre, l’onglet RAID de la fiche chantier et la séance de comité. Une lecture du menu /raid sans règle de domaine laissait des actions possibles ailleurs.",
      description:
        "L’Accès vues RAID est un droit de domaine. Aucun : pas de mutation RAID. Lecture : consultation sur les trois surfaces ; pas de création, pas de suppression, pas de réaffectation. Exception : si l’utilisateur est le responsable (ressource liée au compte), il peut modifier, commenter et déplacer au Kanban son RAID — y compris sur un chantier extra en consultation (F04). Écriture : mécanisme actuel inchangé (création tous chantiers / chantiers assignés, collaboration, leadership DC / PMO, règles comité).",
      processus:
        "Paramétrage Accès vues RAID → ouverture registre / fiche / comité → le système masque Ajouter / Supprimer en lecture → le crayon reste si l’utilisateur est responsable.",
      valeur: "Un contributeur voit le RAID du programme sans le modifier, sauf ce qui lui est assigné.",
      users: "Tous acteurs RAID ; PMO ; Program Office ; consultants.",
      regles:
        "Création = Écriture RAID + raid_create_scope. Suppression = Écriture RAID + périmètre « tous les chantiers ». Agir si affecté = Lecture ou Écriture + responsableRessource = ressource du compte.",
      pre: "Page RAID accordée (Lecture ou Écriture) ; ressource liée pour l’exception.",
      post: "Comportement identique sur registre, fiche chantier et comité.",
      ex: "Lecture + RAID d’un tiers : consultation seule. Lecture + RAID affecté : édition autorisée.",
      rest: "Pas de création en Lecture, même pour un responsable.",
      notif: "Notifications RAID collab V1 inchangées.",
      audit: "Journal d’audit RAID (commentaires, changements, motif de suppression) inchangé dans son principe.",
    }),
    capture("Registre RAID + onglet RAID fiche chantier + RAID sous un comité"),

    ...featureBlock("F04", "Chantiers extra en consultation (fiche utilisateur)", {
      objectif:
        "Accorder à un utilisateur un accès lecture seule à des chantiers dont il n’est pas membre d’équipe, sans diluer les droits sur ses chantiers d’affectation.",
      contexte:
        "Le périmètre « chantiers assignés » ne couvrait que les équipes fonctionnelles (membres). Un PMO devait parfois consulter un chantier voisin sans y écrire.",
      description:
        "Sur la fiche Utilisateur, un multi-sélection « Chantiers en consultation » liste les chantiers hors membership. Ces chantiers apparaissent dans les listes (chantiers, RAID, jalons, Q&A, adhérences, comités opérationnels) avec un badge Consultation. Toutes les mutations y sont refusées, sauf l’exception RAID affecté (F03). Si l’utilisateur devient membre plus tard, le membership l’emporte. Si le rôle est « tous les chantiers », la liste extra est sans objet.",
      processus:
        "Admin Utilisateurs → Modifier → Chantiers en consultation → enregistrer → reconnexion de l’utilisateur → badge Consultation → pas de crayon, sauf RAID dont il est responsable.",
      valeur: "Vision transverse ciblée sans ouvrir le périmètre « tous ».",
      users: "Administrateur (paramétrage) ; PMO / métiers en consultation.",
      regles:
        "Intersection : pas d’écran = pas d’objet. Écran en lecture = lecture partout. Écran en écriture + chantier extra = lecture, sauf RAID affecté.",
      pre: "Rôle à périmètre assignés (ou aucun, avec extras seuls) ; compte lié à une ressource.",
      post: "Union membres ∪ extras dans les listes ; extras en lecture seule.",
      ex: "Création de jalon / Q&A / adhérence / séance sur un extra : refus « consultation uniquement ».",
      rest: "RMD, Profils, Ressources, Admin : non scopés chantier — inchangés.",
      notif: "Non applicable.",
      audit: "Liaison User ↔ Chantier de consultation, retirable à tout moment.",
    }),
    capture("Administration → Utilisateurs → Chantiers en consultation + badge sur fiche chantier"),

    ...featureBlock("F05 / F06", "Comités gouvernance et opérationnels", {
      objectif:
        "Distinguer les instances institutionnelles des séances de chantier, et limiter l’écriture opérationnelle au périmètre de l’utilisateur.",
      contexte:
        "Un seul type de comité mélangeait COPIL programme et revues de chantier. Les PMO assignés pouvaient interférer avec la gouvernance.",
      description:
        "Chaque type de comité (paramètres) porte un niveau : Gouvernance (équipe institutionnelle, sans chantier obligatoire) ou Opérationnel (chantier obligatoire, équipe chantier). Les rôles « tous les chantiers » gèrent la gouvernance. Les rôles « chantiers assignés » ne créent / modifient / suppriment que des séances opérationnelles de leurs chantiers ; la gouvernance reste en lecture. L’ajout de RAID sur un comité opérationnel suit le droit RAID (F02) et les règles de séance ; pas d’ajout RAID sur un comité de gouvernance.",
      processus:
        "Paramètres comités (niveau) → Suivi Comités → création séance → RAID rattaché selon le niveau.",
      valeur: "Séparation claire COPIL / revue chantier ; moins d’erreurs de rattachement.",
      users: "Program Office, PMO chantier, Administrateur.",
      regles:
        "Opérationnel : chantier obligatoire et figé. Gouvernance : pas de chantier obligatoire. Écriture Accès vues Comités n’annule pas ces règles de niveau.",
      pre: "Types de comité paramétrés ; page Comités accordée.",
      post: "Listes filtrées ; CRUD aligné niveau + périmètre.",
      ex: "PMO assigné tentant de créer une séance gouvernance : refus.",
      rest: "Lecture Comités : pas de Nouveau / crayon / corbeille sur les séances.",
      notif: "Non applicable (pas de nouveau canal).",
      audit: "Contrôle d’habilitation à l’écriture de séance.",
    }),
    capture("Suivi Comités — niveau Gouvernance / Opérationnel + RAID rattaché"),

    ...featureBlock("F07", "Lien Espace Documentaire", {
      objectif:
        "Raccorder la fiche chantier à son dossier documentaire SharePoint (ou autre URL https).",
      contexte:
        "La documentation vivait hors outil. Les instances demandaient un accès immédiat au dossier du chantier.",
      description:
        "En création / modification de chantier, champ « Lien Espace Documentaire » (URL http/https). Sur la fiche, un bouton « Espace Documentaire » s’affiche si le lien est renseigné et ouvre un nouvel onglet navigateur. Visible aussi en consultation.",
      processus: "Saisie du lien → enregistrement → clic bouton fiche → nouvel onglet SharePoint.",
      valeur: "Un point d’entrée unique PMO + documents.",
      users: "PMO, direction de chantier, consultants en lecture.",
      regles: "URL vide autorisée ; URL non http(s) refusée à l’enregistrement.",
      pre: "Droit d’écriture chantier pour saisir le lien ; droit de voir la fiche pour ouvrir le bouton.",
      post: "Lien persisté sur le chantier.",
      ex: "Lien vide : bouton masqué.",
      rest: "Pas de stockage de fichiers dans TransfoHub — lien externe uniquement.",
      notif: "Non applicable.",
      audit: "Modification du chantier (champ lien) selon droits d’écriture chantier.",
    }),
    capture("Fiche chantier — bouton Espace Documentaire à côté de Synthèse PDF"),

    ...featureBlock("F08", "Export Excel RAID", {
      objectif: "Exporter le RAID métier (tout, sélection, ou comité) sans identifiants techniques.",
      contexte: "Les extractions pour instances se faisaient par copier-coller.",
      description:
        "Bouton d’export Excel sur le registre RAID. L’identifiant métier est le Code RAID (pas l’UUID). Périmètres : liste filtrée / sélection / RAID d’un comité.",
      processus: "Filtrer éventuellement → Exporter → fichier Excel.",
      valeur: "Préparation COPIL et partage hors outil.",
      users: "Profils ayant accès Lecture ou Écriture RAID.",
      regles: "L’export est une consultation (autorisé en Lecture).",
      pre: "Page RAID accordée.",
      post: "Fichier généré côté utilisateur ; données inchangées.",
      ex: "Aucune ligne : export vide ou sans intérêt opérationnel.",
      rest: "Pas d’UUID dans le fichier.",
      notif: "Non applicable.",
      audit: "Non décrit comme journal d’export dédié.",
    }),

    h1("4. Évolutions de l’existant"),
    h2("4.1 RAID — filtres, échéance, détail comité, suppression (F09, F10, F11)"),
    p(
      "Avant : Filtres RAID hétérogènes ; échéance parfois obligatoire trop tôt ; détail RAID en comité nécessitait d’ouvrir le formulaire ; suppression sans motif structuré."
    ),
    p(
      "Après : Filtres unifiés (multi-choix, chantier, comité, bandeau échéance initiale dépassée). Échéance initiale optionnelle tant que le RAID est « À planifier », obligatoire ensuite, figée au premier renseignement ; l’actualisée reste libre. Sous un comité, un chevron déplie description, catégorie, domaine et dates. La suppression exige un motif et conserve l’audit (lien RAID mis à vide si l’entrée est effacée)."
    ),
    p("Pourquoi : Qualité d’instance et traçabilité des suppressions.", { after: 80 }),
    p("Impact : Registre RAID, fiche chantier, Suivi Comités.", { after: 160 }),

    h2("4.2 Fiche chantier — UX de consultation (F12)"),
    p(
      "Avant : Onglets basiques, description toujours déroulée, indicateurs plats, contenus sans panneau unique."
    ),
    p(
      "Après : Menu d’onglets sobre (navy / teal, effet au survol). Description limitée à trois lignes, chevron pour tout afficher. Indicateurs au même rendu 3D que le Tableau de bord, avec fond rouge pour les alertes (dont SPI < 0,80). Tous les onglets (Indicateurs, Équipe, RAID, Q&A, Adhérences, Capacité, Jalons) sont dans le même panneau blanc titré."
    ),
    p("Pourquoi : Lecture directionnelle et cohérence visuelle Bank of Africa.", { after: 80 }),
    p("Impact : Fiche chantier uniquement (pas le registre RAID global).", { after: 160 }),
    capture("Fiche chantier — onglets, description repliée, KPI SPI"),

    h2("4.3 Équipe chantier (F13)"),
    p(
      "Avant : Un directeur ; catalogue d’ajout parfois incomplet ; organigramme à rafraîchir manuellement."
    ),
    p(
      "Après : Plusieurs Directeurs de chantier possibles. « Ajouter un membre » propose toutes les ressources actives, avec select filtrable à la saisie (accents ignorés). L’organigramme se met à jour sans rechargement de page."
    ),
    p("Pourquoi : Refléter la réalité d’animation et accélérer la constitution d’équipe.", { after: 160 }),

    h2("4.4 Listes, mot de passe, signaux visuels (F14, F15)"),
    p(
      "Pagination « Afficher » 5 / 10 / 15 / 20 / 30 / Tout sur les listes longues (utilisateurs, RAID, Q&A, adhérences, tableau de bord). Checklist des règles de mot de passe à la création / au changement. Infobulles Interne / Externe / Consultant. Avertissement si charge > 100 %. Timeline : jalon / barre en rouge si retard."
    ),

    h2("4.5 Centre de Validation (F16) — volontairement inchangé"),
    p(
      "L’Accès vues du Centre de Validation reste « on voit l’écran ou pas ». La consultation versus l’approbation / le rejet demeure dans l’onglet Autorisations (droits workflow). Aucun mode Lecture / Écriture n’a été ajouté sur cet écran, pour éviter une double règle."
    ),

    h1("5. Règles métier mises à jour"),
    p("Les règles V1 et V1.1 non listées restent en vigueur."),
    table(WBR, [
      headerRow(["ID", "Nouvelle règle", "Ancienne (V1 / V1.1)", "Justification", "Impact"], WBR),
      dataRow(["BR-13", "Accès vues = Aucun | Lecture | Écriture", "Page oui / non", "Consultation sans mutation", "Rôles + UI + serveur"], WBR, NAVY_SOFT),
      dataRow(["BR-14", "Écriture d’écran n’annule pas le périmètre tous / assignés", "Périmètre seul", "Ne pas ouvrir tout le portefeuille", "Mutations chantier"], WBR),
      dataRow(["BR-15", "Lecture RAID = 3 surfaces, pas de création", "Page /raid seulement", "Cohérence domaine", "Registre, fiche, comité"], WBR, NAVY_SOFT),
      dataRow(["BR-16", "Responsable RAID peut agir en Lecture, y compris chantier extra", "Édition si collab / leadership", "Tenir ses actions", "Formulaire, Kanban, commentaires"], WBR),
      dataRow(["BR-17", "Chantier extra = lecture, membership l’emporte", "Assignés = membres seulement", "Consultation ciblée", "Listes + badge"], WBR, NAVY_SOFT),
      dataRow(["BR-18", "Comité opérationnel : chantier obligatoire ; gouvernance : lecture pour assignés", "Un seul type de séance", "Séparer COPIL et revue", "Suivi Comités"], WBR),
      dataRow(["BR-19", "Pas d’ajout RAID sur comité de gouvernance", "Rattachement libre", "Gouvernance ≠ backlog opérationnel", "Bouton Ajouter RAID"], WBR, NAVY_SOFT),
      dataRow(["BR-20", "Échéance RAID initiale optionnelle si À planifier, puis figée", "Initiale à la création (V1.1)", "Autoriser le backlog non daté", "Formulaire RAID"], WBR),
      dataRow(["BR-21", "Suppression RAID : motif obligatoire, audit conservé", "Suppression simple", "Traçabilité", "Dialogue + journal"], WBR, NAVY_SOFT),
      dataRow(["BR-22", "Centre de Validation : pas de mode écriture Accès vues", "N/A", "Éviter la double règle", "Admin Rôles"], WBR),
      dataRow(["BR-23", "Lien documentaire = URL http(s) ou vide", "N/A", "Sécurité des liens", "Formulaire chantier"], WBR, NAVY_SOFT),
      dataRow(["BR-24", "SPI < 0,80 = indicateur rouge", "Couleur générique", "Alerte planning", "Onglet Indicateurs"], WBR),
    ]),

    h1("6. Permissions mises à jour"),
    p(
      "Le catalogue de pages (Accès vues) distingue désormais les écrans écrivables. Les écrans Admin / Technique n’ont pas de bascule Lecture / Écriture."
    ),
    table(W4, [
      headerRow(["Écran", "Accès vues V1.2", "Raffinement Autorisations", "Notes"], W4),
      dataRow(["RAID", "Aucun / Lecture / Écriture", "Création tous / assignés ; collab V1", "3 surfaces + BR-16"], W4, NAVY_SOFT),
      dataRow(["Chantiers", "Aucun / Lecture / Écriture", "Périmètre tous / assignés", "Onglets métier suivent leur écran"], W4),
      dataRow(["Comités", "Aucun / Lecture / Écriture", "Niveau + périmètre", "BR-18 / BR-19"], W4, NAVY_SOFT),
      dataRow(["Jalons, Q&A, Adhérences, Saisie temps", "Aucun / Lecture / Écriture", "Modes DIRECT / VALIDATION / INTERDIT (jalons, Q&A)", "Périmètre chantier conservé"], W4),
      dataRow(["Profils, Ressources, RMD", "Aucun / Lecture / Écriture", "—", "Non scopés chantier"], W4, NAVY_SOFT),
      dataRow(["Centre de Validation", "Oui / non (lecture d’écran)", "Approuver / Rejeter / Voir", "F16"], W4),
      dataRow(["Tableaux de bord, Gantt, Calendrier, Capacité, Favoris, Historique", "Oui / non", "—", "Pas d’écriture Accès vues"], W4, NAVY_SOFT),
      dataRow(["Admin / Technique", "Oui / non", "—", "Réservé aux administrateurs"], W4),
    ]),
    p(
      "Couches combinées (du plus large au plus fin) : (1) écran Accès vues, (2) membership / périmètre, (3) chantiers extra en consultation, (4) exception RAID affecté.",
      { italics: true }
    ),

    h1("7. Nouveaux workflows / extensions"),
    h2("7.1 Décision d’écriture à l’exécution"),
    p("Étapes (vue simplifiée)"),
    bullet("L’utilisateur ouvre un écran accordé (Lecture ou Écriture)."),
    bullet("S’il tente une mutation : le système vérifie l’écriture d’écran."),
    bullet("Puis le périmètre chantier (tous / membre / extra consultation)."),
    bullet("Si extra consultation : refus, sauf RAID dont il est responsable."),
    bullet("Puis les règles métier déjà en V1/V1.1 (création RAID, DIRECT/VALIDATION, comité niveau)."),
    p("Diagramme simplifié : Accès vues → Périmètre chantier → Exception RAID affecté → Autorisations fines.", {
      italics: true,
    }),

    h2("7.2 Cycle de vie d’un chantier extra"),
    bullet("L’administrateur rattache le chantier en consultation sur la fiche utilisateur."),
    bullet("L’utilisateur se reconnecte ; le chantier apparaît avec le badge Consultation."),
    bullet("Il consulte ; il n’écrit pas, sauf RAID affecté."),
    bullet("S’il est ensuite ajouté à l’équipe : le membership remplace la consultation."),

    h1("8. Écrans impactés"),
    h2("Administration — Rôles (Accès vues)"),
    p("Bascules Lecture / Écriture sur les écrans métier listés au §6. Aide contextuelle en tête d’onglet."),
    capture("Admin Rôles — Accès vues"),

    h2("Administration — Utilisateurs"),
    p("Nouveau bloc « Chantiers en consultation » (masqué si le rôle est « tous les chantiers »). Les chantiers déjà membres sont exclus de la liste."),
    capture("Admin Utilisateurs — modification, chantiers extra"),

    h2("Fiche chantier"),
    p("Onglets restylés, description repliable, panneaux Card, KPI 3D / SPI rouge, bouton Espace Documentaire, badge Consultation, équipe multi-directeurs, RAID selon F02/F03."),
    capture("Fiche chantier — en-tête + bouton Espace Documentaire"),

    h2("Registre RAID et sous-pages"),
    p("Filtres unifiés, export Excel, pagination, échéance À planifier, suppression avec motif. Lecture : pas d’Ajouter ; crayon si affecté."),
    capture("Registre RAID — filtres et export"),

    h2("Suivi Comités"),
    p("Niveaux, droits, RAID dépliable (description / dates), export RAID de séance, Ajouter RAID selon F02 et F05."),
    capture("Suivi Comités — séance opérationnelle et RAID déplié"),

    h2("Listes Profils, Ressources, Saisie temps, Adhérences, Jalons, Q&A, RMD"),
    p("Boutons de mutation masqués en Lecture ; périmètre chantier conservé en Écriture."),

    h1("9. KPI Changes — Évolutions d’indicateurs"),
    h2("9.1 SPI (Schedule Performance Index) — affichage d’alerte"),
    p(
      "Formule inchangée (avancement / temps écoulé). Seuil visuel : ≥ 1 vert (dans les temps) ; 0,80–0,99 ambre (léger retard) ; < 0,80 rouge (en retard). L’onglet Indicateurs de la fiche chantier applique le rendu d’alerte rouge au repos, pas seulement au survol."
    ),
    h2("9.2 Indicateurs d’alerte fiche chantier"),
    p(
      "Les tuiles déjà calculées en V1 (actions en retard, risques critiques, Q&A critiques, adhérences bloquantes, etc.) reprennent le même langage visuel rouge lorsqu’elles sont en statut d’alerte. Aucune nouvelle formule KPI n’est introduite hors ce rendu."
    ),
    h2("9.3 Pas de modification des formules catalogue KPIS.txt"),
    p("Les formules du catalogue programme restent celles de la V1 / V1.1. La V1.2 porte sur les droits, la gouvernance des comités et l’ergonomie, pas sur un nouveau calcul d’avancement."),

    h1("10. Impact sur le modèle métier"),
    h2("10.1 Nouveaux objets métier"),
    bullet("Liaison Utilisateur ↔ Chantier de consultation (hors membership d’équipe)."),
    bullet("Niveau de type de comité : Gouvernance | Opérationnel, avec chantier obligatoire dans le second cas."),
    h2("10.2 Entités / attributs modifiés"),
    bullet("Rôle : Accès vues enrichi (mode lecture / écriture par écran, rétrocompatible avec l’ancienne liste de pages)."),
    bullet("Chantier : attribut Lien Espace Documentaire (URL)."),
    bullet("RAID : motif de suppression ; conservation de l’audit après suppression ; échéance initiale conditionnelle (À planifier)."),
    bullet("Équipe chantier : plusieurs directeurs."),
    h2("10.3 Nouveaux référentiels / catalogues"),
    bullet("Catalogue d’écrans écrivables vs consultatifs (Accès vues)."),
    bullet("Niveaux de comité dans Paramètres comités."),

    h1("11. Annexes"),
    h2("11.1 Liste des écrans du delta"),
    table(WScr, [
      headerRow(["Écran", "Section menu", "Delta V1.2"], WScr),
      dataRow(["Rôles", "Administration", "Accès vues Lecture / Écriture"], WScr, NAVY_SOFT),
      dataRow(["Utilisateurs", "Administration", "Chantiers en consultation"], WScr),
      dataRow(["Chantiers / fiche", "Suivi opérationnel", "UX, KPI, Espace documentaire, badge"], WScr, NAVY_SOFT),
      dataRow(["RAID (registre + sous-pages)", "Suivi opérationnel", "Filtres, export, droits domaine"], WScr),
      dataRow(["Comités", "Gouvernance", "Niveaux, RAID déplié, droits"], WScr, NAVY_SOFT),
      dataRow(["Jalons, Q&A, Adhérences, Saisie temps, Profils, Ressources, RMD", "Divers", "Lecture / Écriture"], WScr),
    ]),

    h2("11.2 Glossaire — termes nouveaux ou précisés"),
    table(W2, [
      headerRow(["Terme", "Définition V1.2"], W2),
      dataRow(["Lecture (Accès vues)", "Voir l’écran et les données du périmètre, sans créer ni modifier, sauf RAID affecté."], W2, NAVY_SOFT),
      dataRow(["Écriture (Accès vues)", "Mutations autorisées, puis filtrées par le périmètre et les autorisations fines V1/V1.1."], W2),
      dataRow(["Chantier extra / consultation", "Chantier accordé à l’utilisateur hors membership d’équipe, toujours en lecture."], W2, NAVY_SOFT),
      dataRow(["RAID affecté", "Entrée RAID dont le responsable est la ressource liée au compte."], W2),
      dataRow(["Comité de gouvernance", "Instance institutionnelle, sans chantier obligatoire, gérée par les profils « tous les chantiers »."], W2, NAVY_SOFT),
      dataRow(["Comité opérationnel", "Séance de chantier, chantier obligatoire, CRUD limité au périmètre assigné."], W2),
      dataRow(["Espace Documentaire", "URL SharePoint (ou https) du dossier documentaire du chantier."], W2, NAVY_SOFT),
    ]),

    h2("11.3 Références documentaires"),
    bullet("TH-DOC-FONCT-001 — Documentation fonctionnelle V1 (18/07/2026)."),
    bullet("TH-DOC-ADD-V1.1 — Addendum V1.1 (06/08/2026)."),
    bullet("TH-DOC-ADD-V1.2 — présent addendum (11/09/2026)."),
    bullet("Catalogue KPI programme (KPIS.txt) — formules inchangées en V1.2."),

    h2("11.4 Hors périmètre de cet addendum"),
    bullet("Outillage interne (scripts de seed, packs de déploiement, maintenance système)."),
    bullet("Réécriture de la documentation V1 ou V1.1."),
    bullet("Nouveaux calculs d’avancement chantier ou de score de risque."),

    spacer(),
    p("— Fin de l’addendum V1.2 —", {
      align: AlignmentType.CENTER,
      italics: true,
      color: "6B7280",
      size: 18,
    }),
    p("À rafraîchir : table des matières dans Word (Références → Mettre à jour la table). Coller les captures dans les encadrés teal avant diffusion COPIL.", {
      align: AlignmentType.CENTER,
      italics: true,
      color: "6B7280",
      size: 16,
    }),
  ];

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", color: NAVY },
          paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: NAVY },
          paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 22, bold: true, font: "Arial", color: "0A3C74" },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
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
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
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
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 8, color: TEAL, space: 4 },
                },
                children: [
                  new TextRun({
                    text: "BANK OF AFRICA  ·  TransfoHub  ·  TH-DOC-ADD-V1.2",
                    font: "Arial",
                    size: 16,
                    color: NAVY,
                    bold: true,
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
                  top: { style: BorderStyle.SINGLE, size: 6, color: NAVY, space: 6 },
                },
                tabStops: [
                  { type: "right", position: CONTENT_W },
                ],
                children: [
                  new TextRun({
                    text: "Confidentiel — Usage interne  ·  Addendum fonctionnel V1.2",
                    font: "Arial",
                    size: 14,
                    color: "6B7280",
                  }),
                  new TextRun({ text: "\t", font: "Arial", size: 14 }),
                  new TextRun({
                    children: ["Page ", PageNumber.CURRENT],
                    font: "Arial",
                    size: 14,
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

  const buf = await Packer.toBuffer(doc);
  const destDir = "C:\\Users\\mzaho\\OneDrive\\Bureau\\doc-trhub";
  const dest1 = path.join(destDir, "TransfoHub_Functional_Addendum_V1.2.docx");
  const dest2 = path.join(__dirname, "..", "docs", "TransfoHub_Functional_Addendum_V1.2.docx");
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(dest1, buf);
  try {
    fs.mkdirSync(path.dirname(dest2), { recursive: true });
    fs.writeFileSync(dest2, buf);
  } catch (e) {
    console.warn("Copie repo ignorée:", e.message);
  }
  console.log("OK", dest1);
  console.log("bytes", buf.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
