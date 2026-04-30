"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/permissions";
import type { DashboardType } from "@/lib/auth";

interface UserContextType {
  userId: string;
  username: string;
  role: Role;
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

export function useHasRole(...roles: Role[]) {
  const { role } = useUser();
  return roles.includes(role);
}
