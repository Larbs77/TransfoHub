import { requireRole, requirePageAccess } from "@/lib/auth";
import { getRaidFieldOptions } from "@/app/(app)/actions";
import { getEquipesForAdmin } from "./actions";
import { EquipeManagement } from "./equipe-management";

export default async function EquipesAdminPage() {
  await requireRole("Admin");
  await requirePageAccess("/admin/equipes");

  const [rows, fieldOptions] = await Promise.all([
    getEquipesForAdmin(),
    getRaidFieldOptions("categorie").catch(() => []),
  ]);

  const categorieOptions = fieldOptions.map((o) => ({
    id: o.id,
    label: o.label,
    color: o.color,
  }));

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
        <EquipeManagement
          initialRows={rows}
          categorieOptions={categorieOptions}
        />
      </main>
    </div>
  );
}
