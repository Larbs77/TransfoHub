/**
 * HTML + text body of a chantier action reminder.
 * Tables use inline styles so Outlook (Word engine) keeps the layout.
 */
import { formatCasablancaDate } from "@/lib/mail-relance-window";

export type RelanceKpis = {
  active: number;
  overdue: number;
  thisWeek: number;
  nextWeek: number;
  closeRate: number;
};

export type RelanceTableRow = {
  code: string;
  intitule: string;
  responsable: string;
  echeance: string;
  statut: string;
  retardJours: number | null;
  href: string;
};

export type RelanceMailInput = {
  test: boolean;
  chantierId: string;
  code: string;
  nom: string;
  now: Date;
  appUrl: string;
  kpis: RelanceKpis;
  overdue: RelanceTableRow[];
  thisWeek: RelanceTableRow[];
};

const NAVY = "#0A3C74";
const TEAL = "#00BDBB";
const MUTED = "#64748b";
const LINE = "#dbe3ef";

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appBase(appUrl: string): string {
  return appUrl.trim().replace(/\/+$/, "");
}

function absolute(appUrl: string, path: string): string {
  const base = appBase(appUrl);
  return base ? `${base}${path}` : path;
}

function raidListHref(
  appUrl: string,
  chantierId: string,
  params: Record<string, string>
): string {
  const sp = new URLSearchParams({ scope: "all", chantier: chantierId, ...params });
  return absolute(appUrl, `/raid/actions?${sp.toString()}`);
}

type KpiCell = {
  label: string;
  value: string;
  subtitle: string;
  href: string;
  color: string;
  bg: string;
};

function kpiCells(input: RelanceMailInput): KpiCell[] {
  const { kpis, appUrl, chantierId } = input;
  return [
    {
      label: "Actions actives",
      value: String(kpis.active),
      subtitle: "Non clôturées",
      href: raidListHref(appUrl, chantierId, { statut: "active" }),
      color: NAVY,
      bg: "#f8fafc",
    },
    {
      label: "Actions échues",
      value: String(kpis.overdue),
      subtitle: "Date dépassée",
      href: raidListHref(appUrl, chantierId, { overdue: "true" }),
      color: kpis.overdue > 0 ? "#dc2626" : NAVY,
      bg: kpis.overdue > 0 ? "#fef2f2" : "#f8fafc",
    },
    {
      label: "Cette semaine",
      value: String(kpis.thisWeek),
      subtitle: "À échoir",
      href: raidListHref(appUrl, chantierId, { echeance: "week" }),
      color: kpis.thisWeek > 0 ? "#d97706" : NAVY,
      bg: kpis.thisWeek > 0 ? "#fffbeb" : "#f8fafc",
    },
    {
      label: "Semaine prochaine",
      value: String(kpis.nextWeek),
      subtitle: "Semaine suivante",
      href: raidListHref(appUrl, chantierId, { echeance: "next" }),
      color: kpis.nextWeek > 0 ? "#0284c7" : NAVY,
      bg: kpis.nextWeek > 0 ? "#f0f9ff" : "#f8fafc",
    },
    {
      label: "Taux de clôture",
      value: `${kpis.closeRate}%`,
      subtitle: "Actions clôturées",
      href: raidListHref(appUrl, chantierId, { statut: "Clôturé" }),
      color: kpis.closeRate >= 50 ? "#059669" : NAVY,
      bg: kpis.closeRate >= 50 ? "#ecfdf5" : "#f8fafc",
    },
  ];
}

function linkHtml(href: string, label: string): string {
  if (!href || href.startsWith("/")) {
    return esc(label);
  }
  return `<a href="${esc(href)}" style="color:${NAVY};text-decoration:underline">${esc(label)}</a>`;
}

function kpiHtml(cells: KpiCell[]): string {
  const tds = cells
    .map((cell) => {
      const inner = `<p style="margin:0;font-size:10px;line-height:1.3;color:${NAVY}">${esc(cell.label)}</p>
<p style="margin:4px 0;font-size:22px;line-height:1;font-weight:bold;color:${cell.color}">${esc(cell.value)}</p>
<p style="margin:0;font-size:10px;line-height:1.3;color:${MUTED}">${esc(cell.subtitle)}</p>`;
      const linked =
        cell.href && !cell.href.startsWith("/")
          ? `<a href="${esc(cell.href)}" style="text-decoration:none;color:${NAVY}">${inner}</a>`
          : inner;
      return `<td width="20%" align="center" valign="top" bgcolor="${cell.bg}" style="border:1px solid ${LINE};padding:8px 4px">${linked}</td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="4" style="border-collapse:separate;margin:8px 0 16px">
<tr>${tds}</tr>
</table>`;
}

function rowsHtml(rows: RelanceTableRow[], withRetard: boolean): string {
  const headers = [
    "Code",
    "Intitulé",
    "Responsable",
    "Échéance",
    "Statut",
    ...(withRetard ? ["Retard (jours)"] : []),
    "Lien",
  ];
  const head = headers
    .map(
      (h) =>
        `<th align="left" style="background:${NAVY};color:#ffffff;border:1px solid ${NAVY};padding:6px 8px;font-size:12px;font-weight:bold">${esc(h)}</th>`
    )
    .join("");
  if (rows.length === 0) {
    const label = withRetard
      ? "Aucune action échue."
      : "Aucune action à échoir cette semaine.";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
<tr>${head}</tr>
<tr><td colspan="${headers.length}" style="border:1px solid ${LINE};padding:8px;font-size:12px;color:${MUTED}">${esc(label)}</td></tr>
</table>`;
  }
  const body = rows
    .map((row, index) => {
      const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      const cells = [
        row.code || "—",
        row.intitule || "—",
        row.responsable || "—",
        row.echeance || "—",
        row.statut || "—",
        ...(withRetard
          ? [row.retardJours == null ? "—" : String(row.retardJours)]
          : []),
      ];
      const tds = cells
        .map(
          (value) =>
            `<td valign="top" bgcolor="${bg}" style="border:1px solid ${LINE};padding:6px 8px;font-size:12px;color:${NAVY}">${esc(value)}</td>`
        )
        .join("");
      const link = `<td valign="top" bgcolor="${bg}" style="border:1px solid ${LINE};padding:6px 8px;font-size:12px">${linkHtml(row.href, "Ouvrir")}</td>`;
      return `<tr>${tds}${link}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
<tr>${head}</tr>
${body}
</table>`;
}

function rowsText(rows: RelanceTableRow[], withRetard: boolean): string {
  if (rows.length === 0) {
    return withRetard
      ? "Aucune action échue."
      : "Aucune action à échoir cette semaine.";
  }
  return rows
    .map((row) => {
      const bits = [
        row.code || "—",
        row.intitule || "—",
        row.responsable || "—",
        row.echeance || "—",
        row.statut || "—",
      ];
      if (withRetard) {
        bits.push(row.retardJours == null ? "—" : `${row.retardJours} j`);
      }
      if (row.href) bits.push(row.href);
      return `- ${bits.join(" — ")}`;
    })
    .join("\n");
}

export function buildRelanceMail(input: RelanceMailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const dateLabel = formatCasablancaDate(input.now);
  const code = input.code.replace(/\s+/g, " ").trim();
  const nom = input.nom.replace(/\s+/g, " ").trim();
  const title = `${code} ${nom}`.trim();
  const subjectCore = `TransfoHub — ${title} — relance des actions du ${dateLabel}`;
  const subject = input.test ? `[Test] ${subjectCore}` : subjectCore;
  const intro = `Relevé des actions du chantier ${code} — ${nom} au ${dateLabel}.`;
  const cells = kpiCells(input);
  const kpiText = [
    `Actions actives : ${input.kpis.active}`,
    `Actions échues : ${input.kpis.overdue}`,
    `Cette semaine : ${input.kpis.thisWeek}`,
    `Semaine prochaine : ${input.kpis.nextWeek}`,
    `Taux de clôture : ${input.kpis.closeRate}%`,
  ].join("\n");
  const linkNote = appBase(input.appUrl)
    ? ""
    : "\n\nLes liens restent des chemins : l'URL de l'application n'est pas renseignée dans la messagerie.";

  const text = [
    "Bonjour,",
    "",
    intro,
    "",
    kpiText,
    "",
    "Actions échues",
    rowsText(input.overdue, true),
    "",
    "Actions de cette semaine",
    rowsText(input.thisWeek, false),
    linkNote,
    "",
    "Cordialement,",
    "Program Office",
    "TransfoHub",
  ].join("\n");

  const htmlLinkNote = appBase(input.appUrl)
    ? ""
    : `<p style="margin:0 0 12px;font-size:12px;color:${MUTED}">Les liens restent des chemins : l'URL de l'application n'est pas renseignée dans la messagerie.</p>`;

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f7fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:640px;background:#ffffff;border:1px solid ${LINE};font-family:Calibri,Arial,sans-serif;color:${NAVY};">
<tr><td style="background:${NAVY};padding:16px 20px;">
<p style="margin:0;font-size:16px;font-weight:bold;color:#ffffff;">TransfoHub</p>
<p style="margin:4px 0 0;font-size:12px;color:${TEAL};">Relance des actions</p>
</td></tr>
<tr><td style="padding:20px;">
<p style="margin:0 0 12px;font-size:14px;line-height:1.5;">Bonjour,</p>
<p style="margin:0 0 12px;font-size:14px;line-height:1.5;">${esc(intro)}</p>
${kpiHtml(cells)}
<p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:${NAVY};">Actions échues</p>
${rowsHtml(input.overdue, true)}
<p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:${NAVY};">Actions de cette semaine</p>
${rowsHtml(input.thisWeek, false)}
${htmlLinkNote}
<p style="margin:8px 0 0;font-size:14px;line-height:1.5;">Cordialement,<br/>Program Office<br/>TransfoHub</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

export function buildMissingAddressMail(input: {
  code: string;
  nom: string;
  missing: { nom: string; roles: string }[];
  sentToOthers: boolean;
}): { subject: string; text: string; html: string } {
  const subject = `Adresse manquante — ${input.code} ${input.nom}`.trim();
  const lead = input.sentToOthers
    ? `Le mail de relance du chantier ${input.code} — ${input.nom} a été envoyé aux destinataires qui ont une adresse. Les personnes suivantes n'en ont pas sur leur fiche :`
    : `Le mail de relance du chantier ${input.code} — ${input.nom} n'a pas pu être envoyé : aucune adresse n'est renseignée pour :`;
  const lines = input.missing.map((p) => `- ${p.nom} (${p.roles})`);
  const text = [
    "Bonjour,",
    "",
    lead,
    "",
    ...lines,
    "",
    "Cordialement,",
    "Program Office",
    "TransfoHub",
  ].join("\n");
  const items = input.missing
    .map(
      (p) =>
        `<li>${esc(p.nom)} (${esc(p.roles)})</li>`
    )
    .join("");
  const html = `<div style="font-family:Calibri,Arial,sans-serif;color:${NAVY};line-height:1.5">
<p>Bonjour,</p>
<p>${esc(lead)}</p>
<ul>${items}</ul>
<p>Cordialement,<br/>Program Office<br/>TransfoHub</p>
</div>`;
  return { subject, text, html };
}
