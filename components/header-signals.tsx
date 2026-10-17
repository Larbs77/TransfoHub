"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { getHeaderSignals } from "@/app/(app)/actions";
import type { HeaderSignals } from "@/lib/app-chrome";
import { useUser } from "@/components/user-provider";
import { cn } from "@/lib/utils";

function canAccess(allowed: string[], href: string): boolean {
  if (allowed.includes(href)) return true;
  return allowed.some(
    (p) => p !== "/" && (href === p || href.startsWith(p + "/"))
  );
}

type SignalTone = "rest" | "navy" | "destructive" | "warning" | "sky" | "success";

const TONE_CLASS: Record<SignalTone, string> = {
  rest: "border-[#0A3C74]/25 bg-[#0A3C74]/[0.08] text-[#0A3C74] hover:bg-[#0A3C74]/15 dark:border-[#00BDBB]/40 dark:bg-[#00BDBB]/12 dark:text-teal-50",
  navy: "border-[#0A3C74] bg-[#0A3C74] text-white shadow-sm shadow-[#0A3C74]/25 hover:bg-[#0A3C74]/90 dark:border-[#00BDBB]/50",
  destructive:
    "border-red-700 bg-red-600 text-white shadow-sm shadow-red-600/30 hover:bg-red-600/90",
  warning:
    "border-amber-600 bg-amber-500 text-amber-950 shadow-sm shadow-amber-500/30 hover:bg-amber-400",
  sky: "border-sky-700 bg-sky-600 text-white shadow-sm shadow-sky-600/30 hover:bg-sky-600/90",
  success:
    "border-emerald-700 bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-600/90",
};

function SignalTile({
  href,
  value,
  label,
  title,
  tone,
  icon: Icon,
  muted,
}: {
  href: string;
  value: string;
  label: string;
  title: string;
  tone: SignalTone;
  icon: typeof AlertTriangle;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "inline-flex h-8 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 whitespace-nowrap transition-colors",
        TONE_CLASS[tone]
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
      <span
        className={cn(
          "text-sm font-bold tabular-nums tracking-tight",
          muted && "opacity-60"
        )}
      >
        {value}
      </span>
      <span className="text-[11px] font-bold tracking-tight">{label}</span>
    </Link>
  );
}

function SignalSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-5 gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-8 animate-pulse rounded-md border border-[#0A3C74]/15 bg-[#0A3C74]/[0.06] dark:border-[#00BDBB]/20 dark:bg-[#00BDBB]/10"
        />
      ))}
    </div>
  );
}

export function HeaderSignals() {
  const user = useUser();
  const pathname = usePathname();
  const [signals, setSignals] = useState<HeaderSignals | null>(null);

  useEffect(() => {
    void getHeaderSignals()
      .then(setSignals)
      .catch(() => {
        setSignals((prev) =>
          prev ?? {
            activeActions: 0,
            overdueActions: 0,
            dueThisWeek: 0,
            dueNextWeek: 0,
            closeRate: 0,
          }
        );
      });
  }, [pathname]);

  const canRaid = canAccess(user.allowedPages, "/raid");

  if (!canRaid) return null;
  if (!signals) return <SignalSkeleton />;

  return (
    <div className="grid min-w-0 grid-cols-5 gap-1.5">
      <SignalTile
        href="/raid/actions?statut=active&scope=all"
        value={String(signals.activeActions)}
        label="Actives"
        title="Actions actives"
        icon={ClipboardList}
        tone={signals.activeActions > 0 ? "navy" : "rest"}
        muted={signals.activeActions === 0}
      />
      <SignalTile
        href="/raid/actions?overdue=true&scope=all"
        value={String(signals.overdueActions)}
        label="Échues"
        title="Actions échues"
        icon={AlertTriangle}
        tone={signals.overdueActions > 0 ? "destructive" : "rest"}
        muted={signals.overdueActions === 0}
      />
      <SignalTile
        href="/raid/actions?echeance=week&scope=all"
        value={String(signals.dueThisWeek)}
        label="Cette sem."
        title="Actions de cette semaine"
        icon={CalendarClock}
        tone={signals.dueThisWeek > 0 ? "warning" : "rest"}
        muted={signals.dueThisWeek === 0}
      />
      <SignalTile
        href="/raid/actions?echeance=next&scope=all"
        value={String(signals.dueNextWeek)}
        label="Sem. proch."
        title="Actions de la semaine prochaine"
        icon={CalendarRange}
        tone={signals.dueNextWeek > 0 ? "sky" : "rest"}
        muted={signals.dueNextWeek === 0}
      />
      <SignalTile
        href="/raid/actions?statut=Clôturé&scope=all"
        value={`${signals.closeRate}%`}
        label="Clôture"
        title="Taux de clôture des actions"
        icon={TrendingUp}
        tone={signals.closeRate >= 50 ? "success" : "rest"}
        muted={signals.closeRate === 0}
      />
    </div>
  );
}
