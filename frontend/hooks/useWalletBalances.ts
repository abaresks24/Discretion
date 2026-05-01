"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { erc20Abi, erc7984Abi } from "@/lib/abi/vault";
import { publicClient } from "@/lib/publicClient";
import { ASSETS } from "@/lib/assets";
import { useNoxHandle } from "./useNoxHandle";

const ZERO_HANDLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export type WalletAssetBalance = {
  symbol: string;
  decimals: number;
  plaintext: number;     // ERC-20 (visible in any wallet)
  confidential: number;  // ERC-7984 cToken (decrypted via Nox)
};

/**
 * Decrypts the user's cToken (ERC-7984) balances + reads plaintext ERC-20
 * balances for every registered asset. Refresh trigger is `tick` — bump it
 * after a tx to force a re-read.
 */
export function useWalletBalances(tick: number = 0): {
  balances: Record<string, WalletAssetBalance>;
  loaded: boolean;
} {
  const { address } = useAccount();
  const { client: nox } = useNoxHandle();
  const [balances, setBalances] = useState<Record<string, WalletAssetBalance>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!address || !nox) return;
    let cancelled = false;
    (async () => {
      const out: Record<string, WalletAssetBalance> = {};
      for (const sym of Object.keys(ASSETS)) {
        const a = ASSETS[sym];
        try {
          const [plaintextRaw, handle] = await Promise.all([
            publicClient.readContract({
              address: a.underlying,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            }) as Promise<bigint>,
            publicClient.readContract({
              address: a.cToken,
              abi: erc7984Abi,
              functionName: "confidentialBalanceOf",
              args: [address],
            }) as Promise<`0x${string}`>,
          ]);
          let cRaw = 0n;
          if (handle && handle !== "0x" && handle !== ZERO_HANDLE) {
            try {
              cRaw = await nox.decrypt(handle);
            } catch {
              /* gateway hiccup — render 0 for this asset */
            }
          }
          out[sym] = {
            symbol: sym,
            decimals: a.decimals,
            plaintext: Number(plaintextRaw) / 10 ** a.decimals,
            confidential: Number(cRaw) / 10 ** a.decimals,
          };
        } catch {
          out[sym] = { symbol: sym, decimals: a.decimals, plaintext: 0, confidential: 0 };
        }
      }
      if (!cancelled) {
        setBalances(out);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, nox, tick]);

  return { balances, loaded };
}
