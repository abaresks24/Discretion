import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { config } from "../config.js";
import { vaultAbi } from "../abi/vault.js";
import { oracleAbi } from "../abi/oracle.js";

export const publicClient: PublicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(config.ARBITRUM_SEPOLIA_RPC, {
    // Retry 429s with exponential backoff so a brief rate-limit burst doesn't
    // tear down the watchEvent subscription.
    retryCount: 5,
    retryDelay: 1_000,
  }),
  // Slow event polling to ~12s. Defaults to 4s which crushes public RPCs
  // when we have ~9 watchEvent subscriptions in parallel.
  pollingInterval: 12_000,
});

// Hardcoded from on-chain probe of the pre-deployed Nox tokens:
//   - cRLC inherits plaintext RLC's 9 decimals
//   - cUSDC inherits plaintext USDC's 6 decimals
export const COLLATERAL_DECIMALS = 9;
export const DEBT_DECIMALS = 6;

/**
 * Snapshot of what the relayer can see on-chain. Amounts live behind handles
 * and are decrypted by the user's frontend via the Nox Gateway SDK; the
 * frontend then pushes pre-decrypted values to `/analyze` when it has them.
 */
export type PositionSnapshot = {
  user: Address;
  collateralHandle: `0x${string}`;
  debtHandle: `0x${string}`;
  collateralDecimals: number;
  debtDecimals: number;
  collateralPriceUsd8: bigint;
  debtPriceUsd8: bigint;
  collateralPriceUpdatedAt: bigint;
  debtPriceUpdatedAt: bigint;
};

export async function readPositionSnapshot(
  user: Address,
): Promise<PositionSnapshot> {
  const [
    collateralHandle,
    debtHandle,
    [collateralPrice, collateralUpdatedAt],
    [debtPrice, debtUpdatedAt],
  ] = await Promise.all([
    publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "getEncryptedCollateral",
      args: [config.COLLATERAL_ASSET, user],
    }),
    publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "getEncryptedDebt",
      args: [user],
    }),
    publicClient.readContract({
      address: config.ORACLE_ADDRESS,
      abi: oracleAbi,
      functionName: "getPrice",
      args: [config.COLLATERAL_ASSET],
    }),
    publicClient.readContract({
      address: config.ORACLE_ADDRESS,
      abi: oracleAbi,
      functionName: "getPrice",
      args: [config.DEBT_ASSET],
    }),
  ]);

  return {
    user,
    collateralHandle,
    debtHandle,
    collateralDecimals: COLLATERAL_DECIMALS,
    debtDecimals: DEBT_DECIMALS,
    collateralPriceUsd8: collateralPrice,
    debtPriceUsd8: debtPrice,
    collateralPriceUpdatedAt: collateralUpdatedAt,
    debtPriceUpdatedAt: debtUpdatedAt,
  };
}

/**
 * Compute zone (0 safe, 1 warning, 2 danger, 3 liquidatable) from
 * pre-decrypted amounts + current oracle prices. Both amounts are raw
 * (i.e. in 6-decimal units for cRLC/cUSDC).
 */
export function computeZone(
  collateralRaw: bigint,
  debtRaw: bigint,
  collateralPriceUsd8: bigint,
  debtPriceUsd8: bigint,
): { zone: number; ltvBps: number } {
  if (debtRaw === 0n) return { zone: 0, ltvBps: 0 };
  // value in 8-decimal USD units: amount (6dec) * price (8dec) / 1e6 => 8dec USD.
  const collatUsd = (collateralRaw * collateralPriceUsd8) / 10n ** BigInt(COLLATERAL_DECIMALS);
  const debtUsd = (debtRaw * debtPriceUsd8) / 10n ** BigInt(DEBT_DECIMALS);
  if (collatUsd === 0n) return { zone: 3, ltvBps: 1_000_000 };
  const ltvBps = Number((debtUsd * 10000n) / collatUsd);
  const zone = ltvBps >= 8500 ? 3 : ltvBps >= 7500 ? 2 : ltvBps >= 6000 ? 1 : 0;
  return { zone, ltvBps };
}
