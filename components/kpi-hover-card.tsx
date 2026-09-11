"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardDescription,
} from "@/components/ui/card";

export type KpiHoverVariant = "default" | "destructive" | "warning" | "success";

const VARIANT_REST: Record<KpiHoverVariant, string> = {
  default: "",
  destructive:
    "border-red-400/70 bg-red-50 dark:border-red-500/50 dark:bg-red-950/45",
  warning:
    "border-amber-400/55 bg-amber-50 dark:border-amber-400/40 dark:bg-amber-950/40",
  success:
    "border-emerald-400/55 bg-emerald-50 dark:border-emerald-400/40 dark:bg-emerald-950/40",
};

const VARIANT_HOVER: Record<KpiHoverVariant, string> = {
  default:
    "group-hover:border-[#00BDBB]/55 dark:group-hover:border-[#00BDBB]/40",
  destructive:
    "group-hover:border-red-500 dark:group-hover:border-red-400/70 group-hover:shadow-red-600/15",
  warning:
    "group-hover:border-amber-400/60 dark:group-hover:border-amber-400/45",
  success:
    "group-hover:border-emerald-400/60 dark:group-hover:border-emerald-400/45",
};

const VARIANT_GLOW: Record<KpiHoverVariant, string> = {
  default: "bg-gradient-to-b from-[#00BDBB]/18 via-transparent to-transparent",
  destructive:
    "bg-gradient-to-b from-red-500/25 via-red-400/10 to-transparent",
  warning: "bg-gradient-to-b from-amber-400/15 via-transparent to-transparent",
  success: "bg-gradient-to-b from-emerald-400/15 via-transparent to-transparent",
};

/** Lift / scale wrapper — parent grid should be `overflow-visible py-2`. */
export const KPI_HOVER_LIFT_CLASS =
  "group block h-full rounded-xl outline-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-2 hover:scale-[1.03] active:-translate-y-0.5 active:scale-[1.01] focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function KpiHoverShine() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-60 dark:via-white/20"
    />
  );
}

export function KpiHoverGlow({
  variant = "default",
}: {
  variant?: KpiHoverVariant;
}) {
  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none absolute -inset-px z-0 rounded-[inherit] transition-opacity duration-300",
        variant === "destructive"
          ? "opacity-80 group-hover:opacity-100"
          : "opacity-0 group-hover:opacity-100",
        VARIANT_GLOW[variant],
      ].join(" ")}
    />
  );
}

export function kpiHoverCardShellClass(variant: KpiHoverVariant = "default") {
  return [
    "relative h-full overflow-hidden",
    "border bg-card/95 backdrop-blur-[2px]",
    VARIANT_REST[variant],
    "shadow-sm transition-[box-shadow,border-color,background-color] duration-300 ease-out",
    variant === "destructive"
      ? "group-hover:shadow-xl group-hover:shadow-red-600/20"
      : "group-hover:shadow-xl group-hover:shadow-[#0A3C74]/12",
    "dark:group-hover:shadow-2xl dark:group-hover:shadow-black/50",
    VARIANT_HOVER[variant],
  ].join(" ");
}

export function KpiHoverCard({
  icon: Icon,
  label,
  value,
  subtitle,
  variant = "default",
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  subtitle?: string;
  variant?: KpiHoverVariant;
  href?: string;
}) {
  const colorClass =
    variant === "destructive"
      ? "text-red-600 dark:text-red-400"
      : variant === "warning"
        ? "text-amber-500"
        : variant === "success"
          ? "text-emerald-500"
          : "text-[#0A3C74] dark:text-[#5ad4d2]";
  const hasColor = variant !== "default";

  const inner = (
    <Card className={[kpiHoverCardShellClass(variant), href ? "cursor-pointer" : ""].join(" ")}>
      <KpiHoverShine />
      <KpiHoverGlow variant={variant} />

      <CardHeader className="relative z-10 space-y-0 px-4 pb-2 sm:px-5">
        <CardDescription className="flex items-center gap-2.5">
          <span
            className={[
              "flex size-7 shrink-0 items-center justify-center rounded-lg border shadow-sm",
              "bg-background transition-transform duration-300 ease-out",
              "group-hover:scale-110 group-hover:shadow-md",
              hasColor ? "border-current/15" : "border-border",
            ].join(" ")}
          >
            <Icon className={`size-3.5 ${colorClass}`} />
          </span>
          <span
            className={[
              "min-w-0 flex-1 text-sm font-bold leading-snug tracking-tight text-balance sm:text-[15px]",
              variant === "destructive"
                ? "text-red-700 dark:text-red-400"
                : "text-foreground/80",
            ].join(" ")}
          >
            {label}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="relative z-10 px-4 text-center sm:px-5">
        <div
          className={[
            "text-2xl font-bold tracking-tight whitespace-nowrap",
            "transition-transform duration-300 ease-out group-hover:scale-105",
            hasColor ? colorClass : "text-foreground",
          ].join(" ")}
        >
          {value}
        </div>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground transition-colors duration-300 group-hover:text-foreground/75 sm:text-xs">
            {subtitle}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className={KPI_HOVER_LIFT_CLASS}>
        {inner}
      </Link>
    );
  }

  return <div className={KPI_HOVER_LIFT_CLASS}>{inner}</div>;
}
