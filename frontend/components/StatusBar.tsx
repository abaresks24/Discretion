"use client";

import { useBlockNumber, useGasPrice, useReadContracts } from "wagmi";
import { formatGwei } from "viem";
import { useViewMode } from "@/context/ViewModeContext";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { cn } from "@/lib/cn";

/**
 * Bottom status bar — block, gas, privacy mode, live vault rates, and
 * reported utilization. The rates + utilization come from on-chain state
 * set by the owner (or a TEE rate engine in production).
 */
export function StatusBar() {
  const { mode } = useViewMode();
  const { data: block } = useBlockNumber({ watch: true });
  const { data: gas } = useGasPrice({ query: { refetchInterval: 12_000 } });
  const gasGwei = gas ? Number(formatGwei(gas)).toFixed(3) : null;
  const privacyLabel = mode === "private" ? "on" : "public";

  const { data: vaultState } = useReadContracts({
    contracts: [
      {
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "borrowRateBps",
      },
      {
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "supplyRateBps",
      },
      {
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "utilizationBps",
      },
    ],
    query: { refetchInterval: 20_000 },
  });
  const [borrowRate, supplyRate, util] = vaultState ?? [];
  const borrowPct =
    borrowRate?.result !== undefined ? Number(borrowRate.result) / 100 : null;
  const supplyPct =
    supplyRate?.result !== undefined ? Number(supplyRate.result) / 100 : null;
  const utilPct = util?.result !== undefined ? Number(util.result) / 100 : null;

  return (
    <footer className="h-9 border-t border-terminal-border px-4 flex items-center gap-3 text-[11px] font-mono text-terminal-fade select-none">
      <span>
        sync{" "}
        <span className="text-terminal-dim">
          #{block !== undefined ? block.toString() : "—"}
        </span>
      </span>
      <span>|</span>
      <span>
        gas <span className="text-terminal-dim">{gasGwei ?? "—"}</span> gwei
      </span>
      <span>|</span>
      <span>
        borrow_apr{" "}
        <span className="text-terminal-amber">
          {borrowPct !== null ? borrowPct.toFixed(2) : "—"}%
        </span>
      </span>
      <span>|</span>
      <span>
        supply_apr{" "}
        <span className="text-terminal-text">
          {supplyPct !== null ? supplyPct.toFixed(2) : "—"}%
        </span>
      </span>
      <span>|</span>
      <span>
        util{" "}
        <span className="text-terminal-dim">
          {utilPct !== null ? utilPct.toFixed(1) : "—"}%
        </span>
      </span>
      <span>|</span>
      <span>
        privacy{" "}
        <span
          className={cn(
            mode === "private" ? "text-terminal-text" : "text-terminal-danger",
          )}
        >
          {privacyLabel}
        </span>
      </span>
      <span className="flex-1" />
      <span className="opacity-60">
        [enter] exec &nbsp; [esc] close &nbsp; [tab] cycle
      </span>
    </footer>
  );
}
