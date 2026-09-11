import { requirePageAccess } from "@/lib/auth";
import { getAllJalons, getJalonStats } from "@/app/(app)/actions";
import { JalonsGlobalTimeline } from "@/components/jalons-global-timeline";

export default async function JalonsPage() {
  await requirePageAccess("/jalons");
  const [jalons, stats] = await Promise.all([
    getAllJalons(),
    getJalonStats(),
  ]);

  return <JalonsGlobalTimeline jalons={jalons} stats={stats} />;
}
