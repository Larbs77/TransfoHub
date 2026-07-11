import { getRolesForAdmin } from "./actions";
import { RoleManagement } from "./role-management";
import { APP_PAGES } from "@/lib/app-pages";

export default async function AdminRolesPage() {
  const roles = await getRolesForAdmin();
  return <RoleManagement initialRoles={roles} appPages={APP_PAGES} />;
}
