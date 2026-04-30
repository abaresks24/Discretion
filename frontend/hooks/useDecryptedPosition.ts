"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { usePosition } from "./usePosition";
import { useNoxHandle } from "./useNoxHandle";
import { useAssetPrices } from "./useAssetPrices";
import { COLLATERAL_ASSETS, DEBT_ASSET, type AssetMeta } from "@/lib/assets";

/**
 * Reads every encrypted handle the user carries and decrypts them via the
 * Nox gateway. Returns per-asset raw amounts + USD-aggregated totals + LTV.
 *
 * Asset prices are read live from the on-chain `HybridPriceOracle` — see
 * `useAssetPrices`. No hardcoded values.
 */

export type CollatAmount = {
  asset: AssetMeta;
  raw: bigint;
  amount: number;
  valueUsd: number;
  weightedUsd: number; // amount × price × ltvBps/10000
};

export function useDecryptedPosition() {
  const { address } = useAccount();
  const { collateralHandles, debtHandle, lenderSharesHandle, refetch } =
    usePosition(address);
  const { client: nox } = useNoxHandle();
  const { pricesUsd } = useAssetPrices();

  const [collats, setCollats] = useState<Record<string, bigint>>({});
  const [debtRaw, setDebtRaw] = useState(0n);
  const [lenderRaw, setLenderRaw] = useState(0n);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    if (!nox) return;
    let cancelled = false;
    (async () => {
      const safeDecrypt = async (
        h: `0x${string}` | undefined,
        label: string,
      ): Promise<bigint> => {
        if (!h || /^0x0+$/.test(h)) return 0n;
        try {
          return await nox.decrypt(h);
        } catch (err: any) {
          if (!cancelled) {
            setDecryptError(
              `${label}: ${err?.shortMessage ?? err?.message ?? "decrypt failed"}`,
            );
          }
          return 0n;
        }
      };

      const collatEntries = await Promise.all(
        COLLATERAL_ASSETS.map(async (a) => [
          a.symbol,
          await safeDecrypt(collateralHandles[a.symbol], `collat:${a.symbol}`),
        ] as const),
      );
      const d = await safeDecrypt(debtHandle, "debt");
      const lp = await safeDecrypt(lenderSharesHandle, "lender");

      if (!cancelled) {
        setCollats(Object.fromEntries(collatEntries));
        setDebtRaw(d);
        setLenderRaw(lp);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    nox,
    debtHandle,
    lenderSharesHandle,
    // collateralHandles is a fresh object every render but its keys are
    // stable; depend on stringified handle values to avoid infinite loops.
    JSON.stringify(collateralHandles),
  ]);

  const collateralByAsset: CollatAmount[] = COLLATERAL_ASSETS.map((a) => {
    const raw = collats[a.symbol] ?? 0n;
    const amount = Number(raw) / 10 ** a.decimals;
    const price = pricesUsd[a.symbol] ?? 0;
    const valueUsd = amount * price;
    const weightedUsd = (valueUsd * a.ltvBps) / 10000;
    return { asset: a, raw, amount, valueUsd, weightedUsd };
  });

  const totalCollatUsd = collateralByAsset.reduce((s, c) => s + c.valueUsd, 0);
  const weightedCollatUsd = collateralByAsset.reduce(
    (s, c) => s + c.weightedUsd,
    0,
  );
  const debtAmount = Number(debtRaw) / 10 ** DEBT_ASSET.decimals;
  const lenderAmount = Number(lenderRaw) / 10 ** DEBT_ASSET.decimals;

  const ltvPct =
    debtAmount > 0 && totalCollatUsd > 0
      ? Math.min((debtAmount / totalCollatUsd) * 100, 999)
      : 0;
  const headroomUsd = Math.max(0, weightedCollatUsd - debtAmount);
  const zone = ltvPct >= 85 ? 3 : ltvPct >= 75 ? 2 : ltvPct >= 60 ? 1 : 0;

  return {
    address,
    collateralByAsset,          // per-asset detail
    totalCollatUsd,             // sum of asset_amount × price
    weightedCollatUsd,          // sum weighted by per-asset ltvBps
    debtAmount,
    lenderAmount,
    ltvPct,
    headroomUsd,
    zone,
    refetch,
    loaded: !!nox,
    decryptError,
    handles: { collateralHandles, debtHandle, lenderSharesHandle },

    // Backwards-compat: legacy callers expect a single `collateralAmount` /
    // `collateralUsd`. We expose them as the *aggregate* (sum across all
    // collateral assets), keeping older pages functional during migration.
    collateralAmount: collateralByAsset.reduce((s, c) => s + c.amount, 0),
    collateralUsd: totalCollatUsd,
  };
}
