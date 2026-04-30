import { getAdherences, getChantiersForSelect, getNextAdherenceCode } from "@/app/(app)/actions";
import { AdherencesRegistre } from "@/components/adherences-registre";
import { Link2 } from "lucide-react";

export default async function AdherencesPage() {
  const [adherences, chantiers, nextCode] = await Promise.all([
    getAdherences(),
    getChantiersForSelect(),
    getNextAdherenceCode(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Link2 className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Adhérences Inter-Chantiers</h1>
            <p className="text-sm text-muted-foreground">
              Cartographie des dépendances entre chantiers du programme de transformation
            </p>
          </div>
        </div>

        <AdherencesRegistre
          adherences={adherences}
          chantiers={chantiers}
          nextCode={nextCode}
        />
      </main>
    </div>
  );
}
