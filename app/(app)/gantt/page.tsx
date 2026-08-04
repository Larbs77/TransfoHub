import { getPortfolioGanttData } from "@/app/(app)/actions";
import { PortfolioGanttView } from "@/components/portfolio-gantt-view";
import { requirePageAccess } from "@/lib/auth";

export default async function PortfolioGanttPage() {
  await requirePageAccess("/gantt");
  const chantiers = await getPortfolioGanttData();

  return <PortfolioGanttView chantiers={chantiers} nowMs={Date.now()} />;
}
