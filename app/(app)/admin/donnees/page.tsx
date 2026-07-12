import { requireRole, requirePageAccess } from "@/lib/auth";
import { Database } from "lucide-react";
import { getDataTableCounts } from "./actions";
import { DataAdminPanel } from "./data-admin-panel";

export default async function DonneesAdminPage() {
  await requireRole("Admin");
  await requirePageAccess("/admin/donnees");

  const counts = await getDataTableCounts();

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
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Exportez, purgez ou chargez des données métier depuis des fichiers
              CSV (séparateur{" "}
              <code className="rounded bg-muted px-1 text-xs">|</code>, pipe —
              les virgules restent autorisées dans le texte). Après lecture, un
              rapport de validation s&apos;affiche ; l&apos;import n&apos;est
              effectué qu&apos;après votre approbation. Réservé aux
              administrateurs.
            </p>
          </div>
        </div>

        <DataAdminPanel initialCounts={counts} />
      </main>
    </div>
  );
}
