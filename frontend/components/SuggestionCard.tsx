"use client";

import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";
import type { SuggestedAction } from "@/lib/relayer";

const VERB_OF: Record<SuggestedAction["type"], string> = {
  repay: "Settle",
  add_collateral: "Reinforce",
  withdraw_collateral: "Withdraw",
};

function describe(a: SuggestedAction): { title: string; unit: string; amount: string } {
  if (a.type === "repay") return { title: "Settle", amount: a.amount_debt, unit: "USDC" };
  if (a.type === "add_collateral")
    return { title: "Reinforce", amount: a.amount_collateral, unit: "RLC" };
  return { title: "Withdraw", amount: a.amount_collateral, unit: "RLC" };
}

/**
 * A Counsel-proposed action. Click `APPLY →` to route through the wallet.
 * Hover: 1px gold border, `APPLY →` brightens from gold → goldGlow (brief).
 */
export function SuggestionCard({
  action,
  onApply,
}: {
  action: SuggestedAction;
  onApply: (a: SuggestedAction) => void;
}) {
  const { title, amount, unit } = describe(action);
  const ltvPct = action.expected_new_ltv_bps / 100;

  return (
    <button
      type="button"
      onClick={() => onApply(action)}
      className={cn(
        "group w-full text-left bg-bg-high border border-border rounded-[4px]",
        "px-4 py-3 flex items-center justify-between gap-4",
        "transition-colors duration-300 ease-out",
        "hover:border-accent-gold",
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="font-serif italic text-[16px] text-ink-primary">
          {title} {formatAmount(Number(amount), title === "Settle" ? 2 : 4)} {unit}
        </span>
        <span className="type-caption">
          <span className="text-ink-tertiary">→</span> LTV{" "}
          <span className="font-mono tabular text-zone-safe">
            {formatAmount(ltvPct, 2)}%
          </span>{" "}
          after action
        </span>
      </div>
      <span
        className={cn(
          "type-label tracking-[0.18em] whitespace-nowrap",
          "text-accent-gold group-hover:text-accent-goldGlow",
          "transition-colors duration-300 ease-out",
        )}
      >
        APPLY →
      </span>
    </button>
  );
}
