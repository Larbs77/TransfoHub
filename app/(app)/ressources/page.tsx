import { getRessources } from "@/app/(app)/actions";
import { RessourcesList } from "@/components/ressources-list";
import { AddRessourceButton } from "@/components/add-ressource-button";

export default async function RessourcesPage() {
  const ressources = await getRessources();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ressources</h1>
            <p className="text-sm text-muted-foreground">
              {ressources.length} ressource(s) dans le programme
            </p>
          </div>
          <AddRessourceButton />
        </div>
        <RessourcesList ressources={ressources} />
      </main>
    </div>
  );
}
