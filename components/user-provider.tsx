"use client";

import { createContext, useContext } from "react";
import type { DashboardType } from "@/lib/auth";

interface UserContextType {
  userId: string;
  username: string;
  /** first_name + last_name, or username fallback */
  displayName: string;
  /** Public avatar path or empty for letter fallback */
  avatarUrl: string;
  /** Cache-bust token for avatar image */
  avatarVersion: string | number;
  role: string;
  roleLabel: string;
  roleColor: string;
  allowedPages: string[];
  ressourceId: string | null;
  dashboardType: DashboardType;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: UserContextType;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

export function useHasRole(...roles: string[]) {
  const { role } = useUser();
  return roles.includes(role);
}

export function useCanAccessPage(path: string) {
  const { allowedPages, role } = useUser();
  if (role === "Admin") return true;
  if (allowedPages.includes(path)) return true;
  return allowedPages.some(
    (p) => p !== "/" && (path === p || path.startsWith(p + "/"))
  );
}
