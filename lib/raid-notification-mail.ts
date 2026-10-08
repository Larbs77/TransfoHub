/**
 * Outbound RAID notification mails. Never throws to the caller:
 * in-app notifications stay the source of truth.
 */
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDefaultMailConfig, sendMail } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EVENT_LABEL: Record<string, string> = {
  raid_assigned: "assignation",
  raid_changed: "modification",
  raid_shared: "partage",
  raid_mention: "mention",
};

function isValidEmail(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v || !EMAIL_RE.test(v)) return null;
  return v;
}

function displayName(user: {
  username: string;
  first_name: string;
  last_name: string;
  ressource: { nom_complet: string } | null;
}): string {
  const fromRessource = user.ressource?.nom_complet?.trim();
  if (fromRessource) return fromRessource;
  const fromUser = [user.first_name, user.last_name]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
  return fromUser || user.username;
}

function resolveUserEmail(user: {
  email: string;
  ressource: { email: string } | null;
}): string | null {
  return isValidEmail(user.email) ?? isValidEmail(user.ressource?.email);
}

export function buildRaidUrl(appUrl: string, raidId: string): string {
  const base = appUrl.trim().replace(/\/+$/, "");
  if (!base) return "";
  return `${base}/raid/${raidId}`;
}

function formatText(body: string, raidUrl: string): string {
  const lines = ["Bonjour,", "", body.trim(), ""];
  if (raidUrl) {
    lines.push(`Url du RAID : ${raidUrl}`, "");
  }
  lines.push("Cordialement,", "Program Office", "TransfoHub");
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatHtml(body: string, raidUrl: string): string {
  const urlLine = raidUrl
    ? `<p>Url du RAID : <a href="${escapeHtml(raidUrl)}">${escapeHtml(raidUrl)}</a></p>`
    : "";
  return `<p>Bonjour,</p>
<p>${escapeHtml(body.trim()).replace(/\n/g, "<br/>")}</p>
${urlLine}
<p>Cordialement,<br/>Program Office<br/>TransfoHub</p>`;
}

export async function sendRaidEventMails(params: {
  userIds: string[];
  excludeUserId?: string | null;
  eventType: string;
  raidId: string;
  subject: string;
  body: string;
}): Promise<void> {
  try {
    const config = await getDefaultMailConfig();
    if (!config?.is_active || !config.app_mail_enabled) return;

    const exclude = params.excludeUserId ?? null;
    const userIds = [...new Set(params.userIds)].filter(
      (id) => id && id !== exclude
    );
    if (userIds.length === 0) return;

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        username: true,
        first_name: true,
        last_name: true,
        email: true,
        ressource: { select: { email: true, nom_complet: true } },
      },
    });

    const raidUrl = buildRaidUrl(config.app_url ?? "", params.raidId);
    const poEmail = isValidEmail(config.programme_office_email);
    const eventLabel = EVENT_LABEL[params.eventType] ?? params.eventType;

    await Promise.allSettled(
      users.map(async (user) => {
        try {
          const to = resolveUserEmail(user);
          if (to) {
            await sendMail({
              to,
              subject: params.subject,
              text: formatText(params.body, raidUrl),
              html: formatHtml(params.body, raidUrl),
            });
            return;
          }
          if (!poEmail) return;
          const name = displayName(user);
          const poBody = `Un mail de ${eventLabel} RAID devait être envoyé à ${name} (${user.username}), mais aucune adresse n'est renseignée sur la fiche.`;
          await sendMail({
            to: poEmail,
            subject: `Adresse manquante — ${params.subject}`,
            text: formatText(poBody, raidUrl),
            html: formatHtml(poBody, raidUrl),
          });
        } catch (err) {
          console.error("[raid-mail] envoi ignoré", user.username, err);
        }
      })
    );
  } catch (err) {
    console.error("[raid-mail] envoi silencieux ignoré:", err);
  }
}

/** Run SMTP after the HTTP response so RAID mutations stay fast. */
export function scheduleRaidEventMails(
  params: Parameters<typeof sendRaidEventMails>[0]
): void {
  const run = () => {
    void sendRaidEventMails(params);
  };
  try {
    after(run);
  } catch {
    run();
  }
}
