import { notFound, redirect } from "next/navigation";
import { RaidPerformanceScreen } from "@/components/raid-performance-screen";
import {
  loadRaidPerformance,
  requireRaidPerformance,
} from "@/lib/raid-performance-load";

interface Props {
  params: Promise<{ chantierId: string }>;
  searchParams: Promise<{
    preset?: string | string[];
    from?: string | string[];
    to?: string | string[];
    origine?: string | string[];
  }>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RaidPerformanceTeamPage({
  params,
  searchParams,
}: Props) {
  await requireRaidPerformance();
  const [{ chantierId }, query] = await Promise.all([params, searchParams]);
  if (decodeURIComponent(chantierId) === "previsions") {
    redirect("/raid/performance/previsions");
  }
  const data = await loadRaidPerformance({
    now: new Date(),
    preset: one(query.preset),
    from: one(query.from),
    to: one(query.to),
    origine: one(query.origine),
    teamId: decodeURIComponent(chantierId),
  });
  if (!data?.detail) notFound();
  return (
    <RaidPerformanceScreen
      key={`${data.detail.team.id}-${data.window.search}-${data.medianOrigin}`}
      data={data}
    />
  );
}
