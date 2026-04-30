"use client";

import { DecryptedNumber } from "./DecryptedNumber";
import { StatusPill } from "./StatusPill";
import { cn } from "@/lib/cn";

const BAR_WIDTH = 28;

const ZONE_COLOR: Record<number, string> = {
  0: "text-terminal-text",
  1: "text-terminal-amber",
  2: "text-terminal-amber",
  3: "text-terminal-danger",
};

/**
 * Compact ASCII progress bar for LTV. Single block: label + number + pill on
 * a row, bar below, threshold hint underneath.
 */
export function LtvGauge({
  ltvPercent,
  zone,
  className,
}: {
  ltvPercent: number;
  zone: number;
  className?: string;
}) {
  const fraction = Math.min(Math.max(ltvPercent / 100, 0), 1);
  const filled = Math.round(fraction * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const colorClass = ZONE_COLOR[zone] ?? ZONE_COLOR[0];

  return (
    <div className={cn("flex flex-col gap-2 font-mono", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-terminal-dim uppercase text-[10px] tracking-widest">
          loan_to_value
        </span>
        <StatusPill zone={zone} />
      </div>

      <DecryptedNumber value={ltvPercent} size="xl" unit="%" />

      <div className="text-sm leading-none whitespace-nowrap">
        <span className="text-terminal-fade">[</span>
        <span className={cn(colorClass, "terminal-glow tracking-[-0.05em]")}>
          {"█".repeat(filled)}
        </span>
        <span className="text-terminal-fade tracking-[-0.05em]">
          {"░".repeat(empty)}
        </span>
        <span className="text-terminal-fade">]</span>
      </div>

      <div className="text-[10px] text-terminal-fade">
        # liq_threshold = 85.00%
      </div>
    </div>
  );
}
