/**
 * Chantier action reminders.
 *
 * Scheduled: Monday and Thursday, 02:00–08:00 Africa/Casablanca, at most once
 * per chantier and per morning. Recipients are the chantier directeur, the
 * suppléant, and the PMO. Manual sends ignore that lock. A test send goes to
 * the typed address only and does not consume the slot.
 *
 * Échéance buckets use the same helpers as the home dashboard, so the figures
 * match the screen. The slot clock itself is always Casablanca.
 */
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import {
  isActionActive,
  isActionDoublon,
  isRaidDueNextWeek,
  isRaidDueThisWeek,
  isRaidOverdue,
  raidEffectiveEcheance,
} from "@/lib/raid-labels";
import {
  buildMissingAddressMail,
  buildRelanceMail,
  type RelanceKpis,
  type RelanceTableRow,
} from "@/lib/mail-relance-template";
import {
  describeRelanceWindow,
  formatCasablancaDate,
  retardJours,
  type RelanceWindow,
} from "@/lib/mail-relance-window";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STALE_MS = 30 * 60 * 1000;

export type RelanceRunStatus =
  | "envoye"
  | "partiel"
  | "echec"
  | "ignore"
  | "encours";

export type RelanceTrigger = "planifie" | "manuel" | "test";

export type RelanceRunItemView = {
  id: string;
  chantierId: string;
  chantierCode: string;
  chantierNom: string;
  status: string;
  recipients: string;
  missingNames: string;
  overdueCount: number;
  weekCount: number;
  error: string;
};

export type RelanceRunView = {
  id: string;
  trigger: RelanceTrigger;
  slotKey: string;
  status: RelanceRunStatus;
  reason: string;
  chantierCount: number;
  sentCount: number;
  failedCount: number;
  message: string;
  startedAt: string;
  finishedAt: string | null;
  items: RelanceRunItemView[];
};

export type RelancePreviewChantier = {
  chantierId: string;
  code: string;
  nom: string;
  recipients: string[];
  missing: string[];
  active: number;
  overdue: number;
  thisWeek: number;
  nextWeek: number;
  closeRate: number;
};

export type RelancePreview = RelanceWindow & {
  autoEnabled: boolean;
  chantiers: RelancePreviewChantier[];
};

type Person = {
  nom: string;
  email: string | null;
  roles: string;
};

type Digest = {
  chantierId: string;
  code: string;
  nom: string;
  recipients: Person[];
  missing: Person[];
  kpis: RelanceKpis;
  overdue: RelanceTableRow[];
  thisWeek: RelanceTableRow[];
  eligible: boolean;
};

type MailContext = {
  hasActiveSmtp: boolean;
  relanceEnabled: boolean;
  appUrl: string;
  poEmail: string | null;
  chantiers: Digest[];
};

type RunRow = {
  id: string;
  trigger: string;
  slotKey: string;
  status: string;
  reason: string;
  chantierCount: number;
  sentCount: number;
  failedCount: number;
  message: string;
  startedAt: Date;
  finishedAt: Date | null;
  items: Array<{
    id: string;
    chantierId: string;
    chantierCode: string;
    chantierNom: string;
    status: string;
    recipients: string;
    missingNames: string;
    overdueCount: number;
    weekCount: number;
    error: string;
  }>;
};

function isDirecteurRole(role: string): boolean {
  return role.trim().toLowerCase() === "directeur de chantier";
}

/** « Directeur de chantier - suppléant », y compris les variantes accentuées. */
function isSuppleantRole(role: string): boolean {
  return /suppl[eé]ant/i.test(role.trim());
}

function isPmoRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  return r === "pmo" || /^pmo(?:\s|$|[-_])/i.test(r);
}

function validEmail(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v || !EMAIL_RE.test(v)) return null;
  return v;
}

function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : "Échec de l'envoi.";
  return message.slice(0, 500);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function formatMailbox(nom: string, email: string): string {
  const safe = nom.replace(/["\\<>]/g, "").trim();
  return safe ? `"${safe}" <${email}>` : email;
}

function toRunView(run: RunRow): RelanceRunView {
  return {
    id: run.id,
    trigger: run.trigger as RelanceTrigger,
    slotKey: run.slotKey,
    status: run.status as RelanceRunStatus,
    reason: run.reason,
    chantierCount: run.chantierCount,
    sentCount: run.sentCount,
    failedCount: run.failedCount,
    message: run.message,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
    items: run.items.map((item) => ({
      id: item.id,
      chantierId: item.chantierId,
      chantierCode: item.chantierCode,
      chantierNom: item.chantierNom,
      status: item.status,
      recipients: item.recipients,
      missingNames: item.missingNames,
      overdueCount: item.overdueCount,
      weekCount: item.weekCount,
      error: item.error,
    })),
  };
}

const runInclude = {
  items: { orderBy: { chantierCode: "asc" as const } },
};

export async function listRelanceRuns(limit = 40): Promise<{
  runs: RelanceRunView[];
  window: RelanceWindow;
}> {
  const runs = await prisma.relanceRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: runInclude,
  });
  return {
    runs: runs.map((run) => toRunView(run)),
    window: describeRelanceWindow(new Date()),
  };
}

async function readRun(id: string): Promise<RelanceRunView | null> {
  const run = await prisma.relanceRun.findUnique({
    where: { id },
    include: runInclude,
  });
  return run ? toRunView(run) : null;
}

async function closeStaleRuns(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_MS);
  const stale = await prisma.relanceRun.findMany({
    where: { status: "encours", startedAt: { lt: cutoff } },
    include: { items: { select: { status: true } } },
  });
  for (const run of stale) {
    const sent = run.items.filter((item) => item.status === "envoye").length;
    const failed = run.items.filter((item) => item.status === "echec").length;
    const status: RelanceRunStatus =
      sent > 0 && failed === 0 && sent >= run.chantierCount
        ? "envoye"
        : sent > 0
          ? "partiel"
          : "echec";
    await prisma.relanceRun.update({
      where: { id: run.id },
      data: {
        status,
        sentCount: sent,
        failedCount: Math.max(failed, run.chantierCount - sent),
        finishedAt: new Date(),
        message: "Envoi interrompu avant la fin.",
      },
    });
  }
}

async function noteOnce(
  slotKey: string,
  reason: string,
  status: RelanceRunStatus,
  message: string
): Promise<void> {
  const existing = await prisma.relanceRun.findFirst({
    where: { trigger: "planifie", slotKey, reason },
    select: { id: true },
  });
  if (existing) return;
  try {
    const now = new Date();
    await prisma.relanceRun.create({
      data: {
        trigger: "planifie",
        slotKey,
        reason,
        status,
        message,
        startedAt: now,
        finishedAt: now,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
}

async function loadContext(now: Date): Promise<MailContext> {
  const config =
    (await prisma.mailServerConfig.findFirst({
      where: { is_default: true, is_active: true },
      orderBy: { updatedAt: "desc" },
    })) ??
    (await prisma.mailServerConfig.findFirst({
      where: { is_active: true },
      orderBy: { updatedAt: "desc" },
    })) ??
    (await prisma.mailServerConfig.findFirst({
      orderBy: { updatedAt: "desc" },
    }));

  const [chantiers, membres, raids] = await Promise.all([
    prisma.chantier.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, nom: true },
    }),
    prisma.membreEquipe.findMany({
      select: {
        chantierId: true,
        role: true,
        ressourceId: true,
        ressource: {
          select: {
            nom_complet: true,
            email: true,
            user: { select: { email: true } },
          },
        },
      },
    }),
    prisma.raid.findMany({
      where: { deletedAt: null, type: "Action", chantierId: { not: null } },
      select: {
        id: true,
        code: true,
        intitule: true,
        statut: true,
        chantierId: true,
        responsable: true,
        date_echeance: true,
        date_echeance_actualisee: true,
        responsableRessource: { select: { nom_complet: true } },
      },
    }),
  ]);

  const membersByChantier = new Map<string, typeof membres>();
  for (const membre of membres) {
    const list = membersByChantier.get(membre.chantierId) ?? [];
    list.push(membre);
    membersByChantier.set(membre.chantierId, list);
  }
  const raidsByChantier = new Map<string, typeof raids>();
  for (const raid of raids) {
    if (!raid.chantierId) continue;
    const list = raidsByChantier.get(raid.chantierId) ?? [];
    list.push(raid);
    raidsByChantier.set(raid.chantierId, list);
  }

  const appUrl = config?.app_url ?? "";
  const digests = chantiers.map((chantier) =>
    buildDigest(
      chantier,
      membersByChantier.get(chantier.id) ?? [],
      raidsByChantier.get(chantier.id) ?? [],
      now,
      appUrl
    )
  );

  return {
    hasActiveSmtp: Boolean(
      config?.is_active && config.from_email?.trim() && config.host?.trim()
    ),
    relanceEnabled: Boolean(config?.relance_mail_enabled),
    appUrl,
    poEmail: validEmail(config?.programme_office_email),
    chantiers: digests,
  };
}

function buildDigest(
  chantier: { id: string; code: string; nom: string },
  membres: Array<{
    role: string;
    ressourceId: string;
    ressource: {
      nom_complet: string;
      email: string;
      user: { email: string } | null;
    };
  }>,
  raids: Array<{
    id: string;
    code: string;
    intitule: string;
    statut: string;
    responsable: string;
    date_echeance: Date | null;
    date_echeance_actualisee: Date | null;
    responsableRessource: { nom_complet: string } | null;
  }>,
  now: Date,
  appUrl: string
): Digest {
  const grouped = new Map<
    string,
    {
      nom: string;
      email: string | null;
      directeur: boolean;
      suppleant: boolean;
      pmo: boolean;
    }
  >();
  for (const membre of membres) {
    const directeur = isDirecteurRole(membre.role);
    const suppleant = isSuppleantRole(membre.role);
    const pmo = isPmoRole(membre.role);
    if (!directeur && !suppleant && !pmo) continue;
    const current = grouped.get(membre.ressourceId) ?? {
      nom: membre.ressource.nom_complet.trim() || "Sans nom",
      email:
        validEmail(membre.ressource.email) ??
        validEmail(membre.ressource.user?.email),
      directeur: false,
      suppleant: false,
      pmo: false,
    };
    current.directeur = current.directeur || directeur;
    current.suppleant = current.suppleant || suppleant;
    current.pmo = current.pmo || pmo;
    if (!current.nom || current.nom === "Sans nom") {
      current.nom = membre.ressource.nom_complet.trim() || current.nom;
    }
    grouped.set(membre.ressourceId, current);
  }

  const people = [...grouped.values()].sort((a, b) => {
    if (a.directeur !== b.directeur) return a.directeur ? -1 : 1;
    if (a.suppleant !== b.suppleant) return a.suppleant ? -1 : 1;
    return a.nom.localeCompare(b.nom, "fr");
  });
  const seenEmails = new Set<string>();
  const recipients: Person[] = [];
  const missing: Person[] = [];
  for (const person of people) {
    const roles = [
      person.directeur ? "Directeur de chantier" : null,
      person.suppleant ? "Suppléant" : null,
      person.pmo ? "PMO" : null,
    ]
      .filter(Boolean)
      .join(", ");
    if (!person.email) {
      missing.push({ nom: person.nom, email: null, roles });
      continue;
    }
    const key = person.email.toLowerCase();
    if (seenEmails.has(key)) continue;
    seenEmails.add(key);
    recipients.push({ nom: person.nom, email: person.email, roles });
  }

  const population = raids.filter((raid) => !isActionDoublon(raid.statut));
  const active = population.filter((raid) => isActionActive(raid.statut));
  const overdue = active
    .filter((raid) =>
      isRaidOverdue(
        raid.statut,
        raid.date_echeance_actualisee,
        raid.date_echeance,
        now
      )
    )
    .sort(byEcheance);
  const thisWeek = active
    .filter((raid) =>
      isRaidDueThisWeek(
        raid.statut,
        raid.date_echeance_actualisee,
        raid.date_echeance,
        now
      )
    )
    .sort(byEcheance);
  const nextWeek = active.filter((raid) =>
    isRaidDueNextWeek(
      raid.statut,
      raid.date_echeance_actualisee,
      raid.date_echeance,
      now
    )
  ).length;
  const closed = population.filter((raid) => raid.statut === "Clôturé").length;
  const closeRate =
    population.length > 0 ? Math.round((closed / population.length) * 100) : 0;

  const base = appUrl.trim().replace(/\/+$/, "");
  const toRow = (
    raid: (typeof overdue)[number],
    withRetard: boolean
  ): RelanceTableRow => {
    const echeance = raidEffectiveEcheance(
      raid.date_echeance_actualisee,
      raid.date_echeance
    );
    const path = `/raid/${raid.id}`;
    return {
      code: raid.code,
      intitule: (raid.intitule || "").replace(/\s+/g, " ").trim(),
      responsable:
        raid.responsableRessource?.nom_complet?.trim() ||
        raid.responsable.trim() ||
        "—",
      echeance: echeance ? formatCasablancaDate(echeance) : "—",
      statut: raid.statut,
      retardJours:
        withRetard && echeance ? retardJours(echeance, now) : null,
      href: base ? `${base}${path}` : path,
    };
  };

  return {
    chantierId: chantier.id,
    code: chantier.code,
    nom: chantier.nom,
    recipients,
    missing,
    kpis: {
      active: active.length,
      overdue: overdue.length,
      thisWeek: thisWeek.length,
      nextWeek,
      closeRate,
    },
    overdue: overdue.map((raid) => toRow(raid, true)),
    thisWeek: thisWeek.map((raid) => toRow(raid, false)),
    eligible: overdue.length + thisWeek.length > 0,
  };
}

function byEcheance(
  a: {
    date_echeance_actualisee: Date | null;
    date_echeance: Date | null;
  },
  b: {
    date_echeance_actualisee: Date | null;
    date_echeance: Date | null;
  }
): number {
  const da =
    raidEffectiveEcheance(
      a.date_echeance_actualisee,
      a.date_echeance
    )?.getTime() ?? 0;
  const db =
    raidEffectiveEcheance(
      b.date_echeance_actualisee,
      b.date_echeance
    )?.getTime() ?? 0;
  return da - db;
}

function previewOf(digest: Digest): RelancePreviewChantier {
  return {
    chantierId: digest.chantierId,
    code: digest.code,
    nom: digest.nom,
    recipients: digest.recipients.map((p) => `${p.nom} <${p.email}>`),
    missing: digest.missing.map((p) => `${p.nom} (${p.roles})`),
    active: digest.kpis.active,
    overdue: digest.kpis.overdue,
    thisWeek: digest.kpis.thisWeek,
    nextWeek: digest.kpis.nextWeek,
    closeRate: digest.kpis.closeRate,
  };
}

export async function previewRelances(
  now: Date = new Date()
): Promise<RelancePreview> {
  const context = await loadContext(now);
  const window = describeRelanceWindow(now);
  return {
    ...window,
    autoEnabled: context.relanceEnabled,
    chantiers: context.chantiers.filter((c) => c.eligible).map(previewOf),
  };
}

export async function listChantierOptions(): Promise<
  Array<{ id: string; code: string; nom: string }>
> {
  return prisma.chantier.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, nom: true },
  });
}

type Delivery = {
  status: "envoye" | "echec";
  recipients: string;
  missingNames: string;
  error: string;
};

async function deliver(
  digest: Digest,
  now: Date,
  context: MailContext,
  options: { testTo?: string }
): Promise<Delivery> {
  const mail = buildRelanceMail({
    test: Boolean(options.testTo),
    chantierId: digest.chantierId,
    code: digest.code,
    nom: digest.nom,
    now,
    appUrl: context.appUrl,
    kpis: digest.kpis,
    overdue: digest.overdue,
    thisWeek: digest.thisWeek,
  });
  const missingNames = digest.missing.map((p) => `${p.nom} (${p.roles})`).join(", ");

  if (options.testTo) {
    await sendMail({
      to: options.testTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
    return {
      status: "envoye",
      recipients: options.testTo,
      missingNames: "",
      error: "",
    };
  }

  const notes: string[] = [];
  let sentTeam = false;
  if (digest.recipients.length > 0) {
    try {
      await sendMail({
        to: digest.recipients.map((p) => formatMailbox(p.nom, p.email as string)),
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      sentTeam = true;
    } catch (error) {
      notes.push(errorText(error));
    }
  }

  let poSent = false;
  if (digest.missing.length > 0 && context.poEmail) {
    const po = buildMissingAddressMail({
      code: digest.code,
      nom: digest.nom,
      missing: digest.missing.map((p) => ({ nom: p.nom, roles: p.roles })),
      sentToOthers: sentTeam,
    });
    try {
      await sendMail({
        to: context.poEmail,
        subject: po.subject,
        text: po.text,
        html: po.html,
      });
      poSent = true;
    } catch (error) {
      notes.push(`Program Office : ${errorText(error)}`);
    }
  }

  if (!sentTeam && digest.recipients.length === 0 && !context.poEmail) {
    notes.push(
      "Aucune adresse destinataire, et l'e-mail du Program Office n'est pas configuré."
    );
  } else if (!sentTeam && digest.recipients.length === 0 && !poSent) {
    notes.push("Aucune adresse destinataire. L'avertissement au Program Office a échoué.");
  } else if (sentTeam && digest.missing.length > 0 && !context.poEmail) {
    notes.push(
      "Certaines fiches n'ont pas d'adresse. L'e-mail du Program Office n'est pas configuré."
    );
  } else if (!sentTeam && digest.recipients.length === 0 && poSent) {
    notes.push("Aucune adresse : avertissement envoyé au Program Office.");
  }

  const ok = sentTeam || (digest.recipients.length === 0 && poSent);
  return {
    status: ok ? "envoye" : "echec",
    recipients: digest.recipients.map((p) => p.email).join(", "),
    missingNames,
    error: notes.join(" ").slice(0, 500),
  };
}

async function writeItem(
  runId: string,
  digest: Digest,
  delivery: Delivery
): Promise<void> {
  await prisma.relanceRunItem.create({
    data: {
      runId,
      chantierId: digest.chantierId,
      chantierCode: digest.code,
      chantierNom: digest.nom,
      status: delivery.status,
      recipients: delivery.recipients,
      missingNames: delivery.missingNames,
      overdueCount: digest.kpis.overdue,
      weekCount: digest.kpis.thisWeek,
      error: delivery.error,
    },
  });
}

async function finalizeRun(
  runId: string,
  sent: number,
  failed: number,
  message: string
): Promise<RelanceRunView | null> {
  const status: RelanceRunStatus =
    failed === 0 ? "envoye" : sent === 0 ? "echec" : "partiel";
  await prisma.relanceRun.update({
    where: { id: runId },
    data: {
      status,
      sentCount: sent,
      failedCount: failed,
      message,
      finishedAt: new Date(),
    },
  });
  return readRun(runId);
}

async function claimDispatch(
  chantierId: string,
  slotKey: string
): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const row = await prisma.relanceDispatch.findUnique({
      where: { chantierId_slotKey: { chantierId, slotKey } },
    });
    if (!row) {
      try {
        const created = await prisma.relanceDispatch.create({
          data: { chantierId, slotKey, status: "pending" },
        });
        return created.id;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        continue;
      }
    }
    if (row.status === "sent") return null;
    if (row.status === "pending" && Date.now() - row.updatedAt.getTime() < STALE_MS) {
      return null;
    }
    const taken = await prisma.relanceDispatch.updateMany({
      where: { id: row.id, status: row.status, updatedAt: row.updatedAt },
      data: { status: "pending" },
    });
    if (taken.count === 1) return row.id;
  }
  return null;
}

async function markDispatch(id: string, status: "sent" | "failed"): Promise<void> {
  await prisma.relanceDispatch.update({
    where: { id },
    data: { status },
  });
}

export type ScheduledRelanceResult = {
  outcome:
    | "hors_creneau"
    | "ignore_disabled"
    | "empty"
    | "no_config"
    | "noop"
    | "sent";
  message: string;
  sent: number;
  failed: number;
};

export async function runScheduledRelances(
  now: Date = new Date()
): Promise<ScheduledRelanceResult> {
  const window = describeRelanceWindow(now);
  if (!window.inWindow || !window.slotKey) {
    return {
      outcome: "hors_creneau",
      message: window.label,
      sent: 0,
      failed: 0,
    };
  }
  const slotKey = window.slotKey;
  await closeStaleRuns();
  const context = await loadContext(now);

  if (!context.hasActiveSmtp) {
    await noteOnce(
      slotKey,
      "no_config",
      "echec",
      "Serveur de messagerie absent ou inactif."
    );
    return {
      outcome: "no_config",
      message: "Serveur de messagerie absent ou inactif.",
      sent: 0,
      failed: 0,
    };
  }
  if (!context.relanceEnabled) {
    await noteOnce(
      slotKey,
      "disabled",
      "ignore",
      "Relances automatiques désactivées."
    );
    return {
      outcome: "ignore_disabled",
      message: "Relances automatiques désactivées.",
      sent: 0,
      failed: 0,
    };
  }

  const eligible = context.chantiers.filter((c) => c.eligible);
  if (eligible.length === 0) {
    await noteOnce(
      slotKey,
      "empty",
      "ignore",
      "Aucun chantier avec des actions échues ou de cette semaine."
    );
    return {
      outcome: "empty",
      message: "Aucun chantier avec des actions échues ou de cette semaine.",
      sent: 0,
      failed: 0,
    };
  }

  const todo: Array<{ digest: Digest; dispatchId: string }> = [];
  for (const digest of eligible) {
    const dispatchId = await claimDispatch(digest.chantierId, slotKey);
    if (dispatchId) todo.push({ digest, dispatchId });
  }
  if (todo.length === 0) {
    return {
      outcome: "noop",
      message: "Créneau déjà traité.",
      sent: 0,
      failed: 0,
    };
  }

  const run = await prisma.relanceRun.create({
    data: {
      trigger: "planifie",
      slotKey,
      status: "encours",
      reason: "sent",
      chantierCount: todo.length,
      message: "Envoi en cours.",
    },
  });

  let sent = 0;
  let failed = 0;
  for (const item of todo) {
    try {
      const delivery = await deliver(item.digest, now, context, {});
      await writeItem(run.id, item.digest, delivery);
      await markDispatch(
        item.dispatchId,
        delivery.status === "envoye" ? "sent" : "failed"
      );
      if (delivery.status === "envoye") sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error("[relance] chantier", item.digest.code, error);
      await markDispatch(item.dispatchId, "failed");
      await writeItem(run.id, item.digest, {
        status: "echec",
        recipients: "",
        missingNames: "",
        error: errorText(error),
      });
    }
  }

  const message = `${sent} envoyé(s), ${failed} échec(s).`;
  await finalizeRun(run.id, sent, failed, message);
  return { outcome: "sent", message, sent, failed };
}

export async function sendRelancesNow(
  now: Date = new Date()
): Promise<
  | { ok: true; message: string; run: RelanceRunView | null }
  | { ok: false; error: string }
> {
  await closeStaleRuns();
  const cutoff = new Date(Date.now() - STALE_MS);
  const active = await prisma.relanceRun.findFirst({
    where: { trigger: "manuel", status: "encours", startedAt: { gt: cutoff } },
    select: { id: true },
  });
  if (active) {
    return { ok: false, error: "Un envoi manuel est déjà en cours." };
  }

  const context = await loadContext(now);
  if (!context.hasActiveSmtp) {
    return {
      ok: false,
      error:
        "Serveur de messagerie absent ou inactif. Enregistrez une configuration active.",
    };
  }
  const eligible = context.chantiers.filter((c) => c.eligible);
  if (eligible.length === 0) {
    return {
      ok: false,
      error:
        "Aucun chantier n'a d'action échue ou à échoir cette semaine.",
    };
  }

  const window = describeRelanceWindow(now);
  const run = await prisma.relanceRun.create({
    data: {
      trigger: "manuel",
      slotKey: window.slotKey ?? formatSlotDay(now),
      status: "encours",
      reason: "manual",
      chantierCount: eligible.length,
      message: "Envoi en cours.",
    },
  });

  let sent = 0;
  let failed = 0;
  for (const digest of eligible) {
    try {
      const delivery = await deliver(digest, now, context, {});
      await writeItem(run.id, digest, delivery);
      if (delivery.status === "envoye") sent += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error("[relance] manuel", digest.code, error);
      await writeItem(run.id, digest, {
        status: "echec",
        recipients: "",
        missingNames: "",
        error: errorText(error),
      });
    }
  }
  const message = `Relance manuelle : ${sent} envoyé(s), ${failed} échec(s).`;
  const view = await finalizeRun(run.id, sent, failed, message);
  return { ok: true, message, run: view };
}

function formatSlotDay(now: Date): string {
  const described = describeRelanceWindow(now);
  if (described.slotKey) return described.slotKey;
  const labelDate = formatCasablancaDate(now);
  const [day, month, year] = labelDate.split("/");
  return `${year}-${month}-${day}`;
}

export async function sendRelanceTest(params: {
  chantierId: string;
  to: string;
  now?: Date;
}): Promise<
  | { ok: true; message: string; run: RelanceRunView | null }
  | { ok: false; error: string; run?: RelanceRunView | null }
> {
  const to = params.to.trim();
  if (!to || !EMAIL_RE.test(to)) {
    return { ok: false, error: "Adresse e-mail invalide." };
  }
  const now = params.now ?? new Date();
  const context = await loadContext(now);
  const digest = context.chantiers.find((c) => c.chantierId === params.chantierId);
  if (!digest) return { ok: false, error: "Chantier introuvable." };
  if (!context.hasActiveSmtp) {
    return {
      ok: false,
      error:
        "Serveur de messagerie absent ou inactif. Enregistrez une configuration active.",
    };
  }

  const run = await prisma.relanceRun.create({
    data: {
      trigger: "test",
      slotKey: "",
      status: "encours",
      reason: "test",
      chantierCount: 1,
      message: "Envoi de test en cours.",
    },
  });

  try {
    const delivery = await deliver(digest, now, context, { testTo: to });
    await writeItem(run.id, digest, delivery);
    const message = `E-mail de test envoyé à ${to}.`;
    const view = await finalizeRun(run.id, 1, 0, message);
    return { ok: true, message, run: view };
  } catch (error) {
    const message = errorText(error);
    console.error("[relance] test", digest.code, error);
    await writeItem(run.id, digest, {
      status: "echec",
      recipients: to,
      missingNames: "",
      error: message,
    });
    const view = await finalizeRun(run.id, 0, 1, message);
    return { ok: false, error: message, run: view };
  }
}

