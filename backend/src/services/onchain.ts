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
  transport: http(config.ARBITRUM_SEPOLIA_RPC),
});

/**
 * Snapshot of the data we hand to ChainGPT as position context.
 *
 * Encrypted fields are returned as bytes32 handles. When a view key is provided
 * we decrypt them locally for analysis; without a view key we hand ChainGPT
 * only the coarse zone + prices, which is still actionable.
 */
export type PositionSnapshot = {
  user: Address;
  zone: number;
  collateralHandle: `0x${string}`;
  debtHandle: `0x${string}`;
  ltvBpsHandle: `0x${string}`;
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
    ltvBpsHandle,
    zone,
    collateralDecimals,
    debtDecimals,
    [collateralPrice, collateralUpdatedAt],
    [debtPrice, debtUpdatedAt],
  ] = await Promise.all([
    publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "getEncryptedCollateral",
      args: [user],
    }),
    publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "getEncryptedDebt",
      args: [user],
    }),
    publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "getEncryptedLtvBps",
      args: [user],
    }),
    publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "lastZone",
      args: [user],
    }),
    publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "COLLATERAL_DECIMALS",
    }),
    publicClient.readContract({
      address: config.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "DEBT_DECIMALS",
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
    zone,
    collateralHandle,
    debtHandle,
    ltvBpsHandle,
    collateralDecimals,
    debtDecimals,
    collateralPriceUsd8: collateralPrice,
    debtPriceUsd8: debtPrice,
    collateralPriceUpdatedAt: collateralUpdatedAt,
    debtPriceUpdatedAt: debtUpdatedAt,
  };
}

/**
 * Decrypt an encrypted handle with the user's view key.
 *
 * FIXME(nox): this function currently treats handles as plain uint64 (matching
 * the contract's placeholder FHE library). After the April 17 workshop, replace
 * with the real Gateway / TFHE decryption flow. Signature kept identical so call
 * sites don't change.
 */
export async function decryptHandle(
  handle: `0x${string}`,
  _viewKey: string,
): Promise<bigint> {
  // Placeholder: the handle is the plaintext value cast into bytes32.
  return BigInt(handle);
}
