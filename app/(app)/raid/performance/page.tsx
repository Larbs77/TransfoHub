import { RaidPerformanceScreen } from "@/components/raid-performance-screen";
import {
  loadRaidPerformance,
  requireRaidPerformance,
} from "@/lib/raid-performance-load";

interface Props {
  searchParams: Promise<{
    preset?: string | string[];
    from?: string | string[];
    to?: string | string[];
    origine?: string | string[];
    cycle?: string | string[];
  }>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RaidPerformancePage({ searchParams }: Props) {
  await requireRaidPerformance();
  const params = await searchParams;
  const data = await loadRaidPerformance({
    now: new Date(),
    preset: one(params.preset),
    from: one(params.from),
    to: one(params.to),
    origine: one(params.origine),
    cycle: one(params.cycle),
  });
  if (!data) return null;
  return (
    <RaidPerformanceScreen
      key={`${data.window.search}-${data.medianOrigin}-${data.cycleStart}`}
      data={data}
    />
  );
}
