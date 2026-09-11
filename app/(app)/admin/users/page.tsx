import {
  getUsers,
  getRessourcesWithoutAccount,
  getChantiersForConsultationGrant,
} from "./actions";
import { getEquipesForSelect } from "@/app/(app)/admin/equipes/actions";
import { getActiveRolesForSelect } from "@/app/(app)/admin/roles/actions";
import { UserManagement } from "./user-management";

export default async function AdminUsersPage() {
  const [users, ressourcesDisponibles, equipes, activeRoles, chantiers] =
    await Promise.all([
      getUsers(),
      getRessourcesWithoutAccount(),
      getEquipesForSelect({ activeOnly: false }).catch(() => []),
      getActiveRolesForSelect(),
      getChantiersForConsultationGrant().catch(() => []),
    ]);

  return (
    <UserManagement
      initialUsers={users}
      ressourcesDisponibles={ressourcesDisponibles}
      equipes={equipes}
      activeRoles={activeRoles}
      chantiers={chantiers}
    />
  );
}
