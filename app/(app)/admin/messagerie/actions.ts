"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePageAccess, requireRole } from "@/lib/auth";
import { encryptSecret } from "@/lib/mail-crypto";
import {
  getDefaultMailConfig,
  listMailConfigs,
  sendTestMail,
  toPublicConfig,
  type MailConfigPublic,
  type MailSecurity,
} from "@/lib/mail";

async function requireMailAdmin() {
  await requireRole("Admin");
  await requirePageAccess("/admin/messagerie");
}

export type MailServerFormInput = {
  id?: string;
  name: string;
  host: string;
  port: number;
  security: MailSecurity;
  auth_user: string;
  /** Leave empty to keep existing password */
  auth_password?: string;
  clear_password?: boolean;
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
};

function validateInput(data: MailServerFormInput): string | null {
  if (!data.host?.trim()) return "L'hôte SMTP est requis.";
  if (!data.port || data.port < 1 || data.port > 65535) {
    return "Port SMTP invalide (1–65535).";
  }
  if (!["none", "starttls", "ssl"].includes(data.security)) {
    return "Mode de sécurité invalide.";
  }
  if (!data.from_email?.trim()) {
    return "L'adresse d'expéditeur (From) est requise.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.from_email.trim())) {
    return "Adresse d'expéditeur invalide.";
  }
  if (
    data.reply_to?.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.reply_to.trim())
  ) {
    return "Adresse Reply-To invalide.";
  }
  if (data.connection_timeout_ms < 1000 || data.connection_timeout_ms > 120000) {
    return "Délai de connexion hors plage (1000–120000 ms).";
  }
  return null;
}

export async function getMailServerConfigForAdmin(): Promise<MailConfigPublic | null> {
  await requireMailAdmin();
  const row = await getDefaultMailConfig();
  if (row) return toPublicConfig(row);

  const any = await prisma.mailServerConfig.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  return any ? toPublicConfig(any) : null;
}

export async function listMailServerConfigsForAdmin(): Promise<
  MailConfigPublic[]
> {
  await requireMailAdmin();
  const rows = await listMailConfigs();
  return rows.map(toPublicConfig);
}

export async function saveMailServerConfig(
  data: MailServerFormInput
): Promise<MailConfigPublic> {
  await requireMailAdmin();
  const error = validateInput(data);
  if (error) throw new Error(error);

  const existing = data.id
    ? await prisma.mailServerConfig.findUnique({ where: { id: data.id } })
    : await getDefaultMailConfig();

  let auth_password_enc = existing?.auth_password_enc ?? "";
  if (data.clear_password) {
    auth_password_enc = "";
  } else if (data.auth_password && data.auth_password.length > 0) {
    auth_password_enc = encryptSecret(data.auth_password);
  }

  if (data.is_default) {
    await prisma.mailServerConfig.updateMany({
      where: existing ? { id: { not: existing.id } } : undefined,
      data: { is_default: false },
    });
  }

  const payload = {
    name: data.name.trim() || "Serveur principal",
    host: data.host.trim(),
    port: data.port,
    security: data.security,
    auth_user: data.auth_user.trim(),
    auth_password_enc,
    from_email: data.from_email.trim(),
    from_name: data.from_name.trim(),
    reply_to: data.reply_to.trim(),
    tls_reject_unauthorized: data.tls_reject_unauthorized,
    connection_timeout_ms: data.connection_timeout_ms,
    greeting_timeout_ms: data.greeting_timeout_ms,
    socket_timeout_ms: data.socket_timeout_ms,
    pool: data.pool,
    max_connections: Math.max(1, Math.min(50, data.max_connections || 5)),
    local_hostname: data.local_hostname.trim(),
    notes: data.notes.trim(),
    is_active: data.is_active,
    is_default: data.is_default,
  };

  const saved = existing
    ? await prisma.mailServerConfig.update({
        where: { id: existing.id },
        data: payload,
      })
    : await prisma.mailServerConfig.create({
        data: payload,
      });

  revalidatePath("/admin/messagerie");
  return toPublicConfig(saved);
}

export async function testMailServerConfig(params: {
  configId?: string;
  to: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  await requireMailAdmin();

  const config =
    (params.configId
      ? await prisma.mailServerConfig.findUnique({
          where: { id: params.configId },
        })
      : null) ?? (await getDefaultMailConfig());

  if (!config) {
    return {
      ok: false,
      error: "Enregistrez d'abord la configuration SMTP.",
    };
  }

  const result = await sendTestMail({
    configId: config.id,
    to: params.to,
  });

  if (result.ok) {
    await prisma.mailServerConfig.update({
      where: { id: config.id },
      data: {
        last_test_at: new Date(),
        last_test_ok: true,
        last_test_message: `OK · messageId ${result.messageId || "—"}`,
      },
    });
    revalidatePath("/admin/messagerie");
    return {
      ok: true,
      message: `E-mail de test envoyé à ${params.to.trim()}.`,
    };
  }

  await prisma.mailServerConfig.update({
    where: { id: config.id },
    data: {
      last_test_at: new Date(),
      last_test_ok: false,
      last_test_message: result.error.slice(0, 500),
    },
  });
  revalidatePath("/admin/messagerie");
  return { ok: false, error: result.error };
}
