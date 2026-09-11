import { requireAuth } from "@/lib/auth";
import {
  getPersonalDashboard,
  getPersonalCapacite,
  getStatusConfigs,
  getRaidFieldOptions,
  getChantiersForSelect,
  getComitesForSelect,
} from "@/app/(app)/actions";
import { MonTableauDeBordClient } from "@/components/mon-tableau-de-bord-client";

export default async function MonTableauDeBordPage() {
  // Available to any authenticated user (personal view).
  // Still listed in APP_PAGES so roles can surface it in the nav.
  await requireAuth();
  const currentYear = new Date().getFullYear();
  // Year scroll on Capacité page starts at 2026
  const capaciteYear = Math.max(2026, Math.min(2030, currentYear));

  const [data, statusConfigs, capacite, fieldOptions, chantiers, comites] = await Promise.all([
    getPersonalDashboard(),
    getStatusConfigs().catch(() => []),
    getPersonalCapacite(capaciteYear).catch(() => null),
    getRaidFieldOptions().catch(() => []),
    getChantiersForSelect().catch(() => []),
    getComitesForSelect().catch(() => []),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <MonTableauDeBordClient
          data={data}
          statusConfigs={statusConfigs}
          fieldOptions={fieldOptions}
          chantiers={chantiers}
          comites={comites}
          capacite={capacite}
          capaciteYear={capaciteYear}
        />
      </main>
    </div>
  );
}
