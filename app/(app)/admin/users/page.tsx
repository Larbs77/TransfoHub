import { getUsers, getRessourcesWithoutAccount } from "./actions";
import { getEquipesForSelect } from "@/app/(app)/admin/equipes/actions";
import { getActiveRolesForSelect } from "@/app/(app)/admin/roles/actions";
import { UserManagement } from "./user-management";

export default async function AdminUsersPage() {
  const [users, ressourcesDisponibles, equipes, activeRoles] =
    await Promise.all([
      getUsers(),
      getRessourcesWithoutAccount(),
      getEquipesForSelect({ activeOnly: false }).catch(() => []),
      getActiveRolesForSelect(),
    ]);

  return (
    <UserManagement
      initialUsers={users}
      ressourcesDisponibles={ressourcesDisponibles}
      equipes={equipes}
      activeRoles={activeRoles}
    />
  );
}
