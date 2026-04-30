"use client";

import { useState } from "react";
import { ScrambleText } from "./ScrambleText";
import { cn } from "@/lib/cn";

/**
 * Large monospace value display with optional masking (████████) and a
 * "REVEAL" toggle. Scramble on mount reinforces the "decryption" feel.
 */
export function StatDisplay({
  label,
  value,
  unit,
  masked = false,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  masked?: boolean;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const showMask = masked && !revealed;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-ink-secondary">
        <span>{label}</span>
        {masked && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="text-ink-tertiary hover:text-phos underline underline-offset-2"
          >
            {revealed ? "[hide]" : "[reveal]"}
          </button>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        {showMask ? (
          <span className="text-ink-tertiary text-xl font-mono">████████</span>
        ) : (
          <ScrambleText
            text={value}
            onMount
            className="text-xl font-mono tabular-nums text-phos phos-glow"
          />
        )}
        {unit && !showMask && (
          <span className="text-[10px] uppercase tracking-widest text-ink-secondary">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
