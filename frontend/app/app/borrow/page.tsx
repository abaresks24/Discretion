"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { WalletGate } from "@/components/WalletGate";
import { ScreenShell } from "@/components/app/ScreenShell";
import { ActionForm, DiffSummary, SummaryRow } from "@/components/app/ActionForm";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { TokenSelector } from "@/components/primitives/TokenSelector";
import { useDecryptedPosition } from "@/hooks/useDecryptedPosition";
import { useAssetPrices } from "@/hooks/useAssetPrices";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { COLLATERAL_ASSETS, ASSETS } from "@/lib/assets";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function BorrowPage() {
  return (
    <WalletGate>
      <BorrowScreen />
    </WalletGate>
  );
}

function BorrowScreen() {
  const [collatSymbol, setCollatSymbol] = useState(COLLATERAL_ASSETS[0].symbol);
  const collat = ASSETS[collatSymbol];

  const pos = useDecryptedPosition();
  const { priceOf } = useAssetPrices();
  const { data: borrowRateBps } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "borrowRateBps",
  });
  const apr = borrowRateBps !== undefined ? Number(borrowRateBps) / 100 : 0;

  const step1Done = pos.weightedCollatUsd > 0;
  const headroomUsd = Math.max(0, pos.weightedCollatUsd - pos.debtAmount);

  const collatRow = pos.collateralByAsset.find(
    (c) => c.asset.symbol === collatSymbol,
  );
  const currentCollatAmount = collatRow?.amount ?? 0;

  return (
    <ScreenShell
      tag="/borrow"
      title="borrow against collateral."
      subtitle={`${COLLATERAL_ASSETS.length} collateral assets · debt in ${ASSETS.USDC.symbol}`}
      trailing={
        <div className="font-mono text-[11px] text-ink-tertiary uppercase tracking-widest">
          borrow apr{" "}
          <span className="text-amber phos-glow-soft tabular-nums">
            {formatAmount(apr, 2)}%
          </span>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <StepHeader
            n="01"
            title="LOCK COLLATERAL"
            state={step1Done ? "done" : "active"}
            hint="pick a collateral type. its plaintext token is wrapped to a confidential ERC-7984 then locked in the vault."
          />
          <TokenSelector
            assets={COLLATERAL_ASSETS}
            value={collatSymbol}
            onChange={setCollatSymbol}
          />
          <ActionForm
            title={`lock ${collat.symbol.toLowerCase()} collateral`}
            verbs={["Deposit"]}
            unit={collat.symbol.toLowerCase()}
            allowMixer
            mixerAllowedForAsset={collat.hasMixer}
            assetSymbol={collat.symbol}
            extraSummary={(n) => {
              const newAmount = currentCollatAmount + n;
              const priceUsd = priceOf(collat.symbol);
              const newValueUsd = newAmount * priceUsd;
              const maxBorrowDelta = (n * priceUsd * collat.ltvBps) / 10000;
              return (
                <DiffSummary>
                  <SummaryRow
                    label={`${collat.symbol} now`}
                    value={`${formatAmount(currentCollatAmount, 4)} ${collat.symbol}`}
                  />
                  <SummaryRow
                    label="adding"
                    value={`+ ${formatAmount(n, 4)} ${collat.symbol}`}
                    emphasis
                  />
                  <SummaryRow
                    label="≈ value"
                    value={`${formatAmount(newValueUsd, 2)} USD`}
                  />
                  <SummaryRow
                    label="extra borrow capacity"
                    value={`+ ${formatAmount(maxBorrowDelta, 2)} USDC`}
                    emphasis
                  />
                </DiffSummary>
              );
            }}
          />

          <StepHeader
            n="02"
            title="DRAW DEBT"
            state={step1Done ? "active" : "locked"}
            hint={
              step1Done
                ? `borrow USDC up to your weighted LTV cap. you can repay anytime to free collateral.`
                : "step 2 unlocks once you have collateral posted in any of the supported assets."
            }
          />
          {step1Done ? (
            <ActionForm
              title="borrow cusdc"
              verbs={["Borrow"]}
              unit="usdc"
              extraSummary={(n) => {
                const nextDebt = pos.debtAmount + n;
                const ltvNext =
                  pos.totalCollatUsd > 0
                    ? Math.min((nextDebt / pos.totalCollatUsd) * 100, 999)
                    : 0;
                const overMax = nextDebt > pos.weightedCollatUsd;
                return (
                  <DiffSummary>
                    <SummaryRow
                      label="current debt"
                      value={`${formatAmount(pos.debtAmount, 2)} USDC`}
                    />
                    <SummaryRow
                      label="borrowing"
                      value={`+ ${formatAmount(n, 2)} USDC`}
                      emphasis
                    />
                    <SummaryRow
                      label="projected ltv"
                      value={`${formatAmount(ltvNext, 2)}%`}
                      emphasis
                    />
                    <SummaryRow
                      label="headroom"
                      value={`${formatAmount(Math.max(0, pos.weightedCollatUsd - nextDebt), 2)} USDC`}
                    />
                    {overMax && (
                      <div className="mt-1 text-[10px] text-crit font-mono">
                        ! exceeds weighted LTV cap — frontend safeguard.
                      </div>
                    )}
                  </DiffSummary>
                );
              }}
            />
          ) : (
            <AsciiCard title="borrow cusdc">
              <div className="font-mono text-[11px] text-ink-tertiary">
                <span className="text-ink-secondary">[locked]</span> post
                collateral first — this step is disabled until your weighted
                collateral value is greater than zero.
              </div>
            </AsciiCard>
          )}
        </div>

        <aside className="space-y-4">
          <AsciiCard title="position">
            <div className="space-y-2 font-mono text-[11px]">
              {pos.collateralByAsset.map((c) => (
                <Row
                  key={c.asset.symbol}
                  label={c.asset.symbol}
                  value={`${formatAmount(c.amount, 4)} (${formatAmount(c.valueUsd, 0)} USD)`}
                />
              ))}
              <div className="border-t border-dashed border-ink-tertiary/60 my-1" />
              <Row
                label="total collat"
                value={`${formatAmount(pos.totalCollatUsd, 2)} USD`}
              />
              <Row
                label="weighted"
                value={`${formatAmount(pos.weightedCollatUsd, 2)} USD`}
                accent="phos"
              />
              <Row label="debt" value={`${formatAmount(pos.debtAmount, 2)} USDC`} />
              <Row label="ltv" value={`${formatAmount(pos.ltvPct, 2)}%`} />
              <Row
                label="headroom"
                value={`${formatAmount(headroomUsd, 2)} USDC`}
                accent="phos"
              />
            </div>
          </AsciiCard>

          <AsciiCard title="rules">
            <ul className="font-mono text-[11px] text-ink-tertiary space-y-1.5">
              <li>▸ per-asset LTV caps · weighted</li>
              <li>▸ liquidation at LTV: <span className="text-crit">85%</span></li>
              <li>▸ liquidation bonus: <span className="text-amber">5%</span></li>
              <li>▸ amounts encrypted (ERC-7984)</li>
            </ul>
          </AsciiCard>

          <div className="border-l-2 border-amber pl-3 py-1 bg-amber/5">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber/70 mb-1">
              ! safety
            </div>
            <div className="font-mono text-[11px] text-ink-secondary leading-relaxed">
              Multi-collat means your borrow capacity is the sum of (asset
              value × asset LTV). If one asset's price drops, your headroom
              shrinks proportional to its share.
            </div>
          </div>
        </aside>
      </div>
    </ScreenShell>
  );
}

function StepHeader({
  n,
  title,
  state,
  hint,
}: {
  n: string;
  title: string;
  state: "active" | "done" | "locked";
  hint: string;
}) {
  const color =
    state === "done"
      ? "text-phos border-phos"
      : state === "active"
        ? "text-ink-primary border-ink-tertiary"
        : "text-ink-tertiary border-ink-tertiary";
  const badge = state === "done" ? "[ok]" : state === "active" ? "[ →]" : "[--]";
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "shrink-0 font-mono text-[10px] px-2 py-0.5 border",
          color,
        )}
      >
        {n} {badge}
      </span>
      <div className="min-w-0">
        <div className="font-mono text-[12px] uppercase tracking-[0.18em] text-ink-primary">
          {title}
        </div>
        <div className="font-mono text-[11px] text-ink-tertiary mt-0.5">
          # {hint}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "phos" | "amber" | "crit";
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-ink-tertiary uppercase tracking-widest">{label}</span>
      <span className="flex-1 text-ink-tertiary overflow-hidden">
        {"────────────────────────".slice(0, Math.max(0, 20 - label.length))}
      </span>
      <span
        className={cn(
          "tabular-nums",
          accent === "phos" && "text-phos",
          accent === "amber" && "text-amber",
          accent === "crit" && "text-crit",
          !accent && "text-ink-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

