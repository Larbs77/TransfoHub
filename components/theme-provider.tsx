"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme-script";

export type { Theme };

const STORAGE_KEY = THEME_STORAGE_KEY;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  ready: boolean;
};

// Survive Turbopack/HMR double-evaluation (duplicate module = null context)
const globalForTheme = globalThis as unknown as {
  __transfohubThemeContext?: ReturnType<
    typeof createContext<ThemeContextValue | null>
  >;
};

const ThemeContext =
  globalForTheme.__transfohubThemeContext ??
  createContext<ThemeContextValue | null>(null);

if (!globalForTheme.__transfohubThemeContext) {
  globalForTheme.__transfohubThemeContext = ThemeContext;
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function readPreferredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  // useLayoutEffect applies before paint (no <script> tag needed)
  useLayoutEffect(() => {
    const preferred = readPreferredTheme();
    setThemeState(preferred);
    applyThemeClass(preferred);
    setReady(true);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyThemeClass(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      applyThemeClass(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, ready }),
    [theme, setTheme, toggleTheme, ready]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

const fallbackThemeValue: ThemeContextValue = {
  theme: "light",
  setTheme: () => {
    /* no-op outside provider */
  },
  toggleTheme: () => {
    /* no-op outside provider */
  },
  ready: false,
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  // Prefer never hard-crashing the shell (HMR / edge bundler cases).
  // Root layout always mounts ThemeProvider in normal navigation.
  if (!ctx) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "useTheme: ThemeProvider context missing — using light fallback"
      );
    }
    return fallbackThemeValue;
  }
  return ctx;
}
