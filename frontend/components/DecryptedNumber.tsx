"use client";

import { useDecryptText } from "@/hooks/useDecryptText";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Canonical way to display a confidential numerical value. Handles:
 *   - formatting with thin-space thousand separators, 2 decimals by default
 *   - the 700ms decrypt scramble on mount / value change
 *   - veiling (`████████`) when global view mode is `public`
 *
 * Numbers render in JetBrains Mono with tabular-nums. Optional unit renders
 * in italic serif, offset by a thin space, per the brief's number aesthetic.
 */
export function DecryptedNumber({
  value,
  unit,
  decimals = 2,
  delay = 0,
  className,
  unitClassName,
  size = "lg",
}: {
  value: number | string;
  unit?: string;
  decimals?: number;
  delay?: number;
  className?: string;
  unitClassName?: string;
  size?: "xl" | "lg" | "md" | "sm";
}) {
  const formatted = formatAmount(value, decimals);
  const display = useDecryptText(formatted, delay);

  const sizeClass =
    size === "xl"
      ? "type-mono-xl"
      : size === "lg"
        ? "type-mono-lg"
        : size === "md"
          ? "type-mono-md"
          : "type-mono-sm";

  return (
    <span className={cn("inline-flex items-baseline gap-[0.4em] tabular", className)}>
      <span className={cn(sizeClass, "text-ink-primary")}>{display || formatted}</span>
      {unit && (
        <span
          className={cn(
            "font-serif italic text-ink-secondary",
            size === "xl" ? "text-xl" : "text-sm",
            unitClassName,
          )}
        >
          {unit}
        </span>
      )}
    </span>
  );
}
