import { getRessources } from "@/app/(app)/actions";
import { getEquipesForSelect } from "@/app/(app)/admin/equipes/actions";
import { getActiveRolesForSelect } from "@/app/(app)/admin/roles/actions";
import { getSession } from "@/lib/auth";
import { RessourcesList } from "@/components/ressources-list";
import { AddRessourceButton } from "@/components/add-ressource-button";

export default async function RessourcesPage() {
  const session = await getSession();
  const canCreateAccount = session.role === "Admin";

  const [ressources, equipesInstitutionnelles, equipesFonctionnelles, activeRoles] =
    await Promise.all([
      getRessources(),
      getEquipesForSelect({
        activeOnly: false,
        type: "institutionnelle",
      }).catch(() => []),
      getEquipesForSelect({
        activeOnly: false,
        type: "fonctionnelle",
      }).catch(() => []),
      canCreateAccount
        ? getActiveRolesForSelect().catch(() => [])
        : Promise.resolve([]),
    ]);

  // Hierarchy select = institutionnelle; functional multi-select = chantier teams
  const equipes = [...equipesInstitutionnelles, ...equipesFonctionnelles];

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
