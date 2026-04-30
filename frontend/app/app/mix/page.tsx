"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { WalletGate } from "@/components/WalletGate";
import { ScreenShell } from "@/components/app/ScreenShell";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { TerminalButton } from "@/components/primitives/TerminalButton";
import { TerminalInput } from "@/components/primitives/TerminalInput";
import { AnonymitySetViz } from "@/components/app/AnonymitySetViz";
import { publicClient } from "@/lib/publicClient";
import { wrapQueueAbi, unwrapQueueAbi, erc7984Abi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { useAllocate } from "@/hooks/useAllocate";
import { ASSETS, DEBT_ASSET } from "@/lib/assets";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/cn";

type QueueStats = { pending: number; lifetime: number };

export default function MixPage() {
  return (
    <WalletGate>
      <MixScreen />
    </WalletGate>
  );
}

function MixScreen() {
  const [wrap, setWrap] = useState<QueueStats>({ pending: 0, lifetime: 0 });
  const [unwrap, setUnwrap] = useState<QueueStats>({ pending: 0, lifetime: 0 });
  const [amount, setAmount] = useState("");
  const [countdown, setCountdown] = useState(300);
  const { allocate, pendingStep, stepError, busy, pendingVerb } = useAllocate();

  const sanitize = (raw: string) => {
    const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    return parts.length <= 1 ? cleaned : parts[0] + "." + parts.slice(1).join("");
  };

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
      const [w, u] = await Promise.all([
        safeRead(env.WRAP_QUEUE_ADDRESS, wrapQueueAbi),
        safeRead(env.UNWRAP_QUEUE_ADDRESS, unwrapQueueAbi),
      ]);
      if (!cancelled) {
        setWrap(w);
        setUnwrap(u);
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((c) => (c <= 0 ? 300 : c - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const mm = Math.floor(countdown / 60).toString().padStart(2, "0");
  const ss = (countdown % 60).toString().padStart(2, "0");

  const amountNum = Number(amount);
  const canJoin =
    !busy && amount && Number.isFinite(amountNum) && amountNum > 0;

  // Privacy score = function of the smaller pending pool. With 0 pending,
  // joining yields zero anonymity. Above 16 the curve flattens.
  const minPending = Math.min(wrap.pending, unwrap.pending);
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
    score >= 75
      ? "STRONG"
      : score >= 40
        ? "DECENT"
        : score >= 1
          ? "WEAK"
          : "EMPTY";

  return (
    <ScreenShell
      tag="/mix"
      title="anonymity set."
      subtitle="entry mixer (RLC) · exit mixer (USDC) · iapp batches in tdx"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <AsciiCard
            title="entry mixer · RLC → cRLC"
            bodyClassName="h-[200px] relative p-0 overflow-hidden"
          >
            <AnonymitySetViz count={Math.max(6, wrap.pending)} />
            <div className="absolute inset-0 flex items-end pointer-events-none">
              <div className="w-full px-4 py-3 bg-gradient-to-t from-bg to-transparent">
                <div className="font-mono text-[10px] text-ink-tertiary uppercase tracking-widest">
                  pending this round
                </div>
                <div className="font-mono text-3xl text-phos phos-glow tabular-nums">
                  {wrap.pending}
                </div>
                <div className="font-mono text-[10px] text-ink-tertiary">
                  lifetime: {wrap.lifetime} entries
                </div>
              </div>
            </div>
          </AsciiCard>

          <AsciiCard
            title="exit mixer · cUSDC → USDC"
            bodyClassName="h-[200px] relative p-0 overflow-hidden"
          >
            <AnonymitySetViz count={Math.max(6, unwrap.pending)} />
            <div className="absolute inset-0 flex items-end pointer-events-none">
              <div className="w-full px-4 py-3 bg-gradient-to-t from-bg to-transparent">
                <div className="font-mono text-[10px] text-ink-tertiary uppercase tracking-widest">
                  pending this round
                </div>
                <div className="font-mono text-3xl text-phos phos-glow tabular-nums">
                  {unwrap.pending}
                </div>
                <div className="font-mono text-[10px] text-ink-tertiary">
                  lifetime: {unwrap.lifetime} entries
                </div>
              </div>
            </div>
          </AsciiCard>
        </div>

        <div className="space-y-4">
          <AsciiCard title="privacy score" bodyClassName="text-center py-5">
            <div className={cn("font-mono text-5xl phos-glow tabular-nums", scoreColor)}>
              {score}
              <span className="text-2xl text-ink-tertiary">/100</span>
            </div>
            <div className={cn("font-mono text-[10px] uppercase tracking-[0.25em] mt-1", scoreColor)}>
              {scoreLabel}
            </div>
            <div className="font-mono text-[10px] text-ink-tertiary mt-3 leading-snug">
              # weighted by smaller of the two pools.
              <br /># 1-of-N effective anonymity = N-1 alibis per output.
            </div>
          </AsciiCard>

          <AsciiCard title="next round in" bodyClassName="text-center py-5">
            <div className="font-mono text-4xl text-phos phos-glow tabular-nums">
              {mm}
              <span className="animate-blink-hard">:</span>
              {ss}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-ink-tertiary">
              tdx batch · auto-triggered
            </div>
          </AsciiCard>

          <AsciiCard title="join entry mixer (RLC)">
            <div className="space-y-3">
              <TerminalInput
                value={amount}
                onChange={(e) => setAmount(sanitize(e.target.value))}
                placeholder="0.00"
                inputMode="decimal"
                suffix="rlc"
              />
              <div className="text-[11px] text-ink-tertiary font-mono">
                # queues {amountNum > 0 ? formatAmount(amountNum, 4) : "0"} rlc for the next batch
              </div>
              {(pendingStep || stepError) && (
                <div className="font-mono text-[11px] min-h-[14px]">
                  {stepError ? (
                    <span className="text-crit">[error] {stepError}</span>
                  ) : pendingVerb === "Deposit" ? (
                    <span className="text-ink-secondary">
                      <span className="text-phos">&gt;</span> {pendingStep}
                      <span className="animate-blink-hard">█</span>
                    </span>
                  ) : null}
                </div>
              )}
              <TerminalButton
                variant="primary"
                glitch
                disabled={!canJoin}
                onClick={() =>
                  allocate("Deposit", amount, {
                    mixer: true,
                    assetSymbol: "RLC",
                  })
                }
              >
                {busy ? "QUEUEING…" : "JOIN ROUND"}
              </TerminalButton>
            </div>
          </AsciiCard>

          <ExitMixerCard />


          <div className="border-l-2 border-phos pl-3 py-1 bg-phos/5 font-mono text-[10.5px] text-ink-secondary">
            <div className="text-[10px] uppercase tracking-[0.25em] text-phos mb-1">
              i · how it works
            </div>
            entry mixer breaks "wrap → deposit" timing.
            <br />
            exit mixer breaks "borrow → unwrap recipient" timing.
            <br />
            both signed by sealed TDX operator key — verifiable attestation
            on-chain.
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}

/**
 * Manual exit-mixer entry: queues a confidentialTransferFrom of cUSDC into
 * the UnwrapQueue for plaintext fan-out at the next batch. User must have
 * cUSDC in their wallet and have set the queue as their ERC-7984 operator.
 */
function ExitMixerCard() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sanitize = (raw: string) => {
    const cleaned = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    return parts.length <= 1 ? cleaned : parts[0] + "." + parts.slice(1).join("");
  };
  const amountNum = Number(amount);
  const destClean = destination.trim();
  const destValid = !destClean || /^0x[a-fA-F0-9]{40}$/.test(destClean);
  const canJoin =
    !busy && address && amount && Number.isFinite(amountNum) && amountNum > 0 && destValid;

  async function submit() {
    if (!address) return;
    setErr(null);
    setBusy(true);
    try {
      const cToken = ASSETS.USDC.cToken;
      const queueAddr = env.UNWRAP_QUEUE_ADDRESS;

      const isOp = (await publicClient.readContract({
        address: cToken,
        abi: erc7984Abi,
        functionName: "isOperator",
        args: [address, queueAddr],
      })) as boolean;
      if (!isOp) {
        setStep("granting unwrap-queue operator rights on cUSDC…");
        const until = Math.floor(Date.now() / 1000) + 60 * 60 * 6;
        await writeContractAsync({
          address: cToken,
          abi: erc7984Abi,
          functionName: "setOperator",
          args: [queueAddr, until],
        });
      }

      setStep("queueing exit for the next tdx batch…");
      const raw = parseUnits(amount, DEBT_ASSET.decimals);
      await writeContractAsync({
        address: queueAddr,
        abi: unwrapQueueAbi,
        functionName: "queueUnwrap",
        args: [raw, (destClean || address) as `0x${string}`],
        gas: 350_000n,
      });
      setStep("queued · plaintext usdc lands at destination after the batch");
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "tx failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AsciiCard title="join exit mixer (cUSDC → USDC)">
      <div className="space-y-3">
        <TerminalInput
          value={amount}
          onChange={(e) => setAmount(sanitize(e.target.value))}
          placeholder="0.00"
          inputMode="decimal"
          suffix="usdc"
        />
        <div className="text-[10px] uppercase tracking-[0.2em] text-ink-secondary">
          $ destination (optional · fresh eoa recommended)
        </div>
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="0x… (defaults to caller)"
          className={cn(
            "w-full bg-transparent outline-none border-0 border-b font-mono text-sm tabular-nums text-ink-primary placeholder:text-ink-tertiary pb-1 transition-colors",
            destValid
              ? "border-ink-tertiary focus:border-phos"
              : "border-crit focus:border-crit",
          )}
        />
        <div className="text-[10px] text-ink-tertiary font-mono">
          # queues {amountNum > 0 ? formatAmount(amountNum, 2) : "0"} cUSDC for batched unwrap.
          <br /># the tee redistributes plaintext to all destinations in one tx.
        </div>
        {(step || err) && (
          <div className="font-mono text-[11px] min-h-[14px]">
            {err ? (
              <span className="text-crit">[error] {err}</span>
            ) : (
              <span className="text-ink-secondary">
                <span className="text-phos">&gt;</span> {step}
                {busy && <span className="animate-blink-hard">█</span>}
              </span>
            )}
          </div>
        )}
        <TerminalButton
          variant="primary"
          glitch
          disabled={!canJoin}
          onClick={submit}
        >
          {busy ? "QUEUEING…" : "JOIN EXIT ROUND"}
        </TerminalButton>
      </div>
    </AsciiCard>
  );
}
