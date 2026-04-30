import { getChantiersFavoris, getFavoris } from "@/app/(app)/actions";
import { ChantiersList } from "@/components/chantiers-list";
import { Star } from "lucide-react";

export default async function FavorisPage() {
  const [chantiers, favoris] = await Promise.all([
    getChantiersFavoris(),
    getFavoris(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Star className="size-6 fill-amber-400 text-amber-400" />
            Favoris
          </h1>
          <p className="text-sm text-muted-foreground">
            {chantiers.length} chantier(s) favori(s)
          </p>
        </div>
        {chantiers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Star className="size-12 mb-4" />
            <p className="text-lg font-medium">Aucun favori</p>
            <p className="text-sm">
              Cliquez sur l&apos;étoile d&apos;un chantier pour l&apos;ajouter aux favoris.
            </p>
          </div>
        ) : (
          <ChantiersList chantiers={chantiers} favoris={favoris} />
        )}
      </main>
    </div>
  );
}
