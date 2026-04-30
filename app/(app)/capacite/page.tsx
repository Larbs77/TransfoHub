import { getCapaciteGlobale } from "@/app/(app)/actions";
import { CapaciteHeatmap } from "@/components/capacite-heatmap";

export default async function CapacitePage() {
  const currentYear = new Date().getFullYear();
  const data = await getCapaciteGlobale(currentYear);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Capacité & Charge
          </h1>
          <p className="text-sm text-muted-foreground">
            Vue heatmap de la charge des ressources par mois — Vert (&lt;80%) /
            Orange (80-100%) / Rouge (&gt;100%)
          </p>
        </div>
        <CapaciteHeatmap initialData={data} initialYear={currentYear} />
      </main>
    </div>
  );
}
