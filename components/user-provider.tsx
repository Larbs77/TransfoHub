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
  /** Paths the role may mutate. Unenforced screens stay writable if accessible. */
  allowedWritePages: string[];
  ressourceId: string | null;
  dashboardType: DashboardType;
  /** programme | chantier | none — create RAID permission from role */
  raidCreateScope: "none" | "chantier" | "programme";
  /** Chantier data scope from AppRole: all | assigned | none */
  chantierScope: "all" | "assigned" | "none";
  /** Extra chantiers in consultation only (not a team member). Empty if scope all. */
  consultationChantierIds: string[];
  /** Chantiers where the user is équipe member (write). Empty if scope all. */
  memberChantierIds: string[];
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

export function useCanWritePage(path: string) {
  const { allowedWritePages, role } = useUser();
  const canAccess = useCanAccessPage(path);
  if (role === "Admin") return true;
  if (!canAccess) return false;
  if (allowedWritePages.includes(path)) return true;
  return allowedWritePages.some(
    (p) => p !== "/" && (path === p || path.startsWith(p + "/"))
  );
}

/** Whether the current role may create new RAID entries. */
export function useCanCreateRaid() {
  const { raidCreateScope } = useUser();
  const canWrite = useCanWritePage("/raid");
  return (
    canWrite &&
    (raidCreateScope === "programme" || raidCreateScope === "chantier")
  );
}

/** Create chantier: périmètre « tous les chantiers » AND page écriture. */
export function useCanCreateChantier() {
  const { role, chantierScope } = useUser();
  const canWrite = useCanWritePage("/chantiers");
  return canWrite && (role === "Admin" || chantierScope === "all");
}

/** RAID lecture : agir seulement si on est le responsable. */
export function useIsConsultationChantier(
  chantierId: string | null | undefined
) {
  const { consultationChantierIds, chantierScope } = useUser();
  if (chantierScope === "all") return false;
  if (!chantierId) return false;
  return consultationChantierIds.includes(chantierId);
}

export function useCanMutateRaid(responsableRessourceId?: string | null) {
  const canWrite = useCanWritePage("/raid");
  const { ressourceId } = useUser();
  if (canWrite) return true;
  return !!(
    ressourceId &&
    responsableRessourceId &&
    ressourceId === responsableRessourceId
  );
}
