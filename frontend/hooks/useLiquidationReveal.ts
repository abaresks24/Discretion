"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { reportLiquidatable } from "@/lib/relayer";
import { useDecryptedPosition } from "@/hooks/useDecryptedPosition";
import { ASSETS } from "@/lib/assets";

/**
 * Auto-reveal liquidation. Watches the user's own decrypted position.
 * When their LTV first crosses the 85% liquidation threshold, POSTs the
 * (assets, plaintext amounts, debt, ltv) to the relayer so it can call
 * `revealLiquidatable` on-chain. The relayer is the vault's liquidation
 * operator — only it can sign that call.
 *
 * Trust model for the hackathon: the user's frontend is the source of
 * truth for the decryption. Production would use a TEE iApp scanner that
 * doesn't trust individual users.
 */
export function useLiquidationReveal() {
  const { address } = useAccount();
  const pos = useDecryptedPosition();
  const inFlightRef = useRef(false);
  const lastRevealedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!address || !pos.loaded) return;
    if (pos.zone < 3) return; // only zone 3 = liquidatable
    if (inFlightRef.current) return;
    // Throttle re-attempts to one every 60s.
    if (Date.now() - lastRevealedAtRef.current < 60_000) return;

    const assets: string[] = [];
    const collateralAmounts: bigint[] = [];
    for (const c of pos.collateralByAsset) {
      if (c.raw === 0n) continue;
      assets.push(ASSETS[c.asset.symbol].underlying);
      collateralAmounts.push(c.raw);
    }
    if (assets.length === 0) return; // nothing to liquidate

    // Convert ltvPct (%) to bps. Cap at 10000 (the contract enforces a
    // floor, not a ceiling, but our payload should be sensible).
    const ltvBps = Math.min(100_000, Math.round(pos.ltvPct * 100));
    // Convert decrypted debt amount back to native units (cUSDC has 6 dec).
    const debtAmount = BigInt(Math.round(pos.debtAmount * 1_000_000));

    inFlightRef.current = true;
    (async () => {
      try {
        await reportLiquidatable({
          user: address,
          ltvBps,
          debtAmount,
          assets,
          collateralAmounts,
        });
        lastRevealedAtRef.current = Date.now();
      } catch (err) {
        console.error("[reveal-liquidation] failed", err);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [
    address,
    pos.loaded,
    pos.zone,
    pos.ltvPct,
    pos.debtAmount,
    // depend on JSON of collat array for deep-equality
    JSON.stringify(pos.collateralByAsset.map((c) => [c.asset.symbol, c.raw.toString()])),
  ]);
}
