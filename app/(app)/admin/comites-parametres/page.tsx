import { requireRole, requirePageAccess } from "@/lib/auth";
import { getComiteParametresForAdmin } from "./actions";
import { ComiteParametreManagement } from "./comite-parametre-management";

export default async function ComitesParametresAdminPage() {
  await requireRole("Admin");
  await requirePageAccess("/admin/comites-parametres");

  const rows = await getComiteParametresForAdmin();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <ComiteParametreManagement initialRows={rows} />
      </main>
    </div>
  );
}
