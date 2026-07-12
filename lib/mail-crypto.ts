import crypto from "crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    // Dev fallback — production must set SESSION_SECRET
    return crypto.createHash("sha256").update("transfuhub-dev-mail-key").digest();
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/** Encrypt a secret for DB storage (SMTP password). Empty in → empty out. */
export function encryptSecret(plain: string): string {
  const value = plain.trim();
  if (!value) return "";

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX.slice(0, -1),
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

/** Decrypt a value produced by encryptSecret. Plain legacy values pass through. */
export function decryptSecret(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) {
    // Legacy / plain text (should not happen for new data)
    return stored;
  }

  const parts = stored.split(":");
  // enc:v1:iv:tag:data
  if (parts.length !== 5) {
    throw new Error("Format de secret chiffré invalide.");
  }
  const [, , ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");

  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

export function hasStoredPassword(stored: string): boolean {
  return Boolean(stored && stored.length > 0);
}
