"use client";

import { useState } from "react";
import { WalletGate } from "@/components/WalletGate";
import { ScreenShell } from "@/components/app/ScreenShell";
import { ActionForm, DiffSummary, SummaryRow } from "@/components/app/ActionForm";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { TokenSelector } from "@/components/primitives/TokenSelector";
import { useDecryptedPosition } from "@/hooks/useDecryptedPosition";
import { useAssetPrices } from "@/hooks/useAssetPrices";
import { COLLATERAL_ASSETS, ASSETS } from "@/lib/assets";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/cn";

type Tab = "add" | "repay" | "withdraw";

export default function ManagePage() {
  return (
    <WalletGate>
      <ManageScreen />
    </WalletGate>
  );
}

function ManageScreen() {
  const [tab, setTab] = useState<Tab>("repay");
  const [collatSymbol, setCollatSymbol] = useState(COLLATERAL_ASSETS[0].symbol);
  const collat = ASSETS[collatSymbol];

  const pos = useDecryptedPosition();
  const { priceOf } = useAssetPrices();
  const hasPosition = pos.totalCollatUsd > 0 || pos.debtAmount > 0;
  const zoneLabel = ["SAFE", "WATCH", "WARN", "LIQUIDATABLE"][pos.zone];
  const zoneColor =
    pos.zone === 0
      ? "text-phos"
      : pos.zone === 1
        ? "text-phos/70"
        : pos.zone === 2
          ? "text-amber"
          : "text-crit";

  const collatRow = pos.collateralByAsset.find(
    (c) => c.asset.symbol === collatSymbol,
  );
  const currentCollatAmount = collatRow?.amount ?? 0;
  const collatPriceUsd = priceOf(collatSymbol);

  return (
    <ScreenShell
      tag="/manage"
      title="adjust your position."
      subtitle="repay · adjust collateral per-asset · unwind"
      trailing={
        <div className="font-mono text-[11px] text-ink-tertiary uppercase tracking-widest">
          zone{" "}
          <span className={cn("tabular-nums", zoneColor)}>{zoneLabel}</span>
        </div>
      }
    >
      {!hasPosition && (
        <div className="mb-6 border border-dashed border-ink-tertiary px-4 py-4 font-mono text-[11.5px] text-ink-tertiary">
          # no position yet. head to{" "}
          <a href="/app/borrow" className="cursor-target text-phos hover:underline">
            /borrow
          </a>{" "}
          to open one, or{" "}
          <a href="/app/lend" className="cursor-target text-phos hover:underline">
            /lend
          </a>{" "}
          to supply liquidity.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <div className="flex gap-1 font-mono text-[11px]">
            <TabButton active={tab === "repay"} onClick={() => setTab("repay")}>
              [01] repay debt
            </TabButton>
            <TabButton active={tab === "add"} onClick={() => setTab("add")}>
              [02] add collat
            </TabButton>
            <TabButton
              active={tab === "withdraw"}
              onClick={() => setTab("withdraw")}
            >
              [03] withdraw collat
            </TabButton>
          </div>

          {tab === "repay" && (
            <ActionForm
              title="repay cusdc"
              verbs={["Settle"]}
              unit="usdc"
              extraSummary={(n) => {
                const nextDebt = Math.max(0, pos.debtAmount - n);
                const nextLtv =
                  pos.totalCollatUsd > 0
                    ? Math.min((nextDebt / pos.totalCollatUsd) * 100, 999)
                    : 0;
                return (
                  <DiffSummary>
                    <SummaryRow
                      label="current debt"
                      value={`${formatAmount(pos.debtAmount, 2)} USDC`}
                    />
                    <SummaryRow
                      label="repaying"
                      value={`- ${formatAmount(n, 2)} USDC`}
                      emphasis
                    />
                    <SummaryRow
                      label="remaining"
                      value={`${formatAmount(nextDebt, 2)} USDC`}
                    />
                    <SummaryRow
                      label="ltv after"
                      value={`${formatAmount(nextLtv, 2)}%`}
                      emphasis
                    />
                  </DiffSummary>
                );
              }}
            />
          )}

          {(tab === "add" || tab === "withdraw") && (
            <>
              <TokenSelector
                assets={COLLATERAL_ASSETS}
                value={collatSymbol}
                onChange={setCollatSymbol}
                label={`$ select asset to ${tab === "add" ? "add" : "withdraw"}`}
              />
              {tab === "add" ? (
                <ActionForm
                  title={`add ${collat.symbol.toLowerCase()} collateral`}
                  verbs={["Deposit"]}
                  unit={collat.symbol.toLowerCase()}
                  assetSymbol={collat.symbol}
                  extraSummary={(n) => {
                    const newAmount = currentCollatAmount + n;
                    const newValueUsd = newAmount * collatPriceUsd;
                    const nextTotalUsd = pos.totalCollatUsd + n * collatPriceUsd;
                    const nextLtv =
                      pos.debtAmount > 0 && nextTotalUsd > 0
                        ? Math.min((pos.debtAmount / nextTotalUsd) * 100, 999)
                        : 0;
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
                          label="≈ new value"
                          value={`${formatAmount(newValueUsd, 2)} USD`}
                        />
                        <SummaryRow
                          label="ltv after"
                          value={`${formatAmount(nextLtv, 2)}%`}
                          emphasis
                        />
                      </DiffSummary>
                    );
                  }}
                />
              ) : (
                <ActionForm
                  title={`withdraw ${collat.symbol.toLowerCase()} collateral`}
                  verbs={["Withdraw"]}
                  unit={collat.symbol.toLowerCase()}
                  assetSymbol={collat.symbol}
                  extraSummary={(n) => {
                    const newAmount = Math.max(0, currentCollatAmount - n);
                    const newValueUsd = newAmount * collatPriceUsd;
                    const nextTotalUsd = pos.totalCollatUsd - n * collatPriceUsd;
                    const nextLtv =
                      pos.debtAmount > 0 && nextTotalUsd > 0
                        ? Math.min((pos.debtAmount / nextTotalUsd) * 100, 999)
                        : 0;
                    const risky = nextLtv > 75;
                    return (
                      <DiffSummary>
                        <SummaryRow
                          label={`${collat.symbol} now`}
                          value={`${formatAmount(currentCollatAmount, 4)} ${collat.symbol}`}
                        />
                        <SummaryRow
                          label="withdrawing"
                          value={`- ${formatAmount(n, 4)} ${collat.symbol}`}
                          emphasis
                        />
                        <SummaryRow
                          label="remaining"
                          value={`${formatAmount(newAmount, 4)} ${collat.symbol}`}
                        />
                        <SummaryRow
                          label="≈ remaining value"
                          value={`${formatAmount(newValueUsd, 2)} USD`}
                        />
                        <SummaryRow
                          label="ltv after"
                          value={`${formatAmount(nextLtv, 2)}%`}
                          emphasis
                        />
                        {risky && (
                          <div className="mt-1 text-[10px] text-crit font-mono">
                            ! would push LTV above 75% borrow cap.
                          </div>
                        )}
                      </DiffSummary>
                    );
                  }}
                />
              )}
            </>
          )}
        </div>

        <aside className="space-y-4">
          <AsciiCard title="position by asset">
            <div className="space-y-2 font-mono text-[11px]">
              {pos.collateralByAsset.map((c) => (
                <div key={c.asset.symbol} className="flex items-baseline gap-3">
                  <span className="text-ink-tertiary uppercase tracking-widest">
                    {c.asset.symbol}
                  </span>
                  <span className="flex-1 text-ink-tertiary">
                    {"·".repeat(Math.max(0, 12 - c.asset.symbol.length))}
                  </span>
                  <span className="tabular-nums text-ink-primary">
                    {formatAmount(c.amount, 4)}
                  </span>
                </div>
              ))}
              <div className="border-t border-dashed border-ink-tertiary/60 my-1" />
              <Row label="debt" value={`${formatAmount(pos.debtAmount, 2)} USDC`} />
              <Row label="ltv" value={`${formatAmount(pos.ltvPct, 2)}%`} />
              <Row
                label="zone"
                value={zoneLabel}
                accent={pos.zone <= 1 ? "phos" : pos.zone === 2 ? "amber" : "crit"}
              />
            </div>
          </AsciiCard>

          <AsciiCard title="zone map">
            <ul className="font-mono text-[10.5px] space-y-1">
              <li className="flex justify-between">
                <span className="text-phos">▸ SAFE</span>
                <span className="text-ink-tertiary">ltv &lt; 60%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-phos/70">▸ WATCH</span>
                <span className="text-ink-tertiary">60–75%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-amber">▸ WARN</span>
                <span className="text-ink-tertiary">75–85%</span>
              </li>
              <li className="flex justify-between">
                <span className="text-crit">▸ LIQUIDATABLE</span>
                <span className="text-ink-tertiary">&ge; 85%</span>
              </li>
            </ul>
          </AsciiCard>
        </aside>
      </div>
    </ScreenShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-target px-3 py-1.5 uppercase tracking-[0.18em] border border-b-0 transition-colors",
        active
          ? "text-phos border-phos bg-phos/10 phos-glow-soft"
          : "text-ink-secondary border-ink-tertiary hover:text-phos hover:border-phos-dim",
      )}
    >
      {children}
    </button>
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

