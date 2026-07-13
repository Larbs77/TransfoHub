import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavBar } from "@/components/nav-bar";
import { ChatWidget } from "@/components/chat-widget";
import { UserProvider } from "@/components/user-provider";
import { UserThemeSync } from "@/components/user-theme-sync";
import {
  getRoleByCode,
  resolveAllowedPages,
  resolveRaidCreateScope,
} from "@/lib/roles";
import {
  LEGACY_ROLE_COLORS,
  LEGACY_ROLE_LABELS,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { Theme } from "@/components/theme-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session.userId) {
    redirect("/login");
  }

  // File-based maintenance user → critical console only
  if (session.isMaintenance) {
    redirect("/maintenance/db");
  }

  if (session.mustChangePwd) {
    redirect("/change-password");
  }

  const [role, dbUser] = await Promise.all([
    getRoleByCode(session.role),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        first_name: true,
        last_name: true,
        username: true,
        avatar_url: true,
        theme_preference: true,
        updatedAt: true,
      },
    }),
  ]);

  const allowedPages = resolveAllowedPages(role);
  const roleLabel =
    role?.label ?? LEGACY_ROLE_LABELS[session.role] ?? session.role;
  const roleColor =
    role?.color ?? LEGACY_ROLE_COLORS[session.role] ?? "#6b7280";

  const canUseApp = !!role?.is_active;
  const fullName = `${dbUser?.first_name ?? ""} ${dbUser?.last_name ?? ""}`.trim();
  const displayName = fullName || dbUser?.username || session.username;
  const themePreference: Theme =
    dbUser?.theme_preference === "dark" ? "dark" : "light";

  return (
    <UserProvider
      user={{
        userId: session.userId,
        username: session.username,
        displayName,
        avatarUrl: dbUser?.avatar_url ?? "",
        avatarVersion: dbUser?.updatedAt
          ? new Date(dbUser.updatedAt).getTime()
          : 0,
        role: session.role,
        roleLabel,
        roleColor,
        allowedPages: canUseApp ? allowedPages : [],
        ressourceId: session.ressourceId,
        dashboardType: session.dashboardType || "complete",
        raidCreateScope: canUseApp ? resolveRaidCreateScope(role) : "none",
      }}
    >
      <UserThemeSync preference={themePreference} />
      <NavBar>{children}</NavBar>
      {session.role === "Admin" && <ChatWidget />}
    </UserProvider>
  );
}
