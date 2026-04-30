"use client";

import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";
import type { SuggestedAction } from "@/lib/relayer";

function describe(a: SuggestedAction): { cmd: string; amount: string; unit: string } {
  if (a.type === "repay") return { cmd: "repay", amount: a.amount_debt, unit: "USDC" };
  if (a.type === "add_collateral")
    return { cmd: "deposit-collateral", amount: a.amount_collateral, unit: "RLC" };
  return { cmd: "withdraw-collateral", amount: a.amount_collateral, unit: "RLC" };
}

/**
 * Numbered-option style for Counsel's proposed actions. Reads like a man-page
 * option list: `[1] $ ./repay --amount 500 USDC    # ltv -> 62.00%`.
 */
export function SuggestionCard({
  action,
  index,
  onApply,
}: {
  action: SuggestedAction;
  index?: number;
  onApply: (a: SuggestedAction) => void;
}) {
  const { cmd, amount, unit } = describe(action);
  const ltvPct = action.expected_new_ltv_bps / 100;

  return (
    <button
      type="button"
      onClick={() => onApply(action)}
      className={cn(
        "group w-full text-left border border-terminal-border px-4 py-2 font-mono text-sm",
        "hover:border-terminal-text hover:bg-terminal-border/20 transition-colors",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          {index !== undefined && (
            <span className="text-terminal-fade">[{index}]</span>
          )}
          <span className="text-terminal-text">$ ./{cmd}</span>
          <span className="text-terminal-dim">--amount</span>
          <span className="text-terminal-text tabular-nums terminal-glow">
            {formatAmount(Number(amount), cmd === "repay" ? 2 : 4)}
          </span>
          <span className="text-terminal-dim text-xs uppercase tracking-widest">
            {unit}
          </span>
        </div>
        <span className="text-terminal-dim group-hover:text-terminal-text text-xs uppercase tracking-widest whitespace-nowrap">
          exec &gt;
        </span>
      </div>
      <div className="text-[11px] text-terminal-fade pl-6 mt-1 font-mono">
        # ltv_after ={" "}
        <span className="tabular-nums">{formatAmount(ltvPct, 2)}%</span>
      </div>
    </button>
  );
}
