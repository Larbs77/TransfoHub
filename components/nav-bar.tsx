"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  CalendarCheck,
  CalendarDays,
  BookOpen,
  ChevronDown,
  Settings,
  Contact,
  BarChart3,
  Clock,
  UserCog,
  Milestone,
  Link2,
  HelpCircle,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Presentation,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { AlertBell } from "@/components/alert-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAvatar } from "@/components/user-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUser } from "@/components/user-provider";
import { logoutAction } from "@/app/(auth)/login/actions";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const ALL_SECTIONS: NavSection[] = [
  {
    label: "Suivi Opérationnel",
    icon: BarChart3,
    items: [
      { href: "/chantiers", label: "Chantiers", icon: FolderKanban },
      { href: "/adherences", label: "Adhérences", icon: Link2 },
      { href: "/raid", label: "RAID", icon: BookOpen },
      { href: "/jalons", label: "Jalons", icon: Milestone },
      { href: "/saisie-temps", label: "Saisie Temps", icon: Clock },
      { href: "/consultation-backlog", label: "Backlog Q&A", icon: HelpCircle },
      { href: "/favoris", label: "Favoris", icon: Star },
    ],
  },
  {
    label: "Gouvernance",
    icon: CalendarCheck,
    items: [
      { href: "/comites", label: "Comités", icon: CalendarCheck },
      { href: "/dashboards", label: "Dashboards", icon: Presentation },
      { href: "/rmds", label: "RMD", icon: Users },
      { href: "/calendrier", label: "Calendrier", icon: CalendarDays },
    ],
  },
  {
    label: "Ressources",
    icon: Contact,
    items: [
      { href: "/ressources", label: "Ressources", icon: Contact },
      { href: "/profils", label: "Profils", icon: UserCog },
      { href: "/capacite", label: "Capacité", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    icon: ShieldCheck,
    items: [
      { href: "/admin/users", label: "Utilisateurs", icon: Users },
      { href: "/admin/roles", label: "Rôles", icon: ShieldCheck },
      { href: "/settings", label: "Paramètres", icon: Settings },
    ],
  },
];

function canAccessPath(allowedPages: string[], href: string): boolean {
  if (allowedPages.includes(href)) return true;
  return allowedPages.some(
    (p) => p !== "/" && (href === p || href.startsWith(p + "/"))
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function SidebarSection({
  section,
  pathname,
  collapsed,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const sectionActive = section.items.some((item) =>
    isActive(pathname, item.href)
  );
  const [open, setOpen] = useState(true);

  if (collapsed) {
    return (
      <div className="space-y-1 px-2">
        {section.items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center justify-center rounded-lg p-2.5 transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
          sectionActive
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <section.icon className="size-4" />
        <span className="flex-1 text-left">{section.label}</span>
        <ChevronDown
          className={`size-3.5 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5 px-1">
          {section.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NavBar({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useUser();

  // Filter sections and items by dynamic role page permissions
  const sections = useMemo(() => {
    return ALL_SECTIONS
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          canAccessPath(user.allowedPages, item.href)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [user.allowedPages]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <TooltipProvider>
      {/* Mobile top bar */}
      <header className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary">
            <FolderKanban className="size-3.5 text-[#00BDBB]" />
          </span>
          <span className="text-sm font-bold text-primary">TransfoHub</span>
        </Link>
        <AlertBell />
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 flex h-dvh flex-col border-r bg-card transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-64"
        } ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo / Header */}
        <div
          className={`flex h-14 shrink-0 items-center border-b ${
            collapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {collapsed ? (
            <Link
              href="/"
              className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"
              title="TransfoHub"
            >
              <FolderKanban className="size-4 text-[#00BDBB]" />
            </Link>
          ) : (
            <>
              <Link href="/" className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <FolderKanban className="size-4 text-[#00BDBB]" />
                </span>
                <div className="leading-tight">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#00BDBB]">
                    Bank of Africa
                  </span>
                  <span className="block text-sm font-bold tracking-tight text-primary">
                    TransfoHub
                  </span>
                </div>
              </Link>
              <button
                onClick={closeMobile}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
              >
                <X className="size-4" />
              </button>
            </>
          )}
        </div>

        {/* Dashboard link */}
        <div className={`pt-3 ${collapsed ? "px-2" : "px-3"}`}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  onClick={closeMobile}
                  className={`flex items-center justify-center rounded-lg p-2.5 transition-colors ${
                    pathname === "/"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <LayoutDashboard className="size-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                Tableau de bord
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/"
              onClick={closeMobile}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === "/"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <LayoutDashboard className="size-4" />
              Tableau de bord
            </Link>
          )}
        </div>

        {/* Sections */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-3">
          {collapsed && <div className="mx-auto my-1 w-8 border-t" />}
          {sections.map((section, i) => (
            <div key={section.label}>
              {!collapsed && i > 0 && <div className="mx-3 mb-2 border-t" />}
              {collapsed && i > 0 && (
                <div className="mx-auto mb-2 w-8 border-t" />
              )}
              <SidebarSection
                section={section}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={closeMobile}
              />
            </div>
          ))}
        </nav>

        {/* Bottom: User menu + theme + Alert + Collapse toggle */}
        <div className="shrink-0 border-t">
          {/* User info + logout — avatar/name open profile */}
          <div className={`${collapsed ? "px-2 py-3" : "px-3 py-3"}`}>
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link
                    href="/profil"
                    onClick={closeMobile}
                    className={`flex items-center justify-center rounded-lg p-0.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      pathname === "/profil" || pathname.startsWith("/profil/")
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-full"
                        : ""
                    }`}
                    aria-label="Mon profil"
                  >
                    <UserAvatar
                      name={user.displayName || user.username}
                      color={user.roleColor}
                      src={user.avatarUrl}
                      version={user.avatarVersion}
                      size="md"
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <div className="text-sm font-medium">
                    {user.displayName || user.username}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user.roleLabel}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Voir mon profil
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/profil"
                  onClick={closeMobile}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    pathname === "/profil" || pathname.startsWith("/profil/")
                      ? "bg-accent/50"
                      : ""
                  }`}
                  title="Mon profil"
                >
                  <UserAvatar
                    name={user.displayName || user.username}
                    color={user.roleColor}
                    src={user.avatarUrl}
                    version={user.avatarVersion}
                    size="md"
                  />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium">
                      {user.displayName || user.username}
                    </div>
                    <div
                      className="truncate text-[11px] font-medium"
                      style={{ color: user.roleColor }}
                    >
                      {user.roleLabel}
                    </div>
                  </div>
                </Link>
                <form action={logoutAction} className="shrink-0">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        type="submit"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <LogOut className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      Se déconnecter
                    </TooltipContent>
                  </Tooltip>
                </form>
              </div>
            )}

            {/* Theme toggle — directly under username / logout */}
            <div className="mt-2">
              <ThemeToggle collapsed={collapsed} />
            </div>

            {collapsed && (
              <div className="mt-2">
                <form action={logoutAction}>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <button
                        type="submit"
                        className="flex w-full items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <LogOut className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      Se déconnecter
                    </TooltipContent>
                  </Tooltip>
                </form>
              </div>
            )}
          </div>

          {/* Alert + Collapse toggle */}
          <div
            className={`border-t px-3 py-2 ${
              collapsed
                ? "flex flex-col items-center gap-2"
                : "flex items-center justify-between"
            }`}
          >
            <div className="hidden lg:block">
              <AlertBell />
            </div>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden lg:flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title={collapsed ? "Étendre" : "Réduire"}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div
        className={`pt-14 lg:pt-0 transition-all duration-300 ${
          collapsed ? "lg:pl-[68px]" : "lg:pl-64"
        }`}
      >
        {children}
      </div>
    </TooltipProvider>
  );
}
