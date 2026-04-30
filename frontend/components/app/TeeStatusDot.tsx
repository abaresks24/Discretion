"use client";

import { useReadContract } from "wagmi";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { cn } from "@/lib/cn";

/**
 * Healthy heuristic: if the vault's `borrowRateBps` call resolves, we're
 * considered "green". On RPC / contract error → "red". Not a real
 * attestation signal, but a live pulse for the demo.
 */
export function TeeStatusDot() {
  const { data, isError } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "borrowRateBps",
    query: { refetchInterval: 20_000 },
  });

  const status: "ok" | "warn" | "down" = isError
    ? "down"
    : data === undefined
      ? "warn"
      : "ok";

  const color =
    status === "ok" ? "bg-phos" : status === "warn" ? "bg-amber" : "bg-crit";
  const label =
    status === "ok" ? "tee:online" : status === "warn" ? "tee:syncing" : "tee:down";

  return (
    <span className="flex items-center gap-2 text-[11px] uppercase tracking-widest">
      <span className="text-ink-tertiary">|</span>
      <span
        aria-hidden
        className={cn(
          "inline-block h-2 w-2 rounded-full animate-pulse-dot",
          color,
        )}
      />
      <span
        className={cn(
          status === "ok" && "text-phos",
          status === "warn" && "text-amber",
          status === "down" && "text-crit",
        )}
      >
        {label}
      </span>
    </span>
  );
}
