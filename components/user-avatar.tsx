"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_CLASS: Record<Size, string> = {
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-14 text-lg",
  "2xl": "size-28 text-3xl",
};

type UserAvatarProps = {
  name: string;
  color?: string;
  src?: string | null;
  size?: Size;
  className?: string;
  /** Cache-bust query (e.g. updatedAt timestamp) */
  version?: string | number | null;
};

export function UserAvatar({
  name,
  color = "#6b7280",
  src,
  size = "md",
  className,
  version,
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  const letter = (name?.trim().charAt(0) || "?").toUpperCase();
  const hasImage = Boolean(src && src.trim() && !broken);
  const imageSrc =
    hasImage && src
      ? version
        ? `${src}${src.includes("?") ? "&" : "?"}v=${version}`
        : src
      : null;

  if (imageSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={name}
        onError={() => setBroken(true)}
        className={cn(
          "shrink-0 rounded-full object-cover bg-muted",
          SIZE_CLASS[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        SIZE_CLASS[size],
        className
      )}
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {letter}
    </div>
  );
}
