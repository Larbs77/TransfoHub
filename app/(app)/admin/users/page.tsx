import { getUsers } from "./actions";
import { getRessourcesForSelect } from "@/app/(app)/actions";
import { getActiveRolesForSelect } from "@/app/(app)/admin/roles/actions";
import { UserManagement } from "./user-management";

export default async function AdminUsersPage() {
  const [users, ressources, activeRoles] = await Promise.all([
    getUsers(),
    getRessourcesForSelect(),
    getActiveRolesForSelect(),
  ]);

  return (
    <UserManagement
      initialUsers={users}
      ressources={ressources}
      activeRoles={activeRoles}
    />
  );
}
