import { getUsers } from "./actions";
import { getRessourcesForSelect } from "@/app/(app)/actions";
import { UserManagement } from "./user-management";

export default async function AdminUsersPage() {
  const [users, ressources] = await Promise.all([
    getUsers(),
    getRessourcesForSelect(),
  ]);

  return <UserManagement initialUsers={users} ressources={ressources} />;
}
