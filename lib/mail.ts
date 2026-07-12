/**
 * Outbound mail helpers for TransfoHub.
 * Uses MailServerConfig (DB) so each bank/client can point at its own SMTP.
 *
 * Future features should call `sendMail({ to, subject, text, html })` only —
 * do not create ad-hoc transporters.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/mail-crypto";

export type MailSecurity = "none" | "starttls" | "ssl";

export type MailSendOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  /** Override default config id */
  configId?: string;
};

export type MailConfigPublic = {
  id: string;
  name: string;
  host: string;
  port: number;
  security: MailSecurity;
  auth_user: string;
  has_password: boolean;
  from_email: string;
  from_name: string;
  reply_to: string;
  tls_reject_unauthorized: boolean;
  connection_timeout_ms: number;
  greeting_timeout_ms: number;
  socket_timeout_ms: number;
  pool: boolean;
  max_connections: number;
  local_hostname: string;
  notes: string;
  is_active: boolean;
  is_default: boolean;
  last_test_at: Date | null;
  last_test_ok: boolean | null;
  last_test_message: string;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeSecurity(value: string): MailSecurity {
  if (value === "none" || value === "ssl" || value === "starttls") return value;
  return "starttls";
}

export function toPublicConfig(row: {
  id: string;
  name: string;
  host: string;
  port: number;
  security: string;
  auth_user: string;
  auth_password_enc: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  tls_reject_unauthorized: boolean;
  connection_timeout_ms: number;
  greeting_timeout_ms: number;
  socket_timeout_ms: number;
  pool: boolean;
  max_connections: number;
  local_hostname: string;
  notes: string;
  is_active: boolean;
  is_default: boolean;
  last_test_at: Date | null;
  last_test_ok: boolean | null;
  last_test_message: string;
  createdAt: Date;
  updatedAt: Date;
}): MailConfigPublic {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    security: normalizeSecurity(row.security),
    auth_user: row.auth_user,
    has_password: Boolean(row.auth_password_enc),
    from_email: row.from_email,
    from_name: row.from_name,
    reply_to: row.reply_to,
    tls_reject_unauthorized: row.tls_reject_unauthorized,
    connection_timeout_ms: row.connection_timeout_ms,
    greeting_timeout_ms: row.greeting_timeout_ms,
    socket_timeout_ms: row.socket_timeout_ms,
    pool: row.pool,
    max_connections: row.max_connections,
    local_hostname: row.local_hostname,
    notes: row.notes,
    is_active: row.is_active,
    is_default: row.is_default,
    last_test_at: row.last_test_at,
    last_test_ok: row.last_test_ok,
    last_test_message: row.last_test_message,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getDefaultMailConfig() {
  const preferred = await prisma.mailServerConfig.findFirst({
    where: { is_default: true, is_active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (preferred) return preferred;

  return prisma.mailServerConfig.findFirst({
    where: { is_active: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getMailConfigById(id: string) {
  return prisma.mailServerConfig.findUnique({ where: { id } });
}

export async function listMailConfigs() {
  return prisma.mailServerConfig.findMany({
    orderBy: [{ is_default: "desc" }, { name: "asc" }],
  });
}

type TransportSource = {
  host: string;
  port: number;
  security: string;
  auth_user: string;
  auth_password_enc: string;
  tls_reject_unauthorized: boolean;
  connection_timeout_ms: number;
  greeting_timeout_ms: number;
  socket_timeout_ms: number;
  pool: boolean;
  max_connections: number;
  local_hostname: string;
};

function buildTransport(config: TransportSource): Transporter {
  if (!config.host?.trim()) {
    throw new Error("Hôte SMTP non configuré.");
  }

  const security = normalizeSecurity(config.security);
  const secure = security === "ssl";
  const requireTLS = security === "starttls";

  const password = config.auth_password_enc
    ? decryptSecret(config.auth_password_enc)
    : "";

  const auth =
    config.auth_user.trim() || password
      ? {
          user: config.auth_user.trim(),
          pass: password,
        }
      : undefined;

  const localName = config.local_hostname.trim();

  return nodemailer.createTransport({
    host: config.host.trim(),
    port: config.port,
    secure,
    ...(requireTLS ? { requireTLS: true } : {}),
    ...(auth ? { auth } : {}),
    ...(config.pool
      ? { pool: true, maxConnections: config.max_connections }
      : {}),
    ...(localName ? { name: localName } : {}),
    connectionTimeout: config.connection_timeout_ms,
    greetingTimeout: config.greeting_timeout_ms,
    socketTimeout: config.socket_timeout_ms,
    tls: {
      rejectUnauthorized: config.tls_reject_unauthorized,
    },
  });
}

/**
 * Send an email using the default (or specified) active SMTP config.
 * Use this from future features (alerts, invitations, password reset, etc.).
 */
export async function sendMail(
  options: MailSendOptions
): Promise<{ messageId: string }> {
  const config = options.configId
    ? await getMailConfigById(options.configId)
    : await getDefaultMailConfig();

  if (!config) {
    throw new Error(
      "Aucun serveur de messagerie configuré. Configurez-le dans Technique → Serveur De Messagerie."
    );
  }
  if (!config.is_active) {
    throw new Error("Le serveur de messagerie sélectionné est désactivé.");
  }
  if (!config.from_email?.trim()) {
    throw new Error("Adresse d'expéditeur (From) non configurée.");
  }

  const transporter = buildTransport(config);
  try {
    const from =
      config.from_name.trim()
        ? `"${config.from_name.trim()}" <${config.from_email.trim()}>`
        : config.from_email.trim();

    const info = await transporter.sendMail({
      from,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo || config.reply_to || undefined,
    });

    return { messageId: info.messageId || "" };
  } finally {
    transporter.close();
  }
}

/**
 * Verify SMTP connectivity and optionally send a test message.
 */
export async function sendTestMail(params: {
  configId?: string;
  to: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const to = params.to.trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: "Adresse e-mail de test invalide." };
  }

  try {
    const result = await sendMail({
      configId: params.configId,
      to,
      subject: "[TransfoHub] E-mail de test — Serveur de messagerie",
      text: [
        "Ceci est un e-mail de test envoyé depuis TransfoHub.",
        "",
        "Si vous recevez ce message, la configuration SMTP est opérationnelle.",
        `Date: ${new Date().toISOString()}`,
      ].join("\n"),
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#0A3C74;line-height:1.5">
          <h2 style="margin:0 0 8px;color:#0A3C74">TransfoHub — E-mail de test</h2>
          <p>Ceci est un e-mail de test envoyé depuis <strong>TransfoHub</strong>.</p>
          <p>Si vous recevez ce message, la configuration SMTP est opérationnelle.</p>
          <p style="color:#4d6780;font-size:12px">Date: ${new Date().toLocaleString("fr-FR")}</p>
          <hr style="border:none;border-top:1px solid #e6f9f8;margin:16px 0" />
          <p style="font-size:12px;color:#00BDBB">Bank of Africa · Transformation bancaire</p>
        </div>
      `,
    });
    return { ok: true, messageId: result.messageId };
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Échec de l'envoi de l'e-mail de test.";
    return { ok: false, error: message };
  }
}

/** Lightweight connection verify without sending a message (optional). */
export async function verifyMailTransport(configId?: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const config = configId
      ? await getMailConfigById(configId)
      : await getDefaultMailConfig();
    if (!config) {
      return { ok: false, error: "Aucune configuration SMTP." };
    }
    const transporter = buildTransport(config);
    try {
      await transporter.verify();
      return { ok: true };
    } finally {
      transporter.close();
    }
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Vérification SMTP échouée.",
    };
  }
}
