"use client";

import { Printer } from "lucide-react";

export function PrintButton({ count }: { count: number }) {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white"
      style={{ backgroundColor: "#1e3a5f" }}
    >
      <Printer className="size-4" />
      Imprimer / Télécharger PDF ({count} page{count > 1 ? "s" : ""})
    </button>
  );
}
