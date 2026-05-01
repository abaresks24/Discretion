"use client";

import { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import type { Address } from "viem";

/**
 * Wraps `@iexec-nox/handle` around the wagmi wallet client. Stable singleton
 * keyed by `(chainId, account)` — every component that calls this hook gets
 * the same NoxHandleClient for a given identity, so we never spend bandwidth
 * (or worse: race) on parallel re-initialisations.
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

// Module-level cache: identity -> in-flight or settled client.
const cache = new Map<string, Promise<NoxHandleClient>>();
const subscribers = new Map<string, Set<() => void>>();

function notify(key: string) {
  subscribers.get(key)?.forEach((fn) => fn());
}

async function buildClient(
  walletClient: unknown,
  key: string,
): Promise<NoxHandleClient> {
  const { createViemHandleClient } = await import("@iexec-nox/handle");
  const raw = await createViemHandleClient(walletClient as never);
  console.log("[useNoxHandle] client ready ✓", key);
  return {
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
      return typeof value === "bigint" ? value : BigInt(value as string);
    },
  };
}

function getOrBuild(walletClient: unknown, key: string): Promise<NoxHandleClient> {
  let p = cache.get(key);
  if (!p) {
    console.log("[useNoxHandle] initializing for", key);
    p = buildClient(walletClient, key).catch((err) => {
      console.error("[useNoxHandle] init failed", err);
      cache.delete(key); // allow retry
      notify(key);
      throw err;
    });
    cache.set(key, p);
    p.then(() => notify(key));
  }
  return p;
}

export function useNoxHandle(): {
  client: NoxHandleClient | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { data: walletClient } = useWalletClient();
  const account = walletClient?.account?.address;
  const chainId = walletClient?.chain?.id;
  const key = account && chainId ? `${chainId}:${account}` : null;

  const [client, setClient] = useState<NoxHandleClient | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!walletClient || !key) {
      setClient(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const apply = (c: NoxHandleClient) => {
      if (cancelled) return;
      setClient(c);
      setIsLoading(false);
    };
    const fail = (err: Error) => {
      if (cancelled) return;
      setError(err);
      setIsLoading(false);
    };

    getOrBuild(walletClient, key).then(apply).catch(fail);

    // Subscribe so a sibling that finished init wakes us too.
    const wake = () => {
      const cached = cache.get(key);
      if (cached) cached.then(apply).catch(fail);
    };
    let set = subscribers.get(key);
    if (!set) {
      set = new Set();
      subscribers.set(key, set);
    }
    set.add(wake);

    return () => {
      cancelled = true;
      subscribers.get(key)?.delete(wake);
    };
  }, [key, walletClient]);

  return { client, isLoading, error };
}
