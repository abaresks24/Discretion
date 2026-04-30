"use client";

import { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import type { Address } from "viem";

/**
 * Wraps `@iexec-nox/handle` around the wagmi wallet client. Returns a stable
 * client while the wallet is connected — rebuilds it if the wallet changes.
 *
 * The SDK is ESM-only and instantiates lazily (it pulls in graphql + subgraph
 * fetchers), so we import it dynamically to keep the initial bundle small.
 */

export type NoxEncryptedInput = {
  handle: `0x${string}`;
  handleProof: `0x${string}`;
};

export type NoxHandleClient = {
  encryptInput: (
    value: bigint,
    solidityType: "uint256",
    applicationContract: Address,
  ) => Promise<NoxEncryptedInput>;
  decrypt: (handle: `0x${string}`) => Promise<bigint>;
};

export function useNoxHandle(): {
  client: NoxHandleClient | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: walletClient } = useWalletClient();
  const [client, setClient] = useState<NoxHandleClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!walletClient) {
      console.log("[useNoxHandle] waiting for walletClient…");
      setClient(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    console.log("[useNoxHandle] init start", {
      chainId: walletClient.chain?.id,
      account: walletClient.account?.address,
    });
    (async () => {
      try {
        const { createViemHandleClient } = await import("@iexec-nox/handle");
        console.log("[useNoxHandle] module imported, calling createViemHandleClient…");
        const raw = await createViemHandleClient(walletClient as never);
        console.log("[useNoxHandle] client created ✓");
        if (cancelled) return;

        const wrapped: NoxHandleClient = {
          async encryptInput(value, solidityType, applicationContract) {
            const { handle, handleProof } = await raw.encryptInput(
              value,
              solidityType,
              applicationContract,
            );
            return {
              handle: handle as `0x${string}`,
              handleProof: handleProof as `0x${string}`,
            };
          },
          async decrypt(handle) {
            const { value } = await raw.decrypt(handle);
            // For uint256 handles the SDK returns a bigint; string for other types.
            return typeof value === "bigint" ? value : BigInt(value as string);
          },
        };
        setClient(wrapped);
      } catch (err) {
        console.error("[useNoxHandle] init failed", err);
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletClient]);

  return { client, isLoading, error };
}
