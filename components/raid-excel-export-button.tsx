"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { exportRaidExcel } from "@/app/(app)/raid/export-actions";

function downloadBase64Xlsx(fileName: string, base64: string) {
  const clean = base64.replace(/^data:.*?;base64,/, "").replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function RaidExcelExportOnceButton({
  ids,
  slug,
  size = "xs",
}: {
  ids: string[];
  slug?: string;
  size?: "xs" | "sm";
}) {
  const [pending, setPending] = useState(false);

  async function run() {
    if (ids.length === 0 || pending) return;
    setPending(true);
    try {
      const { fileName, base64 } = await exportRaidExcel(ids, "comite", slug);
      downloadBase64Xlsx(fileName, base64);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export Excel impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className="gap-1.5"
      disabled={pending || ids.length === 0}
      onClick={run}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <FileSpreadsheet className="size-3.5" />
      )}
      Export Excel
    </Button>
  );
}

export function RaidExcelExportButton({
  allIds,
  getSelectedIds,
}: {
  allIds: string[];
  getSelectedIds: () => string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<"all" | "selection" | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  async function run(kind: "all" | "selection") {
    const ids = kind === "all" ? allIds : getSelectedIds();
    if (ids.length === 0) return;
    setPending(kind);
    try {
      const { fileName, base64 } = await exportRaidExcel(ids, kind);
      downloadBase64Xlsx(fileName, base64);
      setOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export Excel impossible.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelectedCount(getSelectedIds().length);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          disabled={pending !== null}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="size-4" />
          )}
          Export Excel
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <button
          type="button"
          disabled={allIds.length === 0 || pending !== null}
          onClick={() => run("all")}
          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
        >
          <span>Exporter tout le RAID</span>
          <span className="text-xs text-muted-foreground">{allIds.length}</span>
        </button>
        <button
          type="button"
          disabled={selectedCount === 0 || pending !== null}
          onClick={() => run("selection")}
          className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
        >
          <span>Exporter la sélection</span>
          <span className="text-xs text-muted-foreground">
            {selectedCount}
          </span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
