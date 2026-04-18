"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";

type Verb = "Deposit" | "Withdraw" | "Borrow" | "Settle";

const VERB_LABEL: Record<Verb, string> = {
  Deposit: "CONFIRM DEPOSIT",
  Withdraw: "CONFIRM WITHDRAWAL",
  Borrow: "CONFIRM DRAWDOWN",
  Settle: "CONFIRM SETTLEMENT",
};

/**
 * Column 2 on the dashboard. Amount input (no enclosing box, bottom hairline),
 * verb list, dynamic primary CTA. Each verb is a row separated by a hairline;
 * the one matching the current input is highlighted in gold.
 */
export function AllocatePanel({
  currentLtvPct,
  onSubmit,
  pending,
}: {
  currentLtvPct: number;
  onSubmit: (verb: Verb, amount: string) => void;
  pending?: boolean;
}) {
  const [verb, setVerb] = useState<Verb>("Deposit");
  const [amount, setAmount] = useState("");

  // Estimated LTV — naive pre-flight for display only; the contract will
  // recompute authoritatively. Matches brief's "Estimated LTV after action".
  const projectedLtv = useMemo(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return currentLtvPct;
    switch (verb) {
      case "Deposit":
        return Math.max(0, currentLtvPct - currentLtvPct * 0.25);
      case "Withdraw":
        return currentLtvPct + currentLtvPct * 0.25;
      case "Borrow":
        return currentLtvPct + 10;
      case "Settle":
        return Math.max(0, currentLtvPct - 15);
    }
  }, [amount, verb, currentLtvPct]);

  const disabled = pending || !amount || Number(amount) <= 0;

  return (
    <Card label="ALLOCATE">
      <div className="flex flex-col gap-8">
        <div>
          <span className="type-label">AMOUNT</span>
          <div className="flex items-baseline gap-3 pt-4">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(sanitize(e.target.value))}
              placeholder="0.00"
              className={cn(
                "input-underline font-mono tabular",
                "text-[42px] leading-none pb-3",
                "placeholder:text-ink-tertiary",
              )}
            />
            <span className="font-serif italic text-ink-secondary text-lg">
              {verb === "Deposit" || verb === "Withdraw" ? "WETH" : "USDC"}
            </span>
          </div>
          <div className="pt-4 flex items-baseline gap-3 type-caption">
            <span>Estimated LTV after action</span>
            <span className="font-mono tabular text-ink-secondary">
              {formatAmount(currentLtvPct, 2)}%
            </span>
            <span className="text-ink-tertiary">→</span>
            <span className="font-mono tabular text-accent-gold">
              {formatAmount(projectedLtv, 2)}%
            </span>
          </div>
        </div>

        <div className="flex flex-col">
          {(["Deposit", "Withdraw", "Borrow", "Settle"] as const).map((v, i) => (
            <VerbRow
              key={v}
              label={v}
              active={v === verb}
              onClick={() => setVerb(v)}
              showTopBorder={i > 0}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => onSubmit(verb, amount)}
          disabled={disabled}
          className={cn(
            "w-full h-14 rounded-[4px] type-label tracking-[0.18em]",
            "transition-colors duration-300 ease-out",
            disabled
              ? "bg-bg-high text-ink-tertiary cursor-not-allowed"
              : "bg-accent-gold text-bg hover:bg-accent-goldDeep",
            pending && "border border-accent-gold animate-pulse-soft",
          )}
        >
          {pending ? "PROCESSING…" : VERB_LABEL[verb]}
        </button>
      </div>
    </Card>
  );
}

function VerbRow({
  label,
  active,
  onClick,
  showTopBorder,
}: {
  label: Verb;
  active: boolean;
  onClick: () => void;
  showTopBorder: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between py-5",
        "transition-colors duration-300 ease-out text-left",
        showTopBorder && "border-t border-border-subtle",
        active ? "text-accent-gold" : "text-ink-primary hover:text-ink-secondary",
      )}
    >
      <span className="font-serif italic text-[22px]">{label}</span>
      <span
        className={cn(
          "text-xl",
          active ? "text-accent-gold" : "text-ink-tertiary",
        )}
      >
        →
      </span>
    </button>
  );
}

function sanitize(raw: string) {
  // Keep digits, one dot, one comma converted to dot.
  const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("");
}
