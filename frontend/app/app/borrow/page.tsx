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
  return <BorrowScreen />;
}

function BorrowScreen() {
  const [collatSymbol, setCollatSymbol] = useState(COLLATERAL_ASSETS[0].symbol);
  const collat = ASSETS[collatSymbol];

  const { data: borrowRateBps } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "borrowRateBps",
  });
  const { data: utilBps } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "utilizationBps",
  });
  const apr = borrowRateBps !== undefined ? Number(borrowRateBps) / 100 : 0;
  const util = utilBps !== undefined ? Number(utilBps) / 100 : 0;

  return (
    <ScreenShell
      tag="/borrow"
      title="borrow."
      trailing={
        <div className="font-mono text-[11px] text-ink-tertiary uppercase tracking-widest">
          apr{" "}
          <span className="text-amber phos-glow-soft tabular-nums">
            {formatAmount(apr, 2)}%
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Public market stats — always visible. */}
        <AsciiCard title="market">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
            <Stat label="borrow apr" value={`${formatAmount(apr, 2)}%`} accent="amber" />
            <Stat label="utilization" value={`${formatAmount(util, 1)}%`} />
            <Stat label="debt asset" value="USDC" />
          </div>
        </AsciiCard>

        {/* Authenticated area — your position + actions */}
        <WalletGate>
          <AuthenticatedBorrow
            collat={collat}
            collatSymbol={collatSymbol}
            setCollatSymbol={setCollatSymbol}
          />
        </WalletGate>
      </div>
    </ScreenShell>
  );
}

function AuthenticatedBorrow({
  collat,
  collatSymbol,
  setCollatSymbol,
}: {
  collat: (typeof ASSETS)[string];
  collatSymbol: string;
  setCollatSymbol: (s: string) => void;
}) {
  const pos = useDecryptedPosition();
  const { priceOf } = useAssetPrices();

  const hasCollat = pos.weightedCollatUsd > 0;
  const headroomUsd = Math.max(0, pos.weightedCollatUsd - pos.debtAmount);

  const collatRow = pos.collateralByAsset.find(
    (c) => c.asset.symbol === collatSymbol,
  );
  const currentCollatAmount = collatRow?.amount ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Position summary */}
      <AsciiCard title="position">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          <Stat
            label="collateral"
            value={`${formatAmount(pos.totalCollatUsd, 2)} USD`}
          />
          <Stat
            label="capacity"
            value={`${formatAmount(pos.weightedCollatUsd, 2)} USD`}
            accent="phos"
          />
          <Stat label="debt" value={`${formatAmount(pos.debtAmount, 2)} USDC`} />
          <Stat
            label="headroom"
            value={`${formatAmount(headroomUsd, 2)} USDC`}
            accent="phos"
          />
        </div>
      </AsciiCard>

      <TokenSelector
        assets={COLLATERAL_ASSETS}
        value={collatSymbol}
        onChange={setCollatSymbol}
        label="$ collateral asset"
      />

      <div className="grid gap-4 lg:grid-cols-2 items-stretch">
        <ActionForm
          title={`lock ${collat.symbol.toLowerCase()} as collateral`}
          verbs={["Deposit"]}
          unit={collat.symbol.toLowerCase()}
          assetSymbol={collat.symbol}
          extraSummary={(n) => {
            const newAmount = currentCollatAmount + n;
            const priceUsd = priceOf(collat.symbol);
            const newValueUsd = newAmount * priceUsd;
            const maxBorrowDelta = (n * priceUsd * collat.ltvBps) / 10000;
            return (
              <DiffSummary>
                <SummaryRow
                  label={`${collat.symbol} after`}
                  value={`${formatAmount(newAmount, 4)} (${formatAmount(newValueUsd, 2)} USD)`}
                />
                <SummaryRow
                  label="extra capacity"
                  value={`+ ${formatAmount(maxBorrowDelta, 2)} USDC`}
                  emphasis
                />
              </DiffSummary>
            );
          }}
        />

        {hasCollat ? (
          <ActionForm
            title="borrow usdc"
            verbs={["Borrow"]}
            unit="usdc"
            invalid={(n) => {
              if (n + pos.debtAmount > pos.weightedCollatUsd) {
                return `exceeds borrow capacity by ${formatAmount(
                  n + pos.debtAmount - pos.weightedCollatUsd,
                  2,
                )} USDC`;
              }
              return null;
            }}
            extraSummary={(n) => {
              const nextDebt = pos.debtAmount + n;
              const ltvNext =
                pos.totalCollatUsd > 0
                  ? Math.min((nextDebt / pos.totalCollatUsd) * 100, 999)
                  : 0;
              return (
                <DiffSummary>
                  <SummaryRow
                    label="ltv after"
                    value={`${formatAmount(ltvNext, 2)}%`}
                    emphasis
                  />
                  <SummaryRow
                    label="headroom after"
                    value={`${formatAmount(Math.max(0, pos.weightedCollatUsd - nextDebt), 2)} USDC`}
                  />
                </DiffSummary>
              );
            }}
          />
        ) : (
          <AsciiCard title="borrow usdc" className="flex flex-col">
            <div className="font-mono text-[11px] text-ink-tertiary py-4 text-center">
              lock collateral first to unlock borrowing.
            </div>
          </AsciiCard>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "phos" | "amber" | "crit";
}) {
  return (
    <div className="flex flex-col gap-1 font-mono">
      <span className="text-[10px] uppercase tracking-[0.18em] text-ink-tertiary">
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums text-[15px]",
          accent === "phos" && "text-phos phos-glow-soft",
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
