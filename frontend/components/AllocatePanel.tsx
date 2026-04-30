"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";

type Verb = "Deposit" | "Withdraw" | "Borrow" | "Settle" | "Supply" | "Unsupply";

const VERB_CMD: Record<Verb, string> = {
  Deposit: "deposit-collateral",
  Withdraw: "withdraw-collateral",
  Borrow: "borrow",
  Settle: "repay",
  Supply: "supply-liquidity",
  Unsupply: "withdraw-liquidity",
};

/**
 * Column 2 — the command composer. Supports 6 verbs now: the 4 borrower
 * operations + 2 LP operations (supply / withdraw-liquidity).
 */
export function AllocatePanel({
  currentLtvPct,
  onSubmit,
  pending,
  pendingStep,
  stepError,
}: {
  currentLtvPct: number;
  onSubmit: (verb: Verb, amount: string) => void;
  pending?: boolean;
  pendingStep?: string | null;
  stepError?: string | null;
}) {
  const [verb, setVerb] = useState<Verb>("Deposit");
  const [amount, setAmount] = useState("");

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
      case "Supply":
      case "Unsupply":
        return currentLtvPct; // LP ops don't move borrower LTV
    }
  }, [amount, verb, currentLtvPct]);

  const disabled = pending || !amount || Number(amount) <= 0;
  const unit =
    verb === "Deposit" || verb === "Withdraw"
      ? "RLC"
      : "USDC";

  return (
    <Card label="allocate" className="h-full">
      <div className="flex flex-col gap-2">
        <span className="text-terminal-dim text-[10px] uppercase tracking-widest">
          $ select command
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              "Deposit",
              "Withdraw",
              "Borrow",
              "Settle",
              "Supply",
              "Unsupply",
            ] as const
          ).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVerb(v)}
              className={cn(
                "px-2 py-1.5 border text-[10px] uppercase tracking-widest transition-colors text-left",
                verb === v
                  ? "border-terminal-text text-terminal-text terminal-glow bg-terminal-border/30"
                  : "border-terminal-border text-terminal-dim hover:text-terminal-text hover:border-terminal-dim",
              )}
            >
              {VERB_CMD[v]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-terminal-dim text-[10px] uppercase tracking-widest">
          $ enter amount
        </span>
        <div className="flex items-baseline gap-2 pb-1 border-b border-terminal-border focus-within:border-terminal-text transition-colors">
          <span className="text-terminal-text terminal-glow">&gt;</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitize(e.target.value))}
            placeholder="0.00"
            className={cn(
              "flex-1 bg-transparent border-0 outline-none",
              "font-mono tabular-nums text-[24px] leading-none",
              "text-terminal-text placeholder:text-terminal-fade",
              "caret-terminal-text terminal-glow",
            )}
          />
          <span className="text-terminal-dim text-sm uppercase tracking-widest">
            {unit.toLowerCase()}
          </span>
        </div>
      </div>

      {verb === "Deposit" ||
      verb === "Withdraw" ||
      verb === "Borrow" ||
      verb === "Settle" ? (
        <div className="flex items-baseline gap-2 text-[11px] font-mono">
          <span className="text-terminal-dim">#</span>
          <span className="text-terminal-dim">ltv_preview</span>
          <span className="text-terminal-fade">=</span>
          <span className="text-terminal-fade tabular-nums">
            {formatAmount(currentLtvPct, 2)}%
          </span>
          <span className="text-terminal-fade">-&gt;</span>
          <span className="text-terminal-text tabular-nums terminal-glow">
            {formatAmount(projectedLtv, 2)}%
          </span>
        </div>
      ) : (
        <div className="text-[11px] font-mono text-terminal-fade">
          # lp operations don't affect your borrower ltv
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {(pendingStep || stepError) && (
          <div className="font-mono text-[11px] leading-snug min-h-[14px]">
            {stepError ? (
              <span className="text-terminal-danger">[error] {stepError}</span>
            ) : (
              <span className="text-terminal-fade">
                <span className="text-terminal-dim">&gt;</span> {pendingStep}
                <span className="animate-blink">█</span>
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => onSubmit(verb, amount)}
          disabled={disabled}
          className={cn(
            "w-full h-10 border font-mono text-[11px] uppercase tracking-[0.2em]",
            "transition-colors",
            disabled
              ? "border-terminal-border text-terminal-fade cursor-not-allowed"
              : "border-terminal-text text-terminal-text hover:bg-terminal-text hover:text-black terminal-glow",
            pending && "animate-pulse",
          )}
        >
          {pending ? "$ processing…" : `$ ./${VERB_CMD[verb]} --confirm`}
        </button>
      </div>
    </Card>
  );
}

function sanitize(raw: string) {
  const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length <= 1) return cleaned;
  return parts[0] + "." + parts.slice(1).join("");
}
