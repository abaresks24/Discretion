"use client";

import { useReadContracts } from "wagmi";
import { oracleAbi } from "@/lib/abi/oracle";
import { env } from "@/lib/env";
import { ASSETS, COLLATERAL_ASSETS, type AssetMeta } from "@/lib/assets";

/**
 * Live USD prices for every registered collateral asset, read from the
 * `HybridPriceOracle`. The oracle returns 8-dec scalars (Chainlink
 * convention) which we normalise to plain JS numbers.
 *
 * For assets with a Chainlink feed configured the price is live; for
 * assets relying on the manual override the price reflects the deployer's
 * last `setManualOverride` call. Either way, no hardcoded constants live
 * in the frontend.
 */
export function useAssetPrices() {
  const symbols = COLLATERAL_ASSETS.map((a) => a.symbol);
  const reads = COLLATERAL_ASSETS.map((a) => ({
    address: env.ORACLE_ADDRESS,
    abi: oracleAbi,
    functionName: "getPrice" as const,
    args: [a.underlying],
  }));

  const { data, isLoading, refetch } = useReadContracts({
    contracts: reads,
    query: { refetchInterval: 30_000 },
  });

  const pricesUsd: Record<string, number> = {};
  COLLATERAL_ASSETS.forEach((a, i) => {
    const result = data?.[i]?.result as
      | readonly [bigint, bigint]
      | undefined;
    if (result) {
      pricesUsd[a.symbol] = Number(result[0]) / 1e8;
    } else {
      pricesUsd[a.symbol] = 0;
    }
  });

  return {
    pricesUsd,
    symbols,
    isLoading,
    refetch,
    /** USD price for a single asset symbol (0 if unknown / not loaded). */
    priceOf: (sym: string) => pricesUsd[sym.toUpperCase()] ?? 0,
    /** Same lookup by AssetMeta. */
    priceOfMeta: (a: AssetMeta) => pricesUsd[a.symbol] ?? 0,
  };
}
