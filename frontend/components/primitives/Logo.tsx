"use client";

import { cn } from "@/lib/cn";

/**
 * Discretion logo — uses the brand asset under `/public/logo-discretion.svg`.
 */
export function Logo({
  size = 24,
  showWord = true,
  className,
}: {
  size?: number;
  showWord?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-discretion.svg"
        alt="Discretion"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="object-contain"
      />
      {showWord && (
        <span className="font-mono text-sm tracking-[0.3em] text-phos phos-glow-soft">
          DISCRETION
        </span>
      )}
    </span>
  );
}
