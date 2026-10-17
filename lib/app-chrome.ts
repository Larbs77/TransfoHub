/** Client-safe types for the app top bar (signals, search). */

export type HeaderSignals = {
  activeActions: number;
  overdueActions: number;
  dueThisWeek: number;
  dueNextWeek: number;
  closeRate: number;
};

export type AppSearchHit = {
  kind: "chantier" | "raid";
  id: string;
  href: string;
  title: string;
  subtitle: string;
};
