"use client";

import { useDecryptText } from "@/hooks/useDecryptText";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Mono, phosphor-glowing number display. Preserves the 700ms decrypt scramble
 * from the hook (still on-brand — "the terminal is resolving a ciphertext").
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
      ? "text-[40px] leading-none font-semibold"
      : size === "lg"
        ? "text-[26px] leading-none font-semibold"
        : size === "md"
          ? "text-[17px] leading-none"
          : "text-[12px] leading-none";

  return (
    <span className={cn("inline-flex items-baseline gap-2 font-mono tabular-nums", className)}>
      <span className={cn(sizeClass, "text-terminal-text terminal-glow")}>
        {display || formatted}
      </span>
      {unit && (
        <span
          className={cn(
            "text-terminal-dim text-xs uppercase tracking-widest",
            unitClassName,
          )}
        >
          {unit}
        </span>
      )}
    </span>
  );
}
