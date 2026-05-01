import { type Address, getAddress } from "viem";

/**
 * IMPORTANT: `NEXT_PUBLIC_*` env vars are injected into the browser bundle at
 * build time ONLY when accessed as static property reads (e.g.
 * `process.env.NEXT_PUBLIC_FOO`). Dynamic lookups via `process.env[key]` are
 * NOT replaced and resolve to `undefined` in the browser — which was
 * silently populating every address with `0x0` before this file was rewritten.
 */

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

function addr(raw: string | undefined): Address {
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return ZERO;
  return getAddress(raw) as Address;
}

export const env = {
  // Core protocol
  VAULT_ADDRESS: addr(process.env.NEXT_PUBLIC_VAULT_ADDRESS),
  ORACLE_ADDRESS: addr(process.env.NEXT_PUBLIC_ORACLE_ADDRESS),
  WRAP_QUEUE_ADDRESS: addr(process.env.NEXT_PUBLIC_WRAP_QUEUE_ADDRESS),
  WRAP_QUEUE_WETH_ADDRESS: addr(process.env.NEXT_PUBLIC_WRAP_QUEUE_WETH_ADDRESS),
  WRAP_QUEUE_USDC_ADDRESS: addr(process.env.NEXT_PUBLIC_WRAP_QUEUE_USDC_ADDRESS),
  UNWRAP_QUEUE_ADDRESS: addr(process.env.NEXT_PUBLIC_UNWRAP_QUEUE_ADDRESS),

  // Multi-asset registry — plaintext ERC-20 + confidential ERC-7984 wrapper
  // for each supported asset. Per-asset rather than per-role so the same
  // address can play both collateral and debt roles (USDC does both).
  RLC_ASSET: addr(process.env.NEXT_PUBLIC_RLC_ASSET),
  C_RLC_TOKEN: addr(process.env.NEXT_PUBLIC_C_RLC_TOKEN),
  WETH_ASSET: addr(process.env.NEXT_PUBLIC_WETH_ASSET),
  C_WETH_TOKEN: addr(process.env.NEXT_PUBLIC_C_WETH_TOKEN),
  USDC_ASSET: addr(process.env.NEXT_PUBLIC_USDC_ASSET),
  C_USDC_TOKEN: addr(process.env.NEXT_PUBLIC_C_USDC_TOKEN),

  // Legacy aliases — read from the same NEXT_PUBLIC_C_*_TOKEN / *_ASSET
  // values so existing imports keep working until the migration completes.
  COLLATERAL_TOKEN: addr(process.env.NEXT_PUBLIC_C_RLC_TOKEN),
  DEBT_TOKEN: addr(process.env.NEXT_PUBLIC_C_USDC_TOKEN),
  COLLATERAL_ASSET: addr(process.env.NEXT_PUBLIC_RLC_ASSET),
  DEBT_ASSET: addr(process.env.NEXT_PUBLIC_USDC_ASSET),

  RELAYER_URL:
    process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:8787",
  CHAIN_ID: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "421614"),
  RPC_URL:
    process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ??
    "https://arbitrum-sepolia-rpc.publicnode.com",
} as const;
