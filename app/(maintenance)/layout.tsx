import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LogOut, Database } from "lucide-react";

export default async function MaintenanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.userId || !session.isMaintenance) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Critical banner */}
      <div className="border-b border-red-600/40 bg-red-600 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-6 shrink-0 animate-pulse" />
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.12em]">
                Zone critique — Maintenance base de données
              </p>
              <p className="mt-0.5 text-xs text-white/90">
                Compte système <strong>{session.username}</strong> (non stocké en
                base). Toute action d&apos;import peut détruire des données de
                façon irréversible.
              </p>
            </div>
          </div>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="gap-2 bg-white text-red-700 hover:bg-white/90"
            >
              <LogOut className="size-3.5" />
              Déconnexion
            </Button>
          </form>
        </div>
      </div>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 md:px-6">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Database className="size-5 text-[#00BDBB]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
              Technique · Système
            </p>
            <h1 className="text-lg font-bold tracking-tight text-primary">
              TransfoHub — Maintenance DB
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
