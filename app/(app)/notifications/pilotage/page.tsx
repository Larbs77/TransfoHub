import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getAttentionPilotage } from "@/lib/notifications";
import { NotificationPilotage } from "@/components/notification-pilotage";

export default async function NotificationPilotagePage() {
  const session = await requireAuth();
  // Strict role check: requireRole("Admin","Programme_Office") also
  // maps to /dashboards and would let any dashboard-capable role in.
  if (session.role !== "Admin" && session.role !== "Programme_Office") {
    redirect("/notifications");
  }
  const data = await getAttentionPilotage({ chantierIds: "all" });
  return <NotificationPilotage data={data} />;
}
