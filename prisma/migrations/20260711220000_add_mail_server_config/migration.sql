-- CreateTable
CREATE TABLE "MailServerConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Serveur principal',
    "host" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 587,
    "security" TEXT NOT NULL DEFAULT 'starttls',
    "auth_user" TEXT NOT NULL DEFAULT '',
    "auth_password_enc" TEXT NOT NULL DEFAULT '',
    "from_email" TEXT NOT NULL DEFAULT '',
    "from_name" TEXT NOT NULL DEFAULT '',
    "reply_to" TEXT NOT NULL DEFAULT '',
    "tls_reject_unauthorized" BOOLEAN NOT NULL DEFAULT true,
    "connection_timeout_ms" INTEGER NOT NULL DEFAULT 10000,
    "greeting_timeout_ms" INTEGER NOT NULL DEFAULT 10000,
    "socket_timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "pool" BOOLEAN NOT NULL DEFAULT false,
    "max_connections" INTEGER NOT NULL DEFAULT 5,
    "local_hostname" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "last_test_at" TIMESTAMP(3),
    "last_test_ok" BOOLEAN,
    "last_test_message" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailServerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailServerConfig_is_default_is_active_idx" ON "MailServerConfig"("is_default", "is_active");
