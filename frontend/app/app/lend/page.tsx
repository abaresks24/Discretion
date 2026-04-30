"use client";

import { useState } from "react";
import { useReadContracts } from "wagmi";
import { WalletGate } from "@/components/WalletGate";
import { ScreenShell } from "@/components/app/ScreenShell";
import { ActionForm, DiffSummary, SummaryRow } from "@/components/app/ActionForm";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { useDecryptedPosition } from "@/hooks/useDecryptedPosition";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/cn";

type Tab = "supply" | "withdraw";

export default function LendPage() {
  return (
    <WalletGate>
      <LendScreen />
    </WalletGate>
  );
}

function LendScreen() {
  const [tab, setTab] = useState<Tab>("supply");
  const { lenderAmount } = useDecryptedPosition();
  const { data } = useReadContracts({
    contracts: [
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "supplyRateBps" },
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "utilizationBps" },
    ],
    query: { refetchInterval: 20_000 },
  });
  const apr = data?.[0]?.result !== undefined ? Number(data[0].result) / 100 : 0;
  const util = data?.[1]?.result !== undefined ? Number(data[1].result) / 100 : 0;

  return (
    <ScreenShell
      tag="/lend"
      title="earn on idle usdc."
      subtitle="supply cUSDC · borrowers pay you · amounts stay encrypted"
      trailing={
        <div className="font-mono text-[11px] text-ink-tertiary uppercase tracking-widest">
          supply apr{" "}
          <span className="text-phos phos-glow tabular-nums">
            {formatAmount(apr, 2)}%
          </span>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <div className="flex gap-1 font-mono text-[11px]">
            <TabButton active={tab === "supply"} onClick={() => setTab("supply")}>
              [01] supply
            </TabButton>
            <TabButton
              active={tab === "withdraw"}
              onClick={() => setTab("withdraw")}
            >
              [02] withdraw
            </TabButton>
          </div>

          {tab === "supply" ? (
            <ActionForm
              title="supply cusdc"
              verbs={["Supply"]}
              unit="usdc"
              extraSummary={(n) => (
                <DiffSummary>
                  <SummaryRow
                    label="current supply"
                    value={`${formatAmount(lenderAmount, 2)} USDC`}
                  />
                  <SummaryRow
                    label="adding"
                    value={`+ ${formatAmount(n, 2)} USDC`}
                    emphasis
                  />
                  <SummaryRow
                    label="new supply"
                    value={`${formatAmount(lenderAmount + n, 2)} USDC`}
                  />
                  <SummaryRow
                    label="1y @ current apr"
                    value={`+ ${formatAmount(((lenderAmount + n) * apr) / 100, 2)} USDC`}
                    emphasis
                  />
                </DiffSummary>
              )}
            />
          ) : (
            <ActionForm
              title="withdraw liquidity"
              verbs={["Unsupply"]}
              unit="usdc"
              extraSummary={(n) => (
                <DiffSummary>
                  <SummaryRow
                    label="current supply"
                    value={`${formatAmount(lenderAmount, 2)} USDC`}
                  />
                  <SummaryRow
                    label="withdrawing"
                    value={`- ${formatAmount(n, 2)} USDC`}
                    emphasis
                  />
                  <SummaryRow
                    label="remaining"
                    value={`${formatAmount(Math.max(0, lenderAmount - n), 2)} USDC`}
                  />
                </DiffSummary>
              )}
            />
          )}
        </div>

        <aside className="space-y-4">
          <AsciiCard title="pool state">
            <div className="space-y-2 font-mono text-[11px]">
              <Row label="your supply" value={`${formatAmount(lenderAmount, 2)} USDC`} />
              <Row label="supply apr" value={`${formatAmount(apr, 2)}%`} accent="phos" />
              <Row label="utilization" value={`${formatAmount(util, 1)}%`} />
            </div>
          </AsciiCard>

          <AsciiCard title="how it works">
            <ul className="font-mono text-[11px] text-ink-tertiary space-y-1.5">
              <li>▸ cUSDC in the vault is lent to borrowers</li>
              <li>▸ shares tracked confidentially (ERC-7984)</li>
              <li>▸ kinked rate curve — APR rises with util</li>
              <li>▸ withdraw anytime subject to pool liquidity</li>
            </ul>
          </AsciiCard>

          <div className="border-l-2 border-phos pl-3 py-1 bg-phos/5">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-phos mb-1">
              i · note
            </div>
            <div className="font-mono text-[11px] text-ink-secondary leading-relaxed">
              supplying is a one-step flow — no collateral needed. you are
              the liquidity provider side of the market.
            </div>
          </div>
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
