import { requireMaintenanceAuth } from "@/lib/auth";
import { getMaintenanceDbStats } from "./actions";
import { MaintenancePanel } from "./maintenance-panel";

export default async function MaintenanceDbPage() {
  await requireMaintenanceAuth();
  const stats = await getMaintenanceDbStats();

  return <MaintenancePanel initialStats={stats} />;
}
