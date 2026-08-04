import { requireRole, requirePageAccess } from "@/lib/auth";
import { Database } from "lucide-react";
import { getChantierCountForImport, getDataTableCounts } from "./actions";
import { DataAdminPanel } from "./data-admin-panel";

export default async function DonneesAdminPage() {
  await requireRole("Admin");
  await requirePageAccess("/admin/donnees");

  const [counts, chantierCount] = await Promise.all([
    getDataTableCounts(),
    getChantierCountForImport(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Database className="size-5 text-[#00BDBB]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
              Technique
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              Import / Purge
            </h1>
          </div>
        </div>

        <DataAdminPanel
          initialCounts={counts}
          chantierCount={chantierCount}
        />
      </main>
    </div>
  );
}
