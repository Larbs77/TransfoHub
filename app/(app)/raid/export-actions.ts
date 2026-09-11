"use server";

import { getRaidItems } from "@/app/(app)/actions";
import {
  buildRaidExcelBase64,
  raidExcelFileName,
} from "@/lib/raid-excel-export";

export async function exportRaidExcel(
  ids: string[],
  kind: "all" | "selection" | "comite",
  slug?: string
): Promise<{ fileName: string; base64: string; count: number }> {
  if (!ids.length) {
    throw new Error("Aucune entrée à exporter.");
  }

  const uniqueIds = [...new Set(ids)];
  const accessible = await getRaidItems();
  const byId = new Map(accessible.map((r) => [r.id, r]));
  const rows = uniqueIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r);

  if (rows.length === 0) {
    throw new Error("Aucune entrée autorisée à exporter.");
  }

  const base64 = await buildRaidExcelBase64(rows);
  return {
    fileName: raidExcelFileName(kind, slug),
    base64,
    count: rows.length,
  };
}
