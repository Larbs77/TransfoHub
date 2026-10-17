"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type InboxContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  isLg: boolean;
  unreadCount: number;
  setUnreadCount: (n: number) => void;
};

const InboxContext = createContext<InboxContextValue | null>(null);

function useIsLg() {
  const [isLg, setIsLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsLg(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isLg;
}

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLg = useIsLg();
  const [open, setOpenState] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
  }, []);

  const toggle = useCallback(() => {
    setOpenState((v) => !v);
  }, []);

  useEffect(() => {
    if (!isLg) setOpenState(false);
  }, [pathname, isLg]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenState(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen, toggle, isLg, unreadCount, setUnreadCount }),
    [open, setOpen, toggle, isLg, unreadCount]
  );

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  );
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) {
    throw new Error("useInbox must be used within InboxProvider");
  }
  return ctx;
}
