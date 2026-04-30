"use client";

import { useEffect, useState } from "react";
import { type Address, parseAbiItem } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { WalletGate } from "@/components/WalletGate";
import { ScreenShell } from "@/components/app/ScreenShell";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { TerminalButton } from "@/components/primitives/TerminalButton";
import { publicClient } from "@/lib/publicClient";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { COLLATERAL_ASSETS, ASSETS, DEBT_ASSET } from "@/lib/assets";
import { useAssetPrices } from "@/hooks/useAssetPrices";
import { formatAmount, truncateAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

type Row = {
  user: Address;
  ltvBps: number;
  debtAmount: bigint;
  deadline: number;
  collat: Record<string, bigint>; // by symbol
};

const LOG_PAGE = 2000n;

export default function LiquidationsPage() {
  return (
    <WalletGate>
      <LiquidationsScreen />
    </WalletGate>
  );
}

function LiquidationsScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { pricesUsd } = useAssetPrices();
  const [pendingUser, setPendingUser] = useState<Address | null>(null);

  async function scan() {
    setScanning(true);
    setErr(null);
    try {
      const latest = await publicClient.getBlockNumber();
      const seen = new Set<string>();
      for (let from = 0n; from <= latest; from += LOG_PAGE) {
        const to = from + LOG_PAGE > latest ? latest : from + LOG_PAGE;
        const logs = await publicClient.getLogs({
          address: env.VAULT_ADDRESS,
          event: parseAbiItem(
            "event PositionLiquidatable(address indexed user, uint256 ltvBps, uint256 debtAmount, uint40 deadline)",
          ),
          fromBlock: from,
          toBlock: to,
        });
        for (const log of logs) {
          const u = (log.args as { user?: Address }).user;
          if (u) seen.add(u.toLowerCase());
        }
      }

      // For each candidate, query the on-chain `liquidatables[user]` —
      // active flag tells us if the reveal is still live (not yet liquidated
      // / not cleared).
      const results: Row[] = [];
      for (const userLower of seen) {
        const user = userLower as Address;
        const liq = (await publicClient.readContract({
          address: env.VAULT_ADDRESS,
          abi: vaultAbi,
          functionName: "liquidatables",
          args: [user],
        })) as readonly [boolean, number, number, bigint, bigint];
        const [active, , deadline, ltvBps, debtAmount] = liq;
        if (!active) continue;
        if (Number(deadline) < Math.floor(Date.now() / 1000)) continue;

        // Per-asset reveals
        const collat: Record<string, bigint> = {};
        for (const a of COLLATERAL_ASSETS) {
          const amt = (await publicClient.readContract({
            address: env.VAULT_ADDRESS,
            abi: vaultAbi,
            functionName: "liquidatableCollat",
            args: [user, a.underlying],
          })) as bigint;
          collat[a.symbol] = amt;
        }

        results.push({
          user,
          ltvBps: Number(ltvBps),
          debtAmount,
          deadline: Number(deadline),
          collat,
        });
      }
      setRows(results);
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "scan failed");
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    scan();
    const id = setInterval(scan, 30_000);
    return () => clearInterval(id);
  }, []);

  async function liquidate(user: Address) {
    setErr(null);
    setPendingUser(user);
    try {
      await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "liquidate",
        args: [user],
      });
      await scan();
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "tx failed");
    } finally {
      setPendingUser(null);
    }
  }

  return (
    <ScreenShell
      tag="/liquidations"
      title="public liquidation market."
      subtitle="first-write-wins · TEE-revealed · anyone can act"
      trailing={
        <div className="font-mono text-[11px] text-ink-tertiary uppercase tracking-widest">
          live{" "}
          <span className="text-phos phos-glow tabular-nums">{rows.length}</span>
        </div>
      }
    >
      <div className="space-y-4 pb-8">
        <AsciiCard
          title="how to use"
          className="border-phos/40"
        >
          <div className="font-mono text-[11px] text-ink-secondary leading-relaxed space-y-1">
            <p>
              <span className="text-phos">▸</span> The TEE iApp polls all
              positions, decrypting via its audit ACL. When LTV ≥ 85%, it
              publishes a minimal reveal (debt + per-asset collat).
            </p>
            <p>
              <span className="text-phos">▸</span> Anyone (you, an MEV bot, a
              keeper) can call{" "}
              <code className="text-phos">liquidate(user)</code>. First tx
              wins; you pay the debt in cUSDC and receive all revealed
              collateral. The 5% bonus is the discount on the collat you
              receive vs the debt you paid.
            </p>
            <p>
              <span className="text-phos">▸</span> ChainGPT alerts the
              borrower in the copilot panel when their LTV crosses warning
              zones, but it never executes liquidations.
            </p>
          </div>
        </AsciiCard>

        <AsciiCard title="liquidatable positions" bodyClassName="overflow-x-auto p-0">
          {err && (
            <div className="px-4 py-2 text-[11px] text-crit font-mono">
              [error] {err}
            </div>
          )}
          <table className="w-full font-mono text-[11.5px] tabular-nums min-w-[720px]">
            <thead className="text-ink-secondary uppercase tracking-widest text-[10px]">
              <tr className="border-b border-ink-tertiary">
                <th className="text-left px-3 py-2">user</th>
                <th className="text-right px-2 py-2">ltv</th>
                <th className="text-right px-2 py-2">debt {DEBT_ASSET.symbol}</th>
                {COLLATERAL_ASSETS.map((a) => (
                  <th key={a.symbol} className="text-right px-2 py-2">
                    {a.symbol.toLowerCase()}
                  </th>
                ))}
                <th className="text-right px-2 py-2">est. profit</th>
                <th className="text-right px-2 py-2">expires in</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5 + COLLATERAL_ASSETS.length}
                    className="px-3 py-8 text-center text-ink-tertiary"
                  >
                    {scanning ? "# scanning chain…" : "# no liquidatable positions right now"}
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const debtUsd =
                  Number(r.debtAmount) / 10 ** DEBT_ASSET.decimals;
                let collatUsd = 0;
                for (const a of COLLATERAL_ASSETS) {
                  const amt = Number(r.collat[a.symbol] ?? 0n) / 10 ** a.decimals;
                  collatUsd += amt * (pricesUsd[a.symbol] ?? 0);
                }
                const profitUsd = collatUsd - debtUsd;
                const ttl = r.deadline - Math.floor(Date.now() / 1000);
                const ttlStr = ttl <= 0 ? "—" : `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
                const isPending = pendingUser?.toLowerCase() === r.user.toLowerCase();
                return (
                  <tr key={r.user} className="border-b border-ink-tertiary/50">
                    <td className="px-3 py-2 text-phos">
                      {truncateAddress(r.user)}
                    </td>
                    <td
                      className={cn(
                        "text-right px-2 py-2",
                        r.ltvBps >= 9000 ? "text-crit" : "text-amber",
                      )}
                    >
                      {(r.ltvBps / 100).toFixed(1)}%
                    </td>
                    <td className="text-right px-2 py-2 text-ink-primary">
                      {debtUsd.toFixed(2)}
                    </td>
                    {COLLATERAL_ASSETS.map((a) => {
                      const raw = r.collat[a.symbol] ?? 0n;
                      const amt = Number(raw) / 10 ** a.decimals;
                      return (
                        <td key={a.symbol} className="text-right px-2 py-2">
                          {amt > 0 ? amt.toFixed(4) : "—"}
                        </td>
                      );
                    })}
                    <td
                      className={cn(
                        "text-right px-2 py-2",
                        profitUsd > 0 ? "text-phos" : "text-ink-tertiary",
                      )}
                    >
                      ${profitUsd.toFixed(2)}
                    </td>
                    <td className="text-right px-2 py-2 text-ink-tertiary">
                      {ttlStr}
                    </td>
                    <td className="text-right px-3 py-2">
                      <TerminalButton
                        variant="primary"
                        disabled={!address || isPending}
                        onClick={() => liquidate(r.user)}
                      >
                        {isPending ? "EXEC…" : "LIQUIDATE"}
                      </TerminalButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AsciiCard>
      </div>
    </ScreenShell>
  );
}
