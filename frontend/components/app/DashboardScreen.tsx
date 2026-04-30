"use client";

import Link from "next/link";
import { useReadContracts } from "wagmi";
import { AsciiCard } from "../primitives/AsciiCard";
import { StatDisplay } from "../primitives/StatDisplay";
import { ScreenShell } from "./ScreenShell";
import { ActivityLog } from "./ActivityLog";
import { useDecryptedPosition } from "@/hooks/useDecryptedPosition";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/cn";

export function DashboardScreen() {
  const pos = useDecryptedPosition();
  const hasBorrow = pos.collateralAmount > 0 || pos.debtAmount > 0;
  const hasSupply = pos.lenderAmount > 0;
  const hasPosition = hasBorrow || hasSupply;

  const { data: rates } = useReadContracts({
    contracts: [
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "borrowRateBps" },
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "supplyRateBps" },
      { address: env.VAULT_ADDRESS, abi: vaultAbi, functionName: "utilizationBps" },
    ],
    query: { refetchInterval: 20_000 },
  });
  const borrowApr = rates?.[0]?.result !== undefined ? Number(rates[0].result) / 100 : 0;
  const supplyApr = rates?.[1]?.result !== undefined ? Number(rates[1].result) / 100 : 0;
  const util = rates?.[2]?.result !== undefined ? Number(rates[2].result) / 100 : 0;

  return (
    <ScreenShell
      tag="dashboard"
      title="welcome to discretion."
      subtitle="private lending on arbitrum · sealed · attested · yours"
    >
      <div className="space-y-8 pb-8">
        {!hasPosition && <IntroBanner />}

        <section>
          <SectionHeader index="01" title="CHOOSE A PATH" />
          <div className="grid gap-4 md:grid-cols-3 mt-3">
            <PathCard
              href="/app/borrow"
              tag="[a]"
              title="BORROW"
              tagline="lock cRLC → draw private cUSDC"
              body="Post RLC as confidential collateral, borrow USDC up to 75% LTV. Two-step flow with clear guardrails."
              footer={`borrow apr · ${formatAmount(borrowApr, 2)}%`}
              accent="amber"
            />
            <PathCard
              href="/app/lend"
              tag="[b]"
              title="LEND"
              tagline="supply cUSDC → earn from borrowers"
              body="Single-step. No collateral needed. Your supplied USDC is lent to borrowers and earns yield proportional to utilisation."
              footer={`supply apr · ${formatAmount(supplyApr, 2)}%`}
              accent="phos"
            />
            <PathCard
              href="/app/learn"
              tag="[c]"
              title="LEARN"
              tagline="understand confidential defi"
              body="ERC-7984, FHE handles, TDX enclaves, LTV mechanics. Everything explained in 6 short modules. Start here if you are new."
              footer="6 modules · no jargon"
              accent="ink"
            />
          </div>
        </section>

        {hasPosition && (
          <section>
            <SectionHeader index="02" title="YOUR POSITION" />
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mt-3">
              <AsciiCard title="total collat">
                <StatDisplay
                  label="usd"
                  value={formatAmount(pos.totalCollatUsd, 2)}
                  unit="USD"
                  masked
                />
              </AsciiCard>
              <AsciiCard title="debt">
                <StatDisplay
                  label="usdc"
                  value={formatAmount(pos.debtAmount, 2)}
                  unit="USDC"
                  masked
                />
              </AsciiCard>
              <AsciiCard title="supplied">
                <StatDisplay
                  label="usdc"
                  value={formatAmount(pos.lenderAmount, 2)}
                  unit="USDC"
                  masked
                />
              </AsciiCard>
              <AsciiCard title="ltv">
                <StatDisplay
                  label="%"
                  value={formatAmount(pos.ltvPct, 2)}
                  unit="%"
                />
              </AsciiCard>
            </div>
            {pos.collateralByAsset.some((c) => c.amount > 0) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {pos.collateralByAsset
                  .filter((c) => c.amount > 0)
                  .map((c) => (
                    <AsciiCard key={c.asset.symbol} title={`collat · ${c.asset.symbol.toLowerCase()}`}>
                      <StatDisplay
                        label={c.asset.symbol.toLowerCase()}
                        value={formatAmount(c.amount, 4)}
                        unit={c.asset.symbol}
                        masked
                      />
                      <div className="font-mono text-[10px] text-ink-tertiary mt-1">
                        ≈ {formatAmount(c.valueUsd, 2)} USD · ltv {(c.asset.ltvBps / 100).toFixed(0)}%
                      </div>
                    </AsciiCard>
                  ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[11px]">
              {hasBorrow && (
                <QuickLink href="/app/manage">▸ manage position</QuickLink>
              )}
              {hasBorrow && <QuickLink href="/app/borrow">▸ borrow more</QuickLink>}
              {hasSupply && (
                <QuickLink href="/app/lend">▸ withdraw supply</QuickLink>
              )}
            </div>
          </section>
        )}

        <section>
          <SectionHeader index={hasPosition ? "03" : "02"} title="MARKET" />
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mt-3">
            <AsciiCard title="borrow apr">
              <div className="font-mono text-2xl text-amber phos-glow-soft tabular-nums">
                {formatAmount(borrowApr, 2)}%
              </div>
              <div className="text-[10px] text-ink-tertiary mt-1 uppercase tracking-widest">
                set by rate-engine · kinked curve
              </div>
            </AsciiCard>
            <AsciiCard title="supply apr">
              <div className="font-mono text-2xl text-phos phos-glow tabular-nums">
                {formatAmount(supplyApr, 2)}%
              </div>
              <div className="text-[10px] text-ink-tertiary mt-1 uppercase tracking-widest">
                earned by liquidity providers
              </div>
            </AsciiCard>
            <AsciiCard title="utilization">
              <div className="font-mono text-2xl text-ink-primary tabular-nums">
                {formatAmount(util, 1)}%
              </div>
              <div className="text-[10px] text-ink-tertiary mt-1 uppercase tracking-widest">
                last reported to the vault
              </div>
            </AsciiCard>
          </div>
        </section>

        <section>
          <SectionHeader index={hasPosition ? "04" : "03"} title="RECENT ACTIVITY" />
          <div className="mt-3">
            <AsciiCard title="event log">
              <ActivityLog limit={8} />
            </AsciiCard>
          </div>
        </section>
      </div>
    </ScreenShell>
  );
}

function IntroBanner() {
  return (
    <div className="border border-dashed border-phos/50 bg-phos/5 px-4 py-4 font-mono text-[12px] leading-relaxed text-ink-secondary">
      <div className="text-[10px] uppercase tracking-[0.25em] text-phos mb-1">
        ▸ first time here?
      </div>
      <p className="text-ink-primary">
        Discretion is a private lending vault — your balances stay encrypted
        on-chain.
      </p>
      <p className="mt-1.5">
        You don&apos;t post collateral unless you borrow. Two flows:{" "}
        <Link href="/app/borrow" className="cursor-target text-phos hover:underline">
          /borrow
        </Link>{" "}
        to draw a private loan, or{" "}
        <Link href="/app/lend" className="cursor-target text-phos hover:underline">
          /lend
        </Link>{" "}
        to earn yield. Start with{" "}
        <Link href="/app/learn" className="cursor-target text-phos hover:underline">
          /learn
        </Link>{" "}
        if you want the theory first.
      </p>
    </div>
  );
}

function SectionHeader({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px]">
      <span className="text-ink-tertiary">[{index}]</span>
      <span className="uppercase tracking-[0.22em] text-ink-primary">
        {title}
      </span>
      <span className="flex-1 border-t border-dashed border-ink-tertiary/50" />
    </div>
  );
}

function PathCard({
  href,
  tag,
  title,
  tagline,
  body,
  footer,
  accent,
}: {
  href: string;
  tag: string;
  title: string;
  tagline: string;
  body: string;
  footer: string;
  accent: "phos" | "amber" | "ink";
}) {
  const color =
    accent === "phos"
      ? "text-phos"
      : accent === "amber"
        ? "text-amber"
        : "text-ink-primary";
  const border =
    accent === "phos"
      ? "hover:border-phos"
      : accent === "amber"
        ? "hover:border-amber"
        : "hover:border-ink-secondary";
  return (
    <Link
      href={href}
      className={cn(
        "cursor-target block bg-bg-raised border border-ink-tertiary p-4 transition-colors",
        border,
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] text-ink-tertiary">{tag}</span>
        <span className={cn("font-mono text-[13px] uppercase tracking-[0.2em]", color)}>
          {title}
        </span>
      </div>
      <div className="font-mono text-[11px] text-ink-tertiary mt-1 uppercase tracking-widest">
        # {tagline}
      </div>
      <p className="font-mono text-[11.5px] text-ink-secondary mt-3 leading-relaxed">
        {body}
      </p>
      <div className="font-mono text-[10.5px] text-ink-tertiary mt-4 pt-2 border-t border-dashed border-ink-tertiary/60">
        {footer}
      </div>
    </Link>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="cursor-target px-3 py-1.5 border border-ink-tertiary text-ink-secondary hover:text-phos hover:border-phos-dim transition-colors uppercase tracking-[0.15em]"
    >
      {children}
    </Link>
  );
}
