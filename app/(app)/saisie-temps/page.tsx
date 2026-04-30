import { getRessourcesForSelect } from "@/app/(app)/actions";
import { SaisieTempsGrid } from "@/components/saisie-temps-grid";

export default async function SaisieTempsPage() {
  const ressources = await getRessourcesForSelect();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Saisie des temps
          </h1>
          <p className="text-sm text-muted-foreground">
            Enregistrez les jours travaillés par semaine et par chantier
          </p>
        </div>
        <SaisieTempsGrid ressources={ressources} />
      </main>
    </div>
  );
}
