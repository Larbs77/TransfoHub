import { requireAuth } from "@/lib/auth";
import { NotificationsCentre } from "@/components/notifications-centre";

export default async function NotificationsPage() {
  await requireAuth();
  return <NotificationsCentre />;
}
