import { readFileSync, existsSync } from "fs";
import path from "path";
import { timingSafeEqual } from "crypto";

export const MAINTENANCE_USER_ID = "__maintenance__";
export const MAINTENANCE_ROLE = "__MAINTENANCE__";

export type MaintenanceCredentials = {
  username: string;
  password: string;
  displayName?: string;
};

const CONFIG_PATH = path.join(
  process.cwd(),
  "config",
  "maintenance-user.json"
);

function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // Still do a compare to reduce obvious timing leaks on length
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/**
 * Load maintenance credentials from config/maintenance-user.json.
 * This user is NOT stored in the database.
 */
export function loadMaintenanceCredentials(): MaintenanceCredentials | null {
  try {
    if (!existsSync(CONFIG_PATH)) {
      return null;
    }
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<MaintenanceCredentials>;
    if (
      !parsed.username ||
      !parsed.password ||
      typeof parsed.username !== "string" ||
      typeof parsed.password !== "string"
    ) {
      console.error(
        "[maintenance-auth] config/maintenance-user.json invalide (username/password requis)."
      );
      return null;
    }
    return {
      username: parsed.username.trim(),
      password: parsed.password,
      displayName: parsed.displayName?.trim() || "Maintenance Système",
    };
  } catch (e) {
    console.error("[maintenance-auth] Impossible de lire les credentials:", e);
    return null;
  }
}

/** True if the given login matches the maintenance username (case-insensitive). */
export function isMaintenanceUsername(username: string): boolean {
  const creds = loadMaintenanceCredentials();
  if (!creds) return false;
  return (
    username.trim().toLowerCase() === creds.username.toLowerCase()
  );
}

/**
 * Verify plain-text password from the config file.
 * Returns credentials on success, null otherwise.
 */
export function verifyMaintenanceLogin(
  username: string,
  password: string
): MaintenanceCredentials | null {
  const creds = loadMaintenanceCredentials();
  if (!creds) return null;
  if (username.trim().toLowerCase() !== creds.username.toLowerCase()) {
    return null;
  }
  if (!safeEqualString(password, creds.password)) {
    return null;
  }
  return creds;
}

export function getMaintenanceConfigPath(): string {
  return CONFIG_PATH;
}
