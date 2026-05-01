"use client";

import { useEffect, useState } from "react";
import { WalletGate } from "@/components/WalletGate";
import { ScreenShell } from "@/components/app/ScreenShell";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { AnonymitySetViz } from "@/components/app/AnonymitySetViz";
import { publicClient } from "@/lib/publicClient";
import { wrapQueueAbi, unwrapQueueAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { ASSETS } from "@/lib/assets";
import { cn } from "@/lib/cn";

type QueueStats = { pending: number; lifetime: number };
type EntryStat = QueueStats & { label: string; address: `0x${string}` };

export default function MixPage() {
  return (
    <WalletGate>
      <MixScreen />
    </WalletGate>
  );
}

function MixScreen() {
  const [entries, setEntries] = useState<EntryStat[]>([]);
  const [exitStats, setExitStats] = useState<QueueStats>({ pending: 0, lifetime: 0 });
  const [countdown, setCountdown] = useState(30);

  // Build entry-mixer descriptors from the asset registry. Skips assets
  // without a deployed WrapQueue.
  const entryQueues: { label: string; address: `0x${string}` }[] = [
    {
      label: "RLC",
      address: ASSETS.RLC.wrapQueue ?? env.WRAP_QUEUE_ADDRESS,
    },
    {
      label: "WETH",
      address: ASSETS.WETH.wrapQueue ?? ("0x0" as `0x${string}`),
    },
    {
      label: "USDC",
      address: ASSETS.USDC.wrapQueue ?? ("0x0" as `0x${string}`),
    },
  ].filter((q) => q.address && /^0x[a-fA-F0-9]{40}$/.test(q.address) && q.address !== "0x0000000000000000000000000000000000000000");

  useEffect(() => {
    let cancelled = false;
    const safeRead = async (
      address: `0x${string}`,
      abi: typeof wrapQueueAbi | typeof unwrapQueueAbi,
    ): Promise<QueueStats> => {
      try {
        const [pending, total] = await Promise.all([
          publicClient.readContract({
            address,
            abi,
            functionName: "pendingIds",
            args: [0n, 100n],
          }) as Promise<readonly bigint[]>,
          publicClient.readContract({
            address,
            abi,
            functionName: "queueLength",
          }) as Promise<bigint>,
        ]);
        return { pending: pending.length, lifetime: Number(total) };
      } catch {
        return { pending: 0, lifetime: 0 };
      }
    };

    const poll = async () => {
      const entryResults = await Promise.all(
        entryQueues.map(async (q) => ({
          ...(await safeRead(q.address, wrapQueueAbi)),
          label: q.label,
          address: q.address,
        })),
      );
      const exit = await safeRead(env.UNWRAP_QUEUE_ADDRESS, unwrapQueueAbi);
      if (!cancelled) {
        setEntries(entryResults);
        setExitStats(exit);
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Keeper polls every 30s — show ticking countdown.
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => (c <= 0 ? 30 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const totalPending =
    entries.reduce((s, e) => s + e.pending, 0) + exitStats.pending;
  const minPending =
    entries.length > 0
      ? Math.min(...entries.map((e) => e.pending), exitStats.pending)
      : exitStats.pending;
  const score = Math.min(100, Math.round((minPending / 16) * 100));
  const scoreColor =
    score >= 75
      ? "text-phos"
      : score >= 40
        ? "text-amber"
        : score >= 1
          ? "text-amber/80"
          : "text-crit";
  const scoreLabel =
    score >= 75 ? "STRONG" : score >= 40 ? "DECENT" : score >= 1 ? "WEAK" : "EMPTY";

  return (
    <ScreenShell
      tag="/mix"
      title="anonymity set."
      subtitle="protocol-internal mixer · auto-applied to every supply / borrow / lock"
    >
      <div className="flex flex-col gap-4">
        {/* Top stats row */}
        <div className="grid gap-4 md:grid-cols-3">
          <AsciiCard title="privacy score" bodyClassName="text-center py-5">
            <div className={cn("font-mono text-5xl phos-glow tabular-nums", scoreColor)}>
              {score}
              <span className="text-2xl text-ink-tertiary">/100</span>
            </div>
            <div
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.25em] mt-1",
                scoreColor,
              )}
            >
              {scoreLabel}
            </div>
          </AsciiCard>

          <AsciiCard title="next batch" bodyClassName="text-center py-5">
            <div className="font-mono text-5xl text-phos phos-glow tabular-nums">
              {String(Math.floor(countdown)).padStart(2, "0")}
              <span className="text-2xl text-ink-tertiary">s</span>
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-ink-tertiary">
              keeper poll · auto-triggered
            </div>
          </AsciiCard>

          <AsciiCard title="total pending" bodyClassName="text-center py-5">
            <div className="font-mono text-5xl text-phos phos-glow tabular-nums">
              {totalPending}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-widest text-ink-tertiary">
              entries across all queues
            </div>
          </AsciiCard>
        </div>

        {/* Entry mixers grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <AsciiCard
              key={e.address}
              title={`entry · ${e.label} → c${e.label.toLowerCase()}`}
              bodyClassName="h-[170px] relative p-0 overflow-hidden"
            >
              <AnonymitySetViz count={Math.max(6, e.pending)} />
              <div className="absolute inset-0 flex items-end pointer-events-none">
                <div className="w-full px-4 py-3 bg-gradient-to-t from-bg to-transparent">
                  <div className="font-mono text-[10px] text-ink-tertiary uppercase tracking-widest">
                    pending
                  </div>
                  <div className="font-mono text-3xl text-phos phos-glow tabular-nums">
                    {e.pending}
                  </div>
                  <div className="font-mono text-[10px] text-ink-tertiary">
                    lifetime: {e.lifetime}
                  </div>
                </div>
              </div>
            </AsciiCard>
          ))}

          <AsciiCard
            title="exit · cUSDC → USDC"
            bodyClassName="h-[170px] relative p-0 overflow-hidden"
          >
            <AnonymitySetViz count={Math.max(6, exitStats.pending)} />
            <div className="absolute inset-0 flex items-end pointer-events-none">
              <div className="w-full px-4 py-3 bg-gradient-to-t from-bg to-transparent">
                <div className="font-mono text-[10px] text-ink-tertiary uppercase tracking-widest">
                  pending
                </div>
                <div className="font-mono text-3xl text-phos phos-glow tabular-nums">
                  {exitStats.pending}
                </div>
                <div className="font-mono text-[10px] text-ink-tertiary">
                  lifetime: {exitStats.lifetime}
                </div>
              </div>
            </div>
          </AsciiCard>
        </div>

        <div className="border-l-2 border-phos pl-3 py-1 bg-phos/5 font-mono text-[10.5px] text-ink-secondary">
          <div className="text-[10px] uppercase tracking-[0.25em] text-phos mb-1">
            i · how it works
          </div>
          every supply / lock / borrow that needs a wrap is automatically routed
          through the corresponding queue. a TEE keeper batches entries and
          fans the cTokens out — breaking the timing correlation between your
          plaintext tx and the on-chain effect.
        </div>
      </div>
    </ScreenShell>
  );
}
