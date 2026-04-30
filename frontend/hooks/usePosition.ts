"use client";

import { useReadContracts } from "wagmi";
import { type Address } from "viem";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { COLLATERAL_ASSETS } from "@/lib/assets";

/**
 * Reads every encrypted handle a user carries:
 *   - per-asset collateral (one handle per registered collateral asset)
 *   - debt (single — USDC)
 *   - lender shares (single — USDC supplied as LP)
 *
 * Decryption happens client-side via `@iexec-nox/handle` (hook consumers
 * call `nox.decrypt(handle)` on each).
 */
export function usePosition(user: Address | undefined) {
  const collatReads = COLLATERAL_ASSETS.map((a) => ({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "getEncryptedCollateral" as const,
    args: user ? [a.underlying, user] : undefined,
  }));

  const { data, isLoading, refetch } = useReadContracts({
    contracts: user
      ? [
          ...collatReads,
          {
            address: env.VAULT_ADDRESS,
            abi: vaultAbi,
            functionName: "getEncryptedDebt",
            args: [user],
          },
          {
            address: env.VAULT_ADDRESS,
            abi: vaultAbi,
            functionName: "getEncryptedLenderShares",
            args: [user],
          },
        ]
      : [],
    query: { enabled: !!user, refetchInterval: 15_000 },
  });

  const n = COLLATERAL_ASSETS.length;
  const collateralHandles: Record<string, `0x${string}` | undefined> = {};
  COLLATERAL_ASSETS.forEach((a, i) => {
    collateralHandles[a.symbol] = data?.[i]?.result as `0x${string}` | undefined;
  });
  const debtHandle = data?.[n]?.result as `0x${string}` | undefined;
  const lenderSharesHandle = data?.[n + 1]?.result as `0x${string}` | undefined;

  return {
    collateralHandles,
    debtHandle,
    lenderSharesHandle,
    isLoading,
    refetch,
  };
}
