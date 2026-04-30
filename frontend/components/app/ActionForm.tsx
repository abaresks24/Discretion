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
  allowMixer?: boolean;
  /** When set, the form passes this asset symbol to `allocate({assetSymbol})`. */
  assetSymbol?: string;
  /** Hide the mixer checkbox unless asset.hasMixer (controlled by the page). */
  mixerAllowedForAsset?: boolean;
  extraBanner?: React.ReactNode;
  extraSummary?: (amountNum: number) => React.ReactNode;
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
  allowMixer = false,
  assetSymbol,
  mixerAllowedForAsset = true,
  extraBanner,
  extraSummary,
}: ActionFormProps) {
  const [verb, setVerb] = useState<Verb>(verbs[0]);
  const [amount, setAmount] = useState("");
  const [useMixer, setUseMixer] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { allocate, pendingVerb, pendingStep, stepError, busy } = useAllocate();

  const amountNum = Number(amount);
  const disabled = busy || !amount || !Number.isFinite(amountNum) || amountNum <= 0;

  // Reset confirmation step whenever the user changes anything.
  function resetConfirm() {
    if (confirming) setConfirming(false);
  }

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
            onChange={(e) => {
              setAmount(sanitize(e.target.value));
              resetConfirm();
            }}
            placeholder="0.00"
            inputMode="decimal"
            suffix={unit}
          />
        </div>

        {extraSummary && amountNum > 0 && extraSummary(amountNum)}

        {allowMixer && mixerAllowedForAsset && verb === "Deposit" && (
          <label
            className={cn(
              "flex items-start gap-2 text-[11px] font-mono select-none cursor-pointer",
              "border border-dashed border-ink-tertiary px-3 py-2 transition-colors",
              useMixer ? "border-phos text-phos" : "text-ink-tertiary hover:text-ink-secondary",
            )}
          >
            <input
              type="checkbox"
              checked={useMixer}
              onChange={(e) => setUseMixer(e.target.checked)}
              className="mt-0.5 accent-phos"
            />
            <span>
              <span className="text-ink-secondary">wrap via tee mixer</span>
              <span className="block text-[10px] text-ink-tertiary mt-0.5">
                # rlc → wrap_queue → iApp batches on iExec tdx → cRLC to you
                <br />
                # breaks wrap/deposit timing correlation. 2–5 min.
              </span>
            </span>
          </label>
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

        {confirming && !busyHere && (
          <ConfirmReview
            verb={verb}
            verbCmd={VERB_CMD[verb]}
            amount={amount}
            unit={unit}
            assetSymbol={assetSymbol}
            useMixer={allowMixer && mixerAllowedForAsset && useMixer}
          />
        )}

        <div className="pt-2 flex gap-3">
          <TerminalButton
            variant="primary"
            glitch
            disabled={disabled}
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              setConfirming(false);
              allocate(verb, amount, {
                mixer: allowMixer && mixerAllowedForAsset && useMixer,
                assetSymbol,
              });
            }}
          >
            {busyHere
              ? "PROCESSING…"
              : confirming
                ? `SIGN ${VERB_CMD[verb].toUpperCase()}`
                : `REVIEW ${VERB_CMD[verb].toUpperCase()}`}
          </TerminalButton>
          <TerminalButton
            variant="ghost"
            onClick={() => {
              if (confirming) setConfirming(false);
              else setAmount("");
            }}
            disabled={busy}
          >
            {confirming ? "BACK" : "CLEAR"}
          </TerminalButton>
        </div>
      </div>
    </AsciiCard>
  );
}

/**
 * Two-stage confirmation: lists the on-chain steps the pipeline will take
 * before the user signs anything. Surfaces the `useAllocate` flow that is
 * otherwise hidden in the hook.
 */
function ConfirmReview({
  verb,
  verbCmd,
  amount,
  unit,
  assetSymbol,
  useMixer,
}: {
  verb: Verb;
  verbCmd: string;
  amount: string;
  unit: string;
  assetSymbol?: string;
  useMixer: boolean;
}) {
  const sym = assetSymbol ?? unit.toUpperCase();
  const cSym = `c${sym.toLowerCase()}`;

  // Per-verb pipeline. We can't introspect useAllocate directly (its
  // approve/wrap branches depend on live allowance/balance reads at
  // runtime), so this is the worst-case enumeration — confirms what the
  // user might see in MetaMask popups.
  const steps =
    verb === "Deposit"
      ? useMixer
        ? [
            "approve plaintext token → wrap_queue (one-time)",
            `queueWrap(${amount} ${sym}) → tee batch (2-5 min)`,
          ]
        : [
            `approve ${sym} → ${cSym} wrapper (one-time, if needed)`,
            `wrap(${amount} ${sym}) → ${cSym}`,
            "setOperator vault on cToken (one-time, if needed)",
            `depositCollateral(${sym}, encrypted ${amount})`,
          ]
      : verb === "Withdraw"
        ? [`encrypt amount`, `withdrawCollateral(${sym}, encrypted ${amount})`]
        : verb === "Borrow"
          ? [`encrypt amount`, `borrow(encrypted ${amount} ${sym})`]
          : verb === "Settle"
            ? [
                `approve ${sym} → ${cSym} wrapper (one-time, if needed)`,
                `wrap if cBalance < amount`,
                "setOperator vault on cToken (one-time, if needed)",
                `repay(encrypted ${amount} ${sym})`,
              ]
            : verb === "Supply"
              ? [
                  `approve ${sym} → ${cSym} wrapper (one-time, if needed)`,
                  `wrap if cBalance < amount`,
                  "setOperator vault on cToken (one-time, if needed)",
                  `supplyLiquidity(encrypted ${amount} ${sym})`,
                ]
              : [`encrypt amount`, `withdrawLiquidity(encrypted ${amount} ${sym})`];

  return (
    <div className="border border-amber/60 bg-amber/5 px-3 py-3 font-mono text-[11px] text-ink-secondary">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-amber mb-2">
        <span>! review pipeline</span>
        <span className="flex-1 border-t border-dashed border-amber/30" />
      </div>
      <div className="text-ink-tertiary mb-2">
        # you are about to <span className="text-amber">{verbCmd}</span>{" "}
        <span className="text-ink-primary">{amount}</span>{" "}
        <span className="text-ink-primary">{sym}</span>
        {useMixer && (
          <span className="text-phos"> · via tdx mixer</span>
        )}
      </div>
      <ol className="space-y-1">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-amber/70 shrink-0 w-5">[{i + 1}]</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 text-[10px] text-ink-tertiary">
        # metamask will pop up{" "}
        <span className="text-amber">~{steps.length}</span> tx — only the
        first is needed for fresh wallets, subsequent depositors skip
        approve/setOperator.
      </div>
    </div>
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
