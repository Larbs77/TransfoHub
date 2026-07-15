import { getRessources } from "@/app/(app)/actions";
import { getEquipesForSelect } from "@/app/(app)/admin/equipes/actions";
import { getActiveRolesForSelect } from "@/app/(app)/admin/roles/actions";
import { getSession } from "@/lib/auth";
import { RessourcesList } from "@/components/ressources-list";

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

  const equipes = [...equipesInstitutionnelles, ...equipesFonctionnelles];

  return (
    <RessourcesList
      ressources={ressources}
      equipes={equipes}
      activeRoles={activeRoles}
      canCreateAccount={canCreateAccount}
    />
  );
}
