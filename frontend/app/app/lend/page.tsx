"use client";

import { useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useViewKey } from "@/context/ViewKeyContext";
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
  return <LendScreen />;
}

// cUSDC native decimals (6).
const USDC_DEC = 6;

function LendScreen() {
  const [tab, setTab] = useState<Tab>("supply");
  const { isConnected } = useAccount();
  const { viewKey } = useViewKey();
  const authenticated = isConnected && !!viewKey;

  const { data } = useReadContracts({
    contracts: [
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "supplyRateBps" },
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "utilizationBps" },
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "totalDebt" },
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "totalSupplied" },
    ],
    query: { refetchInterval: 20_000 },
  });
  const apr = data?.[0]?.result !== undefined ? Number(data[0].result) / 100 : 0;
  const util = data?.[1]?.result !== undefined ? Number(data[1].result) / 100 : 0;
  const totalDebt =
    data?.[2]?.result !== undefined ? Number(data[2].result) / 10 ** USDC_DEC : 0;
  const totalSupplied =
    data?.[3]?.result !== undefined ? Number(data[3].result) / 10 ** USDC_DEC : 0;
  const poolAvailable = Math.max(0, totalSupplied - totalDebt);

  return (
    <ScreenShell
      tag="/lend"
      title="lend."
      trailing={
        <div className="font-mono text-[11px] text-ink-tertiary uppercase tracking-widest">
          apr{" "}
          <span className="text-phos phos-glow tabular-nums">
            {formatAmount(apr, 2)}%
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Public pool stats — always visible, no wallet needed */}
        <PublicPool
          apr={apr}
          util={util}
          totalSupplied={totalSupplied}
          poolAvailable={poolAvailable}
        />

        {/* Action area — gated. WalletGate handles its own header text. */}
        <WalletGate>
          <ActionsArea
            tab={tab}
            setTab={setTab}
            apr={apr}
            authenticated={authenticated}
            poolAvailable={poolAvailable}
          />
        </WalletGate>
      </div>
    </ScreenShell>
  );
}

function PublicPool({
  apr,
  util,
  totalSupplied,
  poolAvailable,
}: {
  apr: number;
  util: number;
  totalSupplied: number;
  poolAvailable: number;
}) {
  return (
    <AsciiCard title="pool">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
        <Stat label="supply apr" value={`${formatAmount(apr, 2)}%`} accent="phos" />
        <Stat label="utilization" value={`${formatAmount(util, 1)}%`} />
        <Stat
          label="supplied"
          value={`${formatAmount(totalSupplied, 2)} USDC`}
        />
        <Stat
          label="available now"
          value={`${formatAmount(poolAvailable, 2)} USDC`}
          accent="phos"
        />
      </div>
    </AsciiCard>
  );
}

function ActionsArea({
  tab,
  setTab,
  apr,
  authenticated,
  poolAvailable,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  apr: number;
  authenticated: boolean;
  poolAvailable: number;
}) {
  const { lenderAmount } = useDecryptedPosition();
  const maxWithdraw = Math.min(lenderAmount, poolAvailable);

  return (
    <div className="flex flex-col gap-3">
      {authenticated && (
        <AsciiCard title="your position">
          <div className="grid grid-cols-2 gap-x-6">
            <Stat
              label="your supply"
              value={`${formatAmount(lenderAmount, 2)} USDC`}
              accent="phos"
            />
            <Stat
              label="projected 1y"
              value={`+ ${formatAmount((lenderAmount * apr) / 100, 2)} USDC`}
            />
          </div>
        </AsciiCard>
      )}

      <div className="flex gap-1 font-mono text-[11px]">
        <TabButton active={tab === "supply"} onClick={() => setTab("supply")}>
          supply
        </TabButton>
        <TabButton active={tab === "withdraw"} onClick={() => setTab("withdraw")}>
          withdraw
        </TabButton>
      </div>

      {tab === "supply" ? (
        <ActionForm
          title="supply usdc"
          verbs={["Supply"]}
          unit="usdc"
          extraSummary={(n) => (
            <DiffSummary>
              <SummaryRow
                label="new supply"
                value={`${formatAmount(lenderAmount + n, 2)} USDC`}
                emphasis
              />
              <SummaryRow
                label="1y @ apr"
                value={`+ ${formatAmount(((lenderAmount + n) * apr) / 100, 2)} USDC`}
              />
            </DiffSummary>
          )}
        />
      ) : (
        <ActionForm
          title="withdraw"
          verbs={["Unsupply"]}
          unit="usdc"
          invalid={(n) => {
            if (n > lenderAmount) {
              return `exceeds your supply (${formatAmount(lenderAmount, 2)} USDC)`;
            }
            if (n > poolAvailable) {
              return `pool only has ${formatAmount(
                poolAvailable,
                2,
              )} USDC available — ${formatAmount(
                Math.max(0, n - poolAvailable),
                2,
              )} USDC is currently borrowed and locked until repaid`;
            }
            return null;
          }}
          extraSummary={(n) => (
            <DiffSummary>
              <SummaryRow
                label="max withdrawable now"
                value={`${formatAmount(maxWithdraw, 2)} USDC`}
              />
              <SummaryRow
                label="remaining supply after"
                value={`${formatAmount(Math.max(0, lenderAmount - n), 2)} USDC`}
                emphasis
              />
            </DiffSummary>
          )}
        />
      )}
    </div>
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
    <div className="flex flex-col gap-0.5 font-mono">
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
