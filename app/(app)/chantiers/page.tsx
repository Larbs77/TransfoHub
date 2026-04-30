import { getChantiers, getFavoris } from "@/app/(app)/actions";
import { ChantiersList } from "@/components/chantiers-list";
import { AddChantierButton } from "@/components/add-chantier-button";

export default async function ChantiersPage() {
  const [chantiers, favoris] = await Promise.all([getChantiers(), getFavoris()]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Chantiers</h1>
            <p className="text-sm text-muted-foreground">
              {chantiers.length} chantier(s) de transformation
            </p>
          </div>
          <AddChantierButton />
        </div>
        <ChantiersList chantiers={chantiers} favoris={favoris} />
      </main>
    </div>
  );
}
