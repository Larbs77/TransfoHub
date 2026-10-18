import { RaidForecastScreen } from "@/components/raid-forecast-screen";
import { loadRaidForecast } from "@/lib/raid-forecast-load";
import { requireRaidPerformance } from "@/lib/raid-performance-load";

interface Props {
  searchParams: Promise<{
    horizon?: string | string[];
    equipe?: string | string[];
  }>;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RaidForecastPage({ searchParams }: Props) {
  await requireRaidPerformance();
  const params = await searchParams;
  const data = await loadRaidForecast({
    now: new Date(),
    horizonRaw: one(params.horizon),
    teamId: one(params.equipe),
  });
  return <RaidForecastScreen data={data} />;
}
