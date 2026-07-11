import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export const AVATAR_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function avatarUploadDir() {
  return path.join(process.cwd(), "public", "uploads", "avatars");
}

/** Absolute filesystem path for a public avatar URL like /uploads/avatars/x.jpg */
export function avatarFsPathFromUrl(avatarUrl: string): string | null {
  if (!avatarUrl || !avatarUrl.startsWith("/uploads/avatars/")) return null;
  const base = path.basename(avatarUrl.split("?")[0]);
  if (!base || base.includes("..")) return null;
  return path.join(avatarUploadDir(), base);
}

export async function ensureAvatarDir() {
  await mkdir(avatarUploadDir(), { recursive: true });
}

export async function saveAvatarFile(
  userId: string,
  file: File
): Promise<string> {
  // Cropped uploads are JPEG; also accept other image types if sent directly
  const ext = AVATAR_MIME_TO_EXT[file.type] ?? (file.type.startsWith("image/") ? "jpg" : null);
  if (!ext) {
    throw new Error(
      "Format non supporté. Utilisez JPEG, PNG, WebP ou GIF."
    );
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("L'image ne doit pas dépasser 2 Mo.");
  }

  await ensureAvatarDir();

  const buffer = Buffer.from(await file.arrayBuffer());
  // Prefer stable .jpg name after crop pipeline
  const filename = `${userId}.jpg`;
  const fsPath = path.join(avatarUploadDir(), filename);

  // Remove previous avatar files for this user (any extension)
  await removeAvatarFilesForUser(userId);

  await writeFile(fsPath, buffer);
  return `/uploads/avatars/${filename}`;
}

export async function removeAvatarFilesForUser(userId: string) {
  const dir = avatarUploadDir();
  await ensureAvatarDir();
  const { readdir } = await import("fs/promises");
  try {
    const files = await readdir(dir);
    await Promise.all(
      files
        .filter((f) => f.startsWith(`${userId}.`))
        .map((f) => unlink(path.join(dir, f)).catch(() => undefined))
    );
  } catch {
    // ignore
  }
}

export async function deleteAvatarFile(avatarUrl: string) {
  const fsPath = avatarFsPathFromUrl(avatarUrl);
  if (!fsPath) return;
  await unlink(fsPath).catch(() => undefined);
}
