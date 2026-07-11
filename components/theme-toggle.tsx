"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ThemeToggleProps = {
  collapsed?: boolean;
};

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, toggleTheme, ready } = useTheme();
  const isDark = theme === "dark";
  const label = isDark ? "Mode clair" : "Mode sombre";

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleTheme}
            disabled={!ready}
            aria-label={label}
            className="flex w-full items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={!ready}
      aria-label={label}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="flex-1 text-left">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
          isDark
            ? "border-primary/40 bg-primary"
            : "border-border bg-muted"
        }`}
        aria-hidden
      >
        <span
          className={`inline-block size-3.5 rounded-full bg-background shadow-sm transition-transform ${
            isDark ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
