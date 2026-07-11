"use client";

import { useLayoutEffect, useRef } from "react";
import { useTheme, type Theme } from "@/components/theme-provider";

/**
 * Applies the account's saved theme preference when the authenticated shell loads
 * (login / full page access). Soft client navigations keep ThemeProvider state so
 * the sidebar toggle still works for temporary switches during the session.
 */
export function UserThemeSync({ preference }: { preference: Theme }) {
  const { setTheme } = useTheme();
  const lastApplied = useRef<Theme | null>(null);

  useLayoutEffect(() => {
    if (preference !== "light" && preference !== "dark") return;
    // Re-apply when the server preference changes (e.g. saved on /profil)
    // or on first mount of the authenticated shell after a full load.
    if (lastApplied.current === preference) return;
    lastApplied.current = preference;
    setTheme(preference);
  }, [preference, setTheme]);

  return null;
}
