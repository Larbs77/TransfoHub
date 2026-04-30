import PptxGenJS from "pptxgenjs";

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5

// ── Theme colors ──
const PRIMARY = "1a56db";
const PRIMARY_DARK = "0f3a8a";
const ACCENT = "10b981";
const DARK = "1e293b";
const GRAY = "64748b";
const LIGHT_BG = "f8fafc";
const WHITE = "ffffff";

// ── Helper: add a section title slide ──
function addSectionSlide(title, subtitle) {
  const slide = pptx.addSlide();
  slide.background = { fill: PRIMARY };
  slide.addText(title, {
    x: 0.8, y: 2.2, w: 11.7, h: 1.2,
    fontSize: 36, fontFace: "Segoe UI", bold: true,
    color: WHITE, align: "left",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8, y: 3.4, w: 11.7, h: 0.8,
      fontSize: 18, fontFace: "Segoe UI",
      color: "bfdbfe", align: "left",
    });
  }
  addFooter(slide);
  return slide;
}

// ── Helper: add footer ──
function addFooter(slide) {
  slide.addText("PMO Transformation Bancaire | Confidentiel", {
    x: 0.5, y: 7.0, w: 5, h: 0.3,
    fontSize: 8, fontFace: "Segoe UI", color: "94a3b8",
  });
}

// ── Helper: add content slide ──
function addContentSlide(title) {
  const slide = pptx.addSlide();
  slide.background = { fill: WHITE };
  // Title bar
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.33, h: 0.9,
    fill: { color: PRIMARY_DARK },
  });
  slide.addText(title, {
    x: 0.6, y: 0.1, w: 12, h: 0.7,
    fontSize: 22, fontFace: "Segoe UI", bold: true,
    color: WHITE,
  });
  addFooter(slide);
  return slide;
}

// ── Helper: add a card/box ──
function addCard(slide, x, y, w, h, { title, body, color = PRIMARY, bgColor = "eff6ff" }) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: bgColor },
    rectRadius: 0.1,
    line: { color: color, width: 1.5 },
  });
  if (title) {
    slide.addText(title, {
      x: x + 0.15, y: y + 0.08, w: w - 0.3, h: 0.35,
      fontSize: 11, fontFace: "Segoe UI", bold: true,
      color: color,
    });
  }
  if (body) {
    slide.addText(body, {
      x: x + 0.15, y: y + (title ? 0.4 : 0.1), w: w - 0.3, h: h - (title ? 0.5 : 0.2),
      fontSize: 10, fontFace: "Segoe UI", color: DARK,
      valign: "top",
    });
  }
}

// ═══════════════════════════════════════════════════════
// SLIDE 1: Title
// ═══════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { fill: PRIMARY_DARK };
  // Accent line
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 2.8, w: 3, h: 0.06, fill: { color: ACCENT },
  });
  slide.addText("PMO Transformation\nBancaire", {
    x: 0.8, y: 1.0, w: 11.7, h: 1.8,
    fontSize: 42, fontFace: "Segoe UI", bold: true,
    color: WHITE, align: "left", lineSpacingMultiple: 1.1,
  });
  slide.addText("Plateforme de pilotage du programme de transformation", {
    x: 0.8, y: 3.1, w: 9, h: 0.6,
    fontSize: 18, fontFace: "Segoe UI", color: "93c5fd",
  });
  slide.addText("Présentation au Comité de Pilotage", {
    x: 0.8, y: 4.2, w: 6, h: 0.5,
    fontSize: 14, fontFace: "Segoe UI", color: "bfdbfe",
  });
  slide.addText("Mars 2026", {
    x: 0.8, y: 4.7, w: 3, h: 0.4,
    fontSize: 12, fontFace: "Segoe UI", color: "93c5fd",
  });
  addFooter(slide);
}

// ═══════════════════════════════════════════════════════
// SLIDE 2: Contexte & Enjeux
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Contexte & Enjeux");
  // Problem statement
  slide.addText("Le programme de transformation bancaire implique la coordination de multiples chantiers, équipes et parties prenantes. Le suivi manuel par fichiers Excel et e-mails génère :", {
    x: 0.6, y: 1.2, w: 12, h: 0.7,
    fontSize: 13, fontFace: "Segoe UI", color: DARK,
  });

  const problems = [
    "Manque de visibilité en temps réel sur l'avancement des chantiers",
    "Difficulté à identifier les risques et blocages rapidement",
    "Reporting manuel chronophage pour les comités (CTP, CTR)",
    "Absence de suivi centralisé des adhérences inter-chantiers",
    "Pas de traçabilité des décisions et actions RAID",
  ];
  slide.addText(problems.map(p => ({ text: `●  ${p}\n`, options: { fontSize: 12, color: DARK, bullet: false } })), {
    x: 1.0, y: 2.0, w: 11, h: 2.5,
    fontFace: "Segoe UI", lineSpacingMultiple: 1.6,
  });

  addCard(slide, 0.6, 5.0, 12, 1.2, {
    title: "Notre solution",
    body: "Une plateforme web centralisée de pilotage PMO, construite sur mesure pour répondre aux besoins spécifiques du programme de transformation bancaire.",
    color: ACCENT,
    bgColor: "ecfdf5",
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 3: Vue d'ensemble de l'application
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Vue d'ensemble de la plateforme");

  const modules = [
    { title: "Tableau de bord", desc: "KPIs programme, graphiques interactifs, vue consolidée", icon: "📊", color: PRIMARY },
    { title: "Gestion des Chantiers", desc: "46 chantiers, fiches détaillées, avancement automatique", icon: "📁", color: "7c3aed" },
    { title: "RAID", desc: "Risques, Actions, Informations, Décisions + Kanban", icon: "📋", color: "dc2626" },
    { title: "Jalons & Planning", desc: "Timeline par phase, modèles configurables", icon: "🎯", color: "ea580c" },
    { title: "Gouvernance", desc: "Comités, Dashboards CTP/CTR, Calendrier, RMD", icon: "🏛️", color: ACCENT },
    { title: "Ressources", desc: "Équipes, profils, capacité, saisie temps", icon: "👥", color: "0891b2" },
    { title: "Adhérences", desc: "Dépendances inter-chantiers, criticité, suivi", icon: "🔗", color: "6366f1" },
    { title: "Q&A / Backlog", desc: "Questions/consultations par chantier", icon: "❓", color: "d946ef" },
  ];

  const cols = 4;
  const cardW = 2.85;
  const cardH = 1.5;
  const gapX = 0.15;
  const gapY = 0.2;
  const startX = 0.5;
  const startY = 1.3;

  modules.forEach((mod, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    slide.addShape(pptx.ShapeType.roundRect, {
      x, y, w: cardW, h: cardH,
      fill: { color: "f1f5f9" },
      rectRadius: 0.08,
      line: { color: mod.color, width: 1.2 },
    });
    slide.addText(mod.icon, {
      x: x + 0.1, y: y + 0.1, w: 0.5, h: 0.4,
      fontSize: 18,
    });
    slide.addText(mod.title, {
      x: x + 0.55, y: y + 0.1, w: cardW - 0.7, h: 0.35,
      fontSize: 11, fontFace: "Segoe UI", bold: true, color: mod.color,
    });
    slide.addText(mod.desc, {
      x: x + 0.15, y: y + 0.55, w: cardW - 0.3, h: 0.85,
      fontSize: 9, fontFace: "Segoe UI", color: GRAY, valign: "top",
    });
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 4: Tableau de bord
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Tableau de bord — Vue consolidée");

  const kpis = [
    { label: "Chantiers actifs", value: "46", color: PRIMARY },
    { label: "Actions ouvertes", value: "—", color: "dc2626" },
    { label: "Risques actifs", value: "—", color: "ea580c" },
    { label: "Budget total", value: "— MAD", color: ACCENT },
    { label: "Décisions en attente", value: "—", color: "7c3aed" },
    { label: "Taux clôture actions", value: "— %", color: "0891b2" },
  ];

  kpis.forEach((kpi, i) => {
    const x = 0.5 + i * 2.05;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 1.3, w: 1.9, h: 1.0,
      fill: { color: "f0f9ff" },
      rectRadius: 0.08,
      line: { color: kpi.color, width: 1 },
    });
    slide.addText(kpi.value, {
      x, y: 1.35, w: 1.9, h: 0.5,
      fontSize: 18, fontFace: "Segoe UI", bold: true, color: kpi.color, align: "center",
    });
    slide.addText(kpi.label, {
      x, y: 1.85, w: 1.9, h: 0.35,
      fontSize: 8, fontFace: "Segoe UI", color: GRAY, align: "center",
    });
  });

  slide.addText("Le tableau de bord offre une vue temps réel de l'état du programme :", {
    x: 0.6, y: 2.6, w: 12, h: 0.4,
    fontSize: 12, fontFace: "Segoe UI", color: DARK,
  });

  const features = [
    "14 graphiques interactifs : statuts, risques, budget par domaine, matrice des risques, burndown, capacité",
    "KPIs consolidés recalculés automatiquement à chaque modification",
    "Vue par domaine, par priorité, par statut avec filtres dynamiques",
    "Alertes visuelles sur les actions échues et risques critiques",
  ];
  slide.addText(features.map(f => ({ text: `●  ${f}\n`, options: { fontSize: 11, color: DARK } })), {
    x: 1.0, y: 3.1, w: 11, h: 2.5,
    fontFace: "Segoe UI", lineSpacingMultiple: 1.6,
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 5: Gestion des Chantiers
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Gestion des Chantiers");

  slide.addText("Chaque chantier dispose d'une fiche complète avec 6 onglets dédiés :", {
    x: 0.6, y: 1.2, w: 12, h: 0.4,
    fontSize: 13, fontFace: "Segoe UI", color: DARK,
  });

  const tabs = [
    { title: "Indicateurs (KPI)", desc: "Avancement, planification, risques, capacités & coûts, Q&A, adhérences — tout en un coup d'œil" },
    { title: "Jalons & Timeline", desc: "Timeline visuelle par phase avec jalons positionnés, dates prévues, indicateur aujourd'hui" },
    { title: "RAID", desc: "Actions, risques, décisions et informations spécifiques au chantier" },
    { title: "Équipe & Organigramme", desc: "Directeur, suppléant, équipes (PMO, AMOA, MOE, Métiers, Sécurité, EI), RMD associés" },
    { title: "Budget", desc: "Ventilation détaillée : projet, conseil éditeurs, licences, infras + consommation JH" },
    { title: "Q&A", desc: "Questions/consultations liées au chantier avec statuts et priorités" },
  ];

  tabs.forEach((tab, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 6.3;
    const y = 1.8 + row * 1.55;
    addCard(slide, x, y, 6.0, 1.35, {
      title: tab.title,
      body: tab.desc,
      color: PRIMARY,
      bgColor: col === 0 ? "eff6ff" : "f0fdf4",
    });
  });

  slide.addText("Avancement et statut calculés automatiquement depuis les jalons (pondération par phase configurable)", {
    x: 0.6, y: 6.5, w: 12, h: 0.4,
    fontSize: 11, fontFace: "Segoe UI", italic: true, color: ACCENT,
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 6: RAID & Kanban
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("RAID — Risques, Actions, Informations, Décisions");

  const sections = [
    {
      title: "Registre RAID complet",
      items: [
        "4 types : Risques, Actions, Informations, Décisions",
        "Filtres avancés : statut, domaine, catégorie, responsable, criticité",
        "Matrice des risques (Impact × Probabilité) avec score automatique",
        "Tri multi-colonnes et pagination",
      ],
    },
    {
      title: "Kanban interactif (Actions)",
      items: [
        "Colonnes par statut — workflow configurable depuis les Paramètres",
        "Drag & drop pour changer le statut d'une action",
        "Vue visuelle claire de la progression du traitement",
      ],
    },
    {
      title: "Calendrier",
      items: [
        "Vue calendrier des échéances RAID",
        "Navigation mois par mois avec détails au clic",
      ],
    },
  ];

  let yPos = 1.3;
  sections.forEach((sec) => {
    slide.addText(sec.title, {
      x: 0.6, y: yPos, w: 12, h: 0.35,
      fontSize: 13, fontFace: "Segoe UI", bold: true, color: PRIMARY,
    });
    yPos += 0.4;
    slide.addText(sec.items.map(item => ({ text: `●  ${item}\n`, options: { fontSize: 11, color: DARK } })), {
      x: 1.0, y: yPos, w: 11, h: sec.items.length * 0.38,
      fontFace: "Segoe UI", lineSpacingMultiple: 1.4,
    });
    yPos += sec.items.length * 0.38 + 0.2;
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 7: Jalons & Planning
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Jalons & Planification");

  const phases = [
    { name: "Précadrage", pct: "10%", color: "3b82f6" },
    { name: "Cadrage", pct: "20%", color: "8b5cf6" },
    { name: "Exécution", pct: "50%", color: "10b981" },
    { name: "Clôture", pct: "20%", color: "f59e0b" },
  ];

  // Phase boxes
  phases.forEach((p, i) => {
    const x = 0.5 + i * 3.1;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 1.3, w: 2.9, h: 0.8,
      fill: { color: p.color },
      rectRadius: 0.06,
    });
    slide.addText(`${p.name}\n${p.pct}`, {
      x, y: 1.3, w: 2.9, h: 0.8,
      fontSize: 13, fontFace: "Segoe UI", bold: true,
      color: WHITE, align: "center", valign: "middle",
    });
  });

  // Arrow between phases
  for (let i = 0; i < 3; i++) {
    slide.addText("→", {
      x: 3.3 + i * 3.1, y: 1.45, w: 0.3, h: 0.5,
      fontSize: 18, color: GRAY, align: "center",
    });
  }

  const features = [
    "Timeline visuelle avec positionnement automatique des jalons",
    "Dates prévues du chantier affichées en lignes pointillées bleues",
    "Indicateur \"Aujourd'hui\" avec marqueur visuel",
    "Modèle de jalons configurable depuis les Paramètres",
    "Application en un clic du modèle par défaut sur les nouveaux chantiers",
    "Avancement automatique pondéré par phase (poids configurables)",
    "Statut du chantier dérivé automatiquement de la phase en cours",
  ];

  slide.addText(features.map(f => ({ text: `●  ${f}\n`, options: { fontSize: 11, color: DARK } })), {
    x: 0.8, y: 2.5, w: 11.5, h: 3.5,
    fontFace: "Segoe UI", lineSpacingMultiple: 1.5,
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 8: Gouvernance — Dashboards CTP/CTR
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Gouvernance — Dashboards CTP & CTR");

  // CTP box
  addCard(slide, 0.5, 1.3, 6.0, 4.5, {
    title: "Dashboard CTP (Comité de Transformation Programme)",
    body: [
      "● Période mensuelle (sélection mois/année)",
      "● Taux d'avancement du programme",
      "● SPI (Schedule Performance Index)",
      "● CPI (Cost Performance Index)",
      "● Météo du programme (☀️ ⛅ 🌥️ ⛈️)",
      "● Taux de Go-Live & cible annuelle",
      "● Risques majeurs & bloquants",
      "● Tableau des décisions requises",
      "● Barre de consommation budget",
    ].join("\n"),
    color: PRIMARY,
    bgColor: "eff6ff",
  });

  // CTR box
  addCard(slide, 6.8, 1.3, 6.0, 4.5, {
    title: "Dashboard CTR (Comité de Transformation Restreint)",
    body: [
      "● Période personnalisée (date début/fin)",
      "● Mêmes KPIs de base + :",
      "● Adhérence au planning FDR",
      "● Taux de staffing",
      "● Top 5 chantiers à surveiller",
      "   — Phase, Avancement, SPI, Météo, Tendance",
      "● Principaux risques",
      "● Consommation budget",
      "",
      "Remplace le reporting PowerPoint manuel",
    ].join("\n"),
    color: ACCENT,
    bgColor: "ecfdf5",
  });

  slide.addText("Les dashboards sont générés dynamiquement depuis les données réelles du programme", {
    x: 0.6, y: 6.1, w: 12, h: 0.4,
    fontSize: 11, fontFace: "Segoe UI", italic: true, color: PRIMARY,
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 9: Ressources & Capacité
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Ressources, Capacité & Saisie Temps");

  const cols = [
    {
      title: "Gestion des Ressources",
      items: [
        "Fiches ressources : nom, type (Interne/Externe/Consultant), profil, TJM",
        "Profils paramétrables avec tarifs par défaut",
        "Affectation aux chantiers avec % de charge",
      ],
      color: PRIMARY,
      bgColor: "eff6ff",
    },
    {
      title: "Suivi de Capacité",
      items: [
        "Vue consolidée de la capacité par mois",
        "Planifié vs Réel avec graphiques",
        "Identification des surcharges",
      ],
      color: "7c3aed",
      bgColor: "f5f3ff",
    },
    {
      title: "Saisie Temps",
      items: [
        "Saisie hebdomadaire par ressource et chantier",
        "Validation et historique",
        "Calcul automatique du taux de consommation",
      ],
      color: ACCENT,
      bgColor: "ecfdf5",
    },
  ];

  cols.forEach((col, i) => {
    const x = 0.5 + i * 4.15;
    addCard(slide, x, 1.3, 3.95, 3.5, {
      title: col.title,
      body: col.items.join("\n● ").replace(/^/, "● "),
      color: col.color,
      bgColor: col.bgColor,
    });
  });

  slide.addText("Adhérences inter-chantiers", {
    x: 0.6, y: 5.2, w: 12, h: 0.35,
    fontSize: 14, fontFace: "Segoe UI", bold: true, color: "6366f1",
  });
  slide.addText("Suivi des dépendances entre chantiers avec niveau de criticité (Bloquante → Faible), statut de résolution, responsables, et contrats d'interface.", {
    x: 0.8, y: 5.6, w: 11.5, h: 0.6,
    fontSize: 11, fontFace: "Segoe UI", color: DARK,
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 10: Paramétrage & Configuration
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Paramétrage & Configuration");

  slide.addText("La plateforme est entièrement configurable par les administrateurs :", {
    x: 0.6, y: 1.2, w: 12, h: 0.4,
    fontSize: 13, fontFace: "Segoe UI", color: DARK,
  });

  const settings = [
    { title: "Pondération des phases", desc: "Poids de chaque phase (Précadrage, Cadrage, Exécution, Clôture) pour le calcul automatique de l'avancement" },
    { title: "Modèles de jalons", desc: "Jalons par défaut par phase, configurables avec nom et position (%). Application en un clic aux nouveaux chantiers" },
    { title: "Workflow RAID", desc: "Statuts personnalisables par type RAID (couleurs, ordre). Le Kanban s'adapte automatiquement" },
    { title: "Seuils d'alerte", desc: "Délai de relance (jours), seuil Q&A critique (heures) pour les notifications" },
  ];

  settings.forEach((s, i) => {
    const y = 1.8 + i * 1.2;
    addCard(slide, 0.5, y, 12.3, 1.0, {
      title: s.title,
      body: s.desc,
      color: i % 2 === 0 ? PRIMARY : ACCENT,
      bgColor: i % 2 === 0 ? "eff6ff" : "ecfdf5",
    });
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 11: Stack Technique
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Architecture & Stack Technique");

  const stack = [
    { cat: "Frontend", items: "Next.js 16 (App Router) + React 19 + TypeScript", color: PRIMARY },
    { cat: "UI", items: "Tailwind CSS + shadcn/ui + Radix UI + Lucide Icons", color: "7c3aed" },
    { cat: "Backend", items: "Server Actions (Next.js) — pas d'API REST séparée", color: ACCENT },
    { cat: "Base de données", items: "SQLite + Prisma ORM — léger, portable, sans serveur DB", color: "ea580c" },
    { cat: "Interactivité", items: "Kanban (dnd-kit), Calendrier, Graphiques (Recharts)", color: "0891b2" },
    { cat: "IA intégrée", items: "Chat assistant contextuel (Groq LLM) pour aide au pilotage", color: "d946ef" },
  ];

  stack.forEach((s, i) => {
    const y = 1.3 + i * 0.8;
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.5, y, w: 2.2, h: 0.6,
      fill: { color: s.color },
      rectRadius: 0.05,
    });
    slide.addText(s.cat, {
      x: 0.5, y, w: 2.2, h: 0.6,
      fontSize: 12, fontFace: "Segoe UI", bold: true, color: WHITE, align: "center", valign: "middle",
    });
    slide.addText(s.items, {
      x: 2.9, y, w: 10, h: 0.6,
      fontSize: 12, fontFace: "Segoe UI", color: DARK, valign: "middle",
    });
  });

  addCard(slide, 0.5, 6.2, 12.3, 0.7, {
    body: "Déploiement recommandé : VPS (Hetzner/OVH) avec PM2 + Nginx, ou Railway/Fly.io pour un déploiement en un clic.",
    color: GRAY,
    bgColor: "f1f5f9",
  });
}

// ═══════════════════════════════════════════════════════
// SLIDE 12: Prochaines étapes
// ═══════════════════════════════════════════════════════
{
  const slide = addContentSlide("Prochaines étapes & Roadmap");

  const steps = [
    { phase: "Court terme", items: ["Déploiement sur serveur partagé pour l'équipe", "Formation des utilisateurs clés (PMO, Directeurs de chantier)", "Import des données existantes (si migration depuis Excel)"], color: ACCENT },
    { phase: "Moyen terme", items: ["Authentification et gestion des rôles (RBAC)", "Notifications par email (échéances, alertes)", "Export PDF des dashboards CTP/CTR"], color: PRIMARY },
    { phase: "Long terme", items: ["Migration vers PostgreSQL (si montée en charge)", "Intégration avec outils existants (MS Project, Jira)", "Module de reporting avancé et prédictif"], color: "7c3aed" },
  ];

  steps.forEach((step, i) => {
    const x = 0.5 + i * 4.15;
    slide.addShape(pptx.ShapeType.roundRect, {
      x, y: 1.3, w: 3.95, h: 0.55,
      fill: { color: step.color },
      rectRadius: 0.05,
    });
    slide.addText(step.phase, {
      x, y: 1.3, w: 3.95, h: 0.55,
      fontSize: 14, fontFace: "Segoe UI", bold: true, color: WHITE, align: "center", valign: "middle",
    });
    slide.addText(step.items.map(item => ({ text: `●  ${item}\n`, options: { fontSize: 11, color: DARK } })), {
      x: x + 0.15, y: 2.0, w: 3.65, h: 3.0,
      fontFace: "Segoe UI", lineSpacingMultiple: 1.5, valign: "top",
    });
  });

  // CTA
  slide.addShape(pptx.ShapeType.roundRect, {
    x: 3.5, y: 5.5, w: 6.3, h: 1.0,
    fill: { color: PRIMARY_DARK },
    rectRadius: 0.08,
  });
  slide.addText("Prêt pour une démonstration en direct ?", {
    x: 3.5, y: 5.5, w: 6.3, h: 1.0,
    fontSize: 18, fontFace: "Segoe UI", bold: true, color: WHITE, align: "center", valign: "middle",
  });
}

// ── Generate ──
const outputPath = "Data/Presentation_PMO_Transformation.pptx";
await pptx.writeFile({ fileName: outputPath });
console.log(`Presentation generated: ${outputPath}`);
