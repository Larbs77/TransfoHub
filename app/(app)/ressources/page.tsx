import { getRessources } from "@/app/(app)/actions";
import { getEquipesForSelect } from "@/app/(app)/admin/equipes/actions";
import { getActiveRolesForSelect } from "@/app/(app)/admin/roles/actions";
import { getSession } from "@/lib/auth";
import { RessourcesList } from "@/components/ressources-list";
import { AddRessourceButton } from "@/components/add-ressource-button";

export default async function RessourcesPage() {
  const session = await getSession();
  const canCreateAccount = session.role === "Admin";

  const [ressources, equipes, activeRoles] = await Promise.all([
    getRessources(),
    getEquipesForSelect({ activeOnly: false }).catch(() => []),
    canCreateAccount
      ? getActiveRolesForSelect().catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ressources</h1>
            <p className="text-sm text-muted-foreground">
              {ressources.length} ressource(s) dans le programme — personnes
              du programme (avec ou sans compte applicatif)
            </p>
          </div>
          <AddRessourceButton
            equipes={equipes}
            activeRoles={activeRoles}
            canCreateAccount={canCreateAccount}
          />
        </div>
        <RessourcesList
          ressources={ressources}
          equipes={equipes}
          activeRoles={activeRoles}
          canCreateAccount={canCreateAccount}
        />
      </main>
    </div>
  );
}
