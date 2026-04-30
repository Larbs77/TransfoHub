import { getAllJalons, getJalonStats } from "@/app/(app)/actions";
import { JalonsGlobalTimeline } from "@/components/jalons-global-timeline";
import { Milestone } from "lucide-react";

export default async function JalonsPage() {
  const [jalons, stats] = await Promise.all([
    getAllJalons(),
    getJalonStats(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Milestone className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Jalons & Milestones
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Vue globale des jalons de tous les chantiers du programme
          </p>
        </div>

        <JalonsGlobalTimeline jalons={jalons} stats={stats} />
      </main>
    </div>
  );
}
