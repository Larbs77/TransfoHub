-- AlterTable
ALTER TABLE "MailServerConfig" ADD COLUMN IF NOT EXISTS "app_url" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MailServerConfig" ADD COLUMN IF NOT EXISTS "programme_office_email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MailServerConfig" ADD COLUMN IF NOT EXISTS "app_mail_enabled" BOOLEAN NOT NULL DEFAULT false;
