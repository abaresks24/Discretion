import { type Address, getAddress } from "viem";

function requireAddress(key: string): Address {
  const v = process.env[key];
  if (!v || !/^0x[a-fA-F0-9]{40}$/.test(v)) {
    // During dev we let placeholders through — the UI shows a clear error state.
    if (!v) return "0x0000000000000000000000000000000000000000" as Address;
  }
  return getAddress(v!) as Address;
}

function requireString(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing env: ${key}`);
}

export const env = {
  VAULT_ADDRESS: requireAddress("NEXT_PUBLIC_VAULT_ADDRESS"),
  ORACLE_ADDRESS: requireAddress("NEXT_PUBLIC_ORACLE_ADDRESS"),
  COLLATERAL_TOKEN: requireAddress("NEXT_PUBLIC_COLLATERAL_TOKEN"),
  DEBT_TOKEN: requireAddress("NEXT_PUBLIC_DEBT_TOKEN"),
  COLLATERAL_ASSET: requireAddress("NEXT_PUBLIC_COLLATERAL_ASSET"),
  DEBT_ASSET: requireAddress("NEXT_PUBLIC_DEBT_ASSET"),
  RELAYER_URL: requireString("NEXT_PUBLIC_RELAYER_URL", "http://localhost:8787"),
  CHAIN_ID: Number(requireString("NEXT_PUBLIC_CHAIN_ID", "421614")),
  RPC_URL: requireString(
    "NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC",
    "https://sepolia-rollup.arbitrum.io/rpc",
  ),
} as const;
