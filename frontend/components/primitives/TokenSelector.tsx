"use client";

import { type AssetMeta } from "@/lib/assets";
import { cn } from "@/lib/cn";

/**
 * Terminal-styled radio selector for collateral / debt assets. Shows symbol
 * + name + LTV hint on each row; one row is selected at a time. Used in the
 * Borrow / Manage screens to pick which collateral to deposit / withdraw.
 */
export function TokenSelector({
  assets,
  value,
  onChange,
  label = "$ select asset",
}: {
  assets: AssetMeta[];
  value: string; // symbol
  onChange: (symbol: string) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-[0.2em] text-ink-secondary">
        {label}
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {assets.map((a) => {
          const active = a.symbol === value;
          return (
            <button
              key={a.symbol}
              type="button"
              onClick={() => onChange(a.symbol)}
              className={cn(
                "cursor-target text-left px-3 py-2 border transition-colors font-mono",
                active
                  ? "border-phos text-phos bg-phos/5 phos-glow-soft"
                  : "border-ink-tertiary text-ink-secondary hover:border-phos-dim hover:text-phos",
              )}
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "text-[10px]",
                    active ? "text-phos" : "text-ink-tertiary",
                  )}
                >
                  {active ? "[x]" : "[ ]"}
                </span>
                <span className="text-[13px] tracking-[0.05em]">
                  {a.symbol}
                </span>
                <span className="ml-auto text-[10px] text-ink-tertiary">
                  ltv {(a.ltvBps / 100).toFixed(0)}%
                </span>
              </div>
              <div
                className={cn(
                  "text-[10px] mt-1 leading-tight",
                  active ? "text-phos/60" : "text-ink-tertiary",
                )}
              >
                {a.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
