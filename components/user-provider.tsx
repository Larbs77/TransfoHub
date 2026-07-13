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
  /** programme | chantier | none — create RAID permission from role */
  raidCreateScope: "none" | "chantier" | "programme";
  /** Chantier data scope from AppRole: all | assigned | none */
  chantierScope: "all" | "assigned" | "none";
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

/** Whether the current role may create new RAID entries. */
export function useCanCreateRaid() {
  const { raidCreateScope } = useUser();
  return raidCreateScope === "programme" || raidCreateScope === "chantier";
}

/** Create chantier: only roles with périmètre données chantiers = tous les chantiers. */
export function useCanCreateChantier() {
  const { role, chantierScope } = useUser();
  return role === "Admin" || chantierScope === "all";
}
