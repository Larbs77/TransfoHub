import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/nav-bar";
import { ChatWidget } from "@/components/chat-widget";
import { UserProvider } from "@/components/user-provider";
import type { Role } from "@/lib/permissions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.userId) {
    redirect("/login");
  }

  if (session.mustChangePwd) {
    redirect("/change-password");
  }

  return (
    <UserProvider
      user={{
        userId: session.userId,
        username: session.username,
        role: session.role as Role,
        ressourceId: session.ressourceId,
        dashboardType: session.dashboardType || "complete",
      }}
    >
      <NavBar>{children}</NavBar>
      {session.role === "Admin" && <ChatWidget />}
    </UserProvider>
  );
}
