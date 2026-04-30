import { getAllProfilsRessource } from "@/app/(app)/actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ProfilRessourceList } from "@/components/profil-ressource-list";

export default async function ProfilsPage() {
  const profils = await getAllProfilsRessource();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Profils Ressource
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez les profils métier et les TJM par défaut pour chaque type de
            ressource (Interne, Externe, Consultant).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Catalogue des profils</CardTitle>
            <CardDescription>
              {profils.length} profil(s) — groupés par type de ressource
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfilRessourceList profils={profils} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
