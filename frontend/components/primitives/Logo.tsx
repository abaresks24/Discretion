"use client";

import { cn } from "@/lib/cn";

/**
 * D-lock monogram — a stylised D with a keyhole. Renders in phosphor green.
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
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect
          x="3"
          y="3"
          width="26"
          height="26"
          stroke="#00ff9f"
          strokeWidth="1.5"
        />
        <path
          d="M10 8 V 24 H 18 C 22 24 24 20 24 16 C 24 12 22 8 18 8 Z"
          stroke="#00ff9f"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="17" cy="16" r="2" fill="#00ff9f" />
        <rect x="16.25" y="16" width="1.5" height="4" fill="#00ff9f" />
      </svg>
      {showWord && (
        <span className="font-mono text-sm tracking-[0.3em] text-phos phos-glow-soft">
          DISCRETION
        </span>
      )}
    </span>
  );
}
