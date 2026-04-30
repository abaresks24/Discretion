"use client";

import { useMemo, useState } from "react";
import { Card } from "./Card";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";

type Verb = "Deposit" | "Withdraw" | "Borrow" | "Settle";

const VERB_CMD: Record<Verb, string> = {
  Deposit: "deposit-collateral",
  Withdraw: "withdraw-collateral",
  Borrow: "borrow",
  Settle: "repay",
};

/**
 * Borrower-side action composer. When Deposit is selected, the user can opt
 * into the TEE wrap queue — plaintext RLC is sent to the queue contract and
 * wrapped in batches by the iExec iApp, with cRLC landing at the user's
 * address a few minutes later. The subsequent deposit is then a normal
 * confidentialTransferFrom.
 */
export function BorrowerActionsCard({
  currentLtvPct,
  borrowAprPct,
  onSubmit,
  pending,
  pendingStep,
  stepError,
  className,
}: {
  currentLtvPct: number;
  borrowAprPct: number;
  onSubmit: (verb: Verb, amount: string, opts?: { mixer?: boolean }) => void;
  pending?: boolean;
  pendingStep?: string | null;
  stepError?: string | null;
  className?: string;
}) {
  const [verb, setVerb] = useState<Verb>("Deposit");
  const [amount, setAmount] = useState("");
  const [useMixer, setUseMixer] = useState(false);

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
  const unit = verb === "Deposit" || verb === "Withdraw" ? "rlc" : "usdc";
  const mixerApplicable = verb === "Deposit";

  return (
    <Card label="borrow // actions" className={className}>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-mono">
        <span className="text-terminal-fade">
          # collateralize rlc · draw usdc
        </span>
        <span className="text-terminal-amber">
          apr {borrowAprPct.toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {(["Deposit", "Withdraw", "Borrow", "Settle"] as const).map((v) => (
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
            {unit}
          </span>
          <span className="flex-1" />
        </div>
      </div>

      <div className="flex items-baseline gap-2 text-[11px] font-mono">
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

      {mixerApplicable && (
        <label
          className={cn(
            "flex items-start gap-2 text-[11px] font-mono select-none cursor-pointer",
            "border border-dashed border-terminal-border px-3 py-2 transition-colors",
            useMixer
              ? "border-terminal-text/60 text-terminal-text"
              : "text-terminal-fade hover:text-terminal-dim",
          )}
        >
          <input
            type="checkbox"
            checked={useMixer}
            onChange={(e) => setUseMixer(e.target.checked)}
            className="mt-0.5 accent-terminal-text"
          />
          <span>
            <span className="text-terminal-dim">wrap via tee mixer</span>
            <span className="block text-[10px] text-terminal-fade mt-0.5">
              # rlc → wrap_queue → iapp batches on iexec tdx → cRLC to you
              <br />
              # breaks wrap/deposit timing correlation. takes 2–5min.
            </span>
          </span>
        </label>
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
          onClick={() =>
            onSubmit(verb, amount, {
              mixer: mixerApplicable ? useMixer : false,
            })
          }
          disabled={disabled}
          className={cn(
            "w-full h-10 border font-mono text-[11px] uppercase tracking-[0.2em] transition-colors",
            disabled
              ? "border-terminal-border text-terminal-fade cursor-not-allowed"
              : "border-terminal-text text-terminal-text hover:bg-terminal-text hover:text-black terminal-glow",
            pending && "animate-pulse",
          )}
        >
          {pending
            ? "$ processing…"
            : `$ ./${VERB_CMD[verb]}${mixerApplicable && useMixer ? " --mixer" : ""} --confirm`}
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
