"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { type Address } from "viem";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";

/**
 * Reads the user's encrypted position handles from the vault. Decryption
 * happens through the relayer's /analyze endpoint (which holds the Gateway
 * integration) — the frontend only ever sees handles directly.
 */
export function usePosition(user: Address | undefined) {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: user
      ? [
          {
            address: env.VAULT_ADDRESS,
            abi: vaultAbi,
            functionName: "getEncryptedCollateral",
            args: [user],
          },
          {
            address: env.VAULT_ADDRESS,
            abi: vaultAbi,
            functionName: "getEncryptedDebt",
            args: [user],
          },
          {
            address: env.VAULT_ADDRESS,
            abi: vaultAbi,
            functionName: "getEncryptedLtvBps",
            args: [user],
          },
          {
            address: env.VAULT_ADDRESS,
            abi: vaultAbi,
            functionName: "lastZone",
            args: [user],
          },
        ]
      : [],
    query: { enabled: !!user, refetchInterval: 15_000 },
  });

  const [collateral, debt, ltv, zone] = data ?? [];

  return {
    collateralHandle: collateral?.result as `0x${string}` | undefined,
    debtHandle: debt?.result as `0x${string}` | undefined,
    ltvHandle: ltv?.result as `0x${string}` | undefined,
    zone: (zone?.result as number | undefined) ?? 0,
    isLoading,
    refetch,
  };
}

// Pure client-side convenience: the placeholder FHE library stores plaintext
// in the low bytes of the handle. After Nox integration, this function will
// be replaced by a call to `/analyze` (which routes through the Gateway).
// FIXME(nox): delete this in favour of relayer-side decryption.
export function placeholderDecrypt(handle: `0x${string}` | undefined): bigint {
  if (!handle) return 0n;
  try {
    return BigInt(handle);
  } catch {
    return 0n;
  }
}
