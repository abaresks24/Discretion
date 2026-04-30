"use client";

import { useState } from "react";
import { Card } from "./Card";
import { DecryptedNumber } from "./DecryptedNumber";
import { cn } from "@/lib/cn";

type Verb = "Supply" | "Unsupply";

const VERB_CMD: Record<Verb, string> = {
  Supply: "supply-liquidity",
  Unsupply: "withdraw-liquidity",
};

/**
 * Lender-side action composer — deposit cUSDC to earn, withdraw to exit.
 * Shows the user's current LP balance at the top so the pitch is contextual.
 */
export function LenderActionsCard({
  lenderAmount,
  supplyAprPct,
  onSubmit,
  pending,
  pendingStep,
  stepError,
  className,
}: {
  lenderAmount: number;
  supplyAprPct: number;
  onSubmit: (verb: Verb, amount: string) => void;
  pending?: boolean;
  pendingStep?: string | null;
  stepError?: string | null;
  className?: string;
}) {
  const [verb, setVerb] = useState<Verb>("Supply");
  const [amount, setAmount] = useState("");

  const disabled = pending || !amount || Number(amount) <= 0;

  return (
    <Card label="lend // actions" className={className}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-mono">
        <span className="text-terminal-fade">
          # provide usdc · earn interest
        </span>
        <span className="text-terminal-text terminal-glow">
          apr {supplyAprPct.toFixed(2)}%
        </span>
      </div>

      <div className="flex items-baseline gap-3 font-mono">
        <span className="text-terminal-dim text-xs uppercase tracking-widest">
          you supplied
        </span>
        <DecryptedNumber
          value={lenderAmount}
          unit="USDC"
          size="md"
          decimals={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {(["Supply", "Unsupply"] as const).map((v) => (
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

      <div className="flex flex-col gap-1">
        <span className="text-terminal-dim text-[10px] uppercase tracking-widest">
          $ amount
        </span>
        <div className="flex items-baseline gap-2 pb-1 border-b border-terminal-border focus-within:border-terminal-text transition-colors">
          <span className="text-terminal-text terminal-glow">&gt;</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitize(e.target.value))}
            placeholder="0.00"
            style={{ fieldSizing: "content" } as React.CSSProperties}
            className={cn(
              "bg-transparent border-0 outline-none",
              "font-mono tabular-nums text-[22px] leading-none",
              "text-terminal-text placeholder:text-terminal-fade",
              "caret-terminal-text terminal-glow",
              "min-w-[4ch] max-w-full",
            )}
          />
          <span className="text-terminal-text terminal-glow text-sm uppercase tracking-widest shrink-0">
            usdc
          </span>
          <span className="flex-1" />
        </div>
      </div>

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
            "w-full h-10 border font-mono text-[11px] uppercase tracking-[0.2em] transition-colors",
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
