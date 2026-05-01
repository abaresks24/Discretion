"use client";

import { useState } from "react";
import { AsciiCard } from "../primitives/AsciiCard";
import { TerminalButton } from "../primitives/TerminalButton";
import { TerminalInput } from "../primitives/TerminalInput";
import { useAllocate, type Verb } from "@/hooks/useAllocate";
import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";

export type ActionFormProps = {
  title: string;
  verbs: Verb[];
  unit: string;
  /** When set, the form passes this asset symbol to `allocate({assetSymbol})`. */
  assetSymbol?: string;
  extraBanner?: React.ReactNode;
  extraSummary?: (amountNum: number) => React.ReactNode;
  /** Caller-provided invalid state — e.g. "exceeds borrow capacity". */
  invalid?: (amountNum: number) => string | null;
};

const VERB_CMD: Record<Verb, string> = {
  Deposit: "deposit-collateral",
  Withdraw: "withdraw-collateral",
  Borrow: "borrow",
  Settle: "repay",
  Supply: "supply-liquidity",
  Unsupply: "withdraw-liquidity",
};

/**
 * Unified action form used by the Deposit / Borrow / Supply / Withdraw screens.
 * Handles verb selection, amount entry, optional mixer, diff summary, and
 * submission via `useAllocate`.
 */
export function ActionForm({
  title,
  verbs,
  unit,
  assetSymbol,
  extraBanner,
  extraSummary,
  invalid,
}: ActionFormProps) {
  const [verb, setVerb] = useState<Verb>(verbs[0]);
  const [amount, setAmount] = useState("");
  const { allocate, pendingVerb, pendingStep, stepError, busy } = useAllocate();

  const amountNum = Number(amount);
  const amountValid = !!amount && Number.isFinite(amountNum) && amountNum > 0;
  const invalidReason = amountValid && invalid ? invalid(amountNum) : null;
  const disabled = busy || !amountValid || !!invalidReason;

  const sanitize = (raw: string) => {
    const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    return parts.length <= 1 ? cleaned : parts[0] + "." + parts.slice(1).join("");
  };

  const busyHere = pendingVerb !== null && verbs.includes(pendingVerb);

  return (
    <AsciiCard title={title} className="min-h-full">
      <div className="flex flex-col gap-5">
        {extraBanner}

        {verbs.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-ink-secondary">
              $ select command
            </span>
            <div className="grid grid-cols-2 gap-2">
              {verbs.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVerb(v)}
                  className={cn(
                    "px-2 py-2 border text-[10px] uppercase tracking-widest text-left transition-colors",
                    v === verb
                      ? "border-phos text-phos phos-glow-soft bg-phos/10"
                      : "border-ink-tertiary text-ink-secondary hover:text-phos hover:border-phos-dim",
                  )}
                >
                  {VERB_CMD[v]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-ink-secondary">
            $ amount
          </span>
          <TerminalInput
            value={amount}
            onChange={(e) => setAmount(sanitize(e.target.value))}
            placeholder="0.00"
            inputMode="decimal"
            suffix={unit}
          />
        </div>

        {extraSummary && amountValid && extraSummary(amountNum)}

        {invalidReason && (
          <div className="font-mono text-[11px] text-crit border border-crit/40 bg-crit/5 px-3 py-2">
            ! {invalidReason}
          </div>
        )}

        {(pendingStep || stepError) && (
          <div className="font-mono text-[11px] leading-snug min-h-[14px]">
            {stepError ? (
              <span className="text-crit">[error] {stepError}</span>
            ) : busyHere ? (
              <span className="text-ink-secondary">
                <span className="text-phos">&gt;</span> {pendingStep}
                <span className="animate-blink-hard">█</span>
              </span>
            ) : null}
          </div>
        )}

        <div className="pt-2 flex gap-3">
          <TerminalButton
            variant="primary"
            glitch
            disabled={disabled}
            onClick={async () => {
              const ok = await allocate(verb, amount, { assetSymbol });
              if (ok) setAmount(""); // clear on success only
            }}
          >
            {busyHere ? "PROCESSING…" : VERB_CMD[verb].toUpperCase()}
          </TerminalButton>
          <TerminalButton
            variant="ghost"
            onClick={() => setAmount("")}
            disabled={busy || !amount}
          >
            CLEAR
          </TerminalButton>
        </div>
      </div>
    </AsciiCard>
  );
}

export function SummaryRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 font-mono text-[11px]">
      <span className="text-ink-tertiary uppercase tracking-widest">{label}</span>
      <span className="flex-1 text-ink-tertiary overflow-hidden">
        {"────────────────────────".slice(0, Math.max(0, 24 - label.length))}
      </span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "text-phos phos-glow-soft" : "text-ink-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function DiffSummary({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-ink-tertiary bg-bg px-4 py-3 flex flex-col gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export { formatAmount };
