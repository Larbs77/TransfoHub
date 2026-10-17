"use client";

import { AppSearch } from "@/components/app-search";
import { HeaderSignals } from "@/components/header-signals";
import { InboxTrigger } from "@/components/alert-bell";

export function AppTopBar() {
  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur-sm lg:flex">
      <div className="min-w-0 flex-1">
        <HeaderSignals />
      </div>
      <AppSearch />
      <InboxTrigger />
    </header>
  );
}
