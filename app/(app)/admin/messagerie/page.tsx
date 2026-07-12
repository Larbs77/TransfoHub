import { requireRole, requirePageAccess } from "@/lib/auth";
import { Mail } from "lucide-react";
import { getMailServerConfigForAdmin } from "./actions";
import { MailServerForm } from "./mail-server-form";

export default async function MessagerieAdminPage() {
  // Administrators only
  await requireRole("Admin");
  await requirePageAccess("/admin/messagerie");

  const config = await getMailServerConfigForAdmin();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Mail className="size-5 text-[#00BDBB]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
              Technique
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              Serveur De Messagerie
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configurez le serveur SMTP utilisé par TransfoHub pour les envois
              d&apos;e-mails (alertes, notifications, invitations…). Chaque
              déploiement client peut utiliser son propre serveur.
            </p>
          </div>
        </div>

        <MailServerForm initialConfig={config} />
      </main>
    </div>
  );
}
