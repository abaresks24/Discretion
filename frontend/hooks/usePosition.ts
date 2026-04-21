"use client";

import { useReadContracts } from "wagmi";
import { type Address } from "viem";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";

/**
 * Reads the encrypted collateral + debt handles from the vault.
 *
 * Decryption itself happens via the Nox Gateway SDK on the frontend
 * (`@iexec-nox/nox-handle-sdk`, to be wired in a follow-up). This hook only
 * returns the handles; consuming components call the gateway helper to
 * resolve plaintext and feed it back to the relayer through `/analyze`.
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
        ]
      : [],
    query: { enabled: !!user, refetchInterval: 15_000 },
  });

  const [collateral, debt] = data ?? [];

  return {
    collateralHandle: collateral?.result as `0x${string}` | undefined,
    debtHandle: debt?.result as `0x${string}` | undefined,
    isLoading,
    refetch,
  };
}
