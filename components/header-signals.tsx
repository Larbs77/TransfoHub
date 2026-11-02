"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getHeaderSignals } from "@/app/(app)/actions";
import type { HeaderSignals } from "@/lib/app-chrome";
import { useUser } from "@/components/user-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function canAccess(allowed: string[], href: string): boolean {
  if (allowed.includes(href)) return true;
  return allowed.some(
    (p) => p !== "/" && (href === p || href.startsWith(p + "/"))
  );
}

const PILL_ALERT =
  "border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100/80 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15";
const PILL_QUIET =
  "border-[#0A3C74]/15 bg-transparent text-[#0A3C74]/75 hover:bg-[#0A3C74]/[0.06] dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/5";

function SignalSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-24 animate-pulse rounded-full bg-[#0A3C74]/[0.06] dark:bg-white/10" />
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function HeaderSignals() {
  const user = useUser();
  const pathname = usePathname();
  const [signals, setSignals] = useState<HeaderSignals | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const overdue = signals.overdueActions > 0;
  const dueThisWeek = signals.dueThisWeek > 0;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        href="/raid/actions?overdue=true&scope=all"
        title="Actions échues"
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
          overdue ? PILL_ALERT : PILL_QUIET
        )}
      >
        <span className={cn("font-semibold tabular-nums", !overdue && "opacity-70")}>
          {signals.overdueActions}
        </span>
        <span className="font-medium">Échues</span>
      </Link>

      <Link
        href="/raid/actions?echeance=week&scope=all"
        title="Actions de cette semaine"
        className="inline-flex min-w-0 items-baseline gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <span
          className={cn(
            "font-semibold tabular-nums",
            dueThisWeek
              ? "text-amber-800 dark:text-amber-100"
              : "text-foreground/80"
          )}
        >
          {signals.dueThisWeek}
        </span>
        <span className="truncate">cette semaine</span>
      </Link>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Autres indicateurs d'actions"
          >
            Actions
            <ChevronDown className="size-3.5 opacity-70" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1">
          <MenuLink
            href="/raid/actions?statut=active&scope=all"
            label="Actives"
            value={String(signals.activeActions)}
            title="Actions actives"
            onPick={() => setMenuOpen(false)}
          />
          <MenuLink
            href="/raid/actions?echeance=next&scope=all"
            label="Semaine prochaine"
            value={String(signals.dueNextWeek)}
            title="Actions de la semaine prochaine"
            onPick={() => setMenuOpen(false)}
          />
          <MenuLink
            href="/raid/actions?statut=Clôturé&scope=all"
            label="Clôturées"
            value={`${signals.closeRate}\u00a0%`}
            title="Taux de clôture des actions"
            onPick={() => setMenuOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MenuLink({
  href,
  label,
  value,
  title,
  onPick,
}: {
  href: string;
  label: string;
  value: string;
  title: string;
  onPick: () => void;
}) {
  return (
    <Link
      href={href}
      title={title}
      onClick={onPick}
      className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-accent"
    >
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </Link>
  );
}
