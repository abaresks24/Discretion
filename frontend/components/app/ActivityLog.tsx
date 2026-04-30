"use client";

import { useEffect, useState } from "react";
import { parseAbiItem, type Address } from "viem";
import { publicClient } from "@/lib/publicClient";
import { env } from "@/lib/env";
import { useAccount } from "wagmi";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

const EVENTS = [
  { key: "DEPOSIT", color: "text-phos", abi: parseAbiItem("event CollateralDeposited(address indexed user)") },
  { key: "WITHDRAW", color: "text-phos", abi: parseAbiItem("event CollateralWithdrawn(address indexed user)") },
  { key: "BORROW", color: "text-amber", abi: parseAbiItem("event Borrowed(address indexed user)") },
  { key: "REPAY", color: "text-phos-dim", abi: parseAbiItem("event Repaid(address indexed user)") },
  { key: "SUPPLY", color: "text-phos", abi: parseAbiItem("event LiquiditySupplied(address indexed lender)") },
  { key: "UNSUPPLY", color: "text-amber", abi: parseAbiItem("event LiquidityWithdrawn(address indexed lender)") },
];

type Row = {
  ts: number;
  block: bigint;
  action: string;
  color: string;
  user: Address;
  tx: `0x${string}`;
};

const LOG_PAGE = 5000n;

export function ActivityLog({
  mineOnly = false,
  limit = 25,
}: {
  mineOnly?: boolean;
  limit?: number;
}) {
  const { address } = useAccount();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const from = latest > LOG_PAGE ? latest - LOG_PAGE : 0n;
        const logs = (
          await Promise.all(
            EVENTS.map((e) =>
              publicClient
                .getLogs({
                  address: env.VAULT_ADDRESS,
                  event: e.abi,
                  fromBlock: from,
                  toBlock: latest,
                })
                .then((items) =>
                  items.map((log) => ({
                    action: e.key,
                    color: e.color,
                    user: (log.args as { user?: Address; lender?: Address }).user
                      ?? (log.args as { lender?: Address }).lender!,
                    tx: log.transactionHash,
                    block: log.blockNumber,
                  })),
                )
                .catch(() => []),
            ),
          )
        ).flat();

        const blocks = [...new Set(logs.map((l) => l.block))];
        const blockInfo = await Promise.all(
          blocks.map((b) => publicClient.getBlock({ blockNumber: b })),
        );
        const blockTs = new Map(blockInfo.map((b) => [b.number, Number(b.timestamp)]));

        const mapped = logs
          .map((l) => ({ ...l, ts: blockTs.get(l.block) ?? 0 }))
          .filter((r) => !mineOnly || (address && r.user.toLowerCase() === address.toLowerCase()))
          .sort((a, b) => b.ts - a.ts)
          .slice(0, limit);

        if (!cancelled) setRows(mapped);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, mineOnly, limit]);

  if (rows === null) {
    return (
      <div className="font-mono text-xs text-ink-tertiary">
        <span className="animate-blink-hard text-phos">█</span> scanning vault
        logs…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="font-mono text-sm text-ink-tertiary">
        no activity yet.
        <br />
        <span className="text-phos animate-blink-hard">█</span>
      </div>
    );
  }

  return (
    <ul className="font-mono text-[12px] space-y-1">
      {rows.map((r, i) => {
        const d = new Date(r.ts * 1000);
        const stamp = `${d.toISOString().slice(0, 10)} ${d
          .toISOString()
          .slice(11, 19)}`;
        return (
          <li
            key={i}
            className="grid grid-cols-[auto_auto_auto_1fr_auto] gap-3 items-baseline"
          >
            <span className="text-ink-tertiary">[{stamp}]</span>
            <span className={cn("uppercase font-semibold w-20", r.color)}>
              {r.action}
            </span>
            <span className="text-ink-secondary">{truncateAddress(r.user)}</span>
            <span className="text-ink-tertiary tabular-nums text-right">
              ████████
            </span>
            <a
              href={`https://sepolia.arbiscan.io/tx/${r.tx}`}
              target="_blank"
              rel="noreferrer"
              className="text-ink-tertiary hover:text-phos"
            >
              [CONFIRMED]↗
            </a>
          </li>
        );
      })}
    </ul>
  );
}
