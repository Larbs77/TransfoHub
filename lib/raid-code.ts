/**
 * Pure RAID code helpers (safe for client + server).
 * DB allocation lives in lib/raid-code-server.ts (server-only).
 */

/** First letter of RAID code by type. */
export const RAID_TYPE_CODE_PREFIX: Record<string, string> = {
  Action: "A",
  Risque: "R",
  Information: "I",
  Décision: "D",
};

export function raidCodePrefixForType(type: string): string | null {
  return RAID_TYPE_CODE_PREFIX[type] ?? null;
}

/** Format e.g. A_00001 (letter + underscore + 5 digits). */
export function formatRaidCode(prefix: string, n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 99999) {
    throw new Error(`Numéro de code RAID hors plage (1–99999) : ${n}`);
  }
  return `${prefix.toUpperCase()}_${String(n).padStart(5, "0")}`;
}

/** Normalize user/CSV input to canonical form (e.g. a_12 → A_00012). */
export function normalizeRaidCode(code: string): string {
  const m = /^([A-Za-z])_(\d{1,5})$/.exec(code.trim());
  if (!m) return code.trim().toUpperCase();
  const n = Number(m[2]);
  if (!Number.isFinite(n) || n < 1) return code.trim().toUpperCase();
  return formatRaidCode(m[1], n);
}

export function isValidRaidCodeFormat(code: string): boolean {
  return /^[ADRI]_\d{5}$/.test(code.trim());
}

export function parseRaidCodeNumber(code: string): number | null {
  const m = /^[ADRI]_(\d{5})$/.exec(code.trim());
  if (!m) return null;
  return Number(m[1]);
}

/** Whether the code letter matches the RAID type. */
export function raidCodeMatchesType(code: string, type: string): boolean {
  const prefix = raidCodePrefixForType(type);
  if (!prefix) return false;
  return code.trim().toUpperCase().startsWith(`${prefix}_`);
}
