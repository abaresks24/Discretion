import { type Address, getAddress } from "viem";
import { env } from "./env";

/**
 * Registry of every asset the protocol supports as collateral or debt.
 *
 * Each entry knows its plaintext ERC-20 (`underlying`), its confidential
 * ERC-7984 wrapper (`cToken`), its decimals, its on-chain price-oracle key,
 * and a max-LTV hint for the UI. The vault's `listCollateralAssets()` is the
 * authoritative source for what is actually live; this registry exists so the
 * frontend can render names/icons/decimals without 6 RPC calls per page load.
 *
 * NOTE: addresses are read from `NEXT_PUBLIC_*` env vars at build time so
 * they can rotate per deploy without recompiling the registry.
 */

export type AssetMeta = {
  symbol: string;        // RLC, WETH, USDC
  name: string;          // human-readable
  underlying: Address;   // plaintext ERC-20
  cToken: Address;       // confidential ERC-7984 wrapper
  decimals: number;      // ERC-20 decimals
  ltvBps: number;        // max LTV as collateral, in bps (UI hint, vault is authoritative)
  hasMixer: boolean;     // does the WrapQueue accept this asset?
  role: ("collat" | "debt")[]; // what roles this asset can play
  description: string;   // short blurb shown in selectors
};

function safeAddr(raw: Address): Address {
  return raw && /^0x[a-fA-F0-9]{40}$/.test(raw)
    ? (getAddress(raw) as Address)
    : ("0x0000000000000000000000000000000000000000" as Address);
}

export const ASSETS: Record<string, AssetMeta> = {
  RLC: {
    symbol: "RLC",
    name: "iExec RLC",
    underlying: safeAddr(env.RLC_ASSET as Address),
    cToken: safeAddr(env.C_RLC_TOKEN as Address),
    decimals: 9,
    ltvBps: 7000,
    hasMixer: true,
    role: ["collat"],
    description: "iExec native — governance & utility token",
  },
  WETH: {
    symbol: "WETH",
    name: "Wrapped ETH",
    underlying: safeAddr(env.WETH_ASSET as Address),
    cToken: safeAddr(env.C_WETH_TOKEN as Address),
    decimals: 18,
    ltvBps: 7500,
    hasMixer: false,
    role: ["collat"],
    description: "ETH on Arbitrum Sepolia · most volatile collat",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    underlying: safeAddr(env.USDC_ASSET as Address),
    cToken: safeAddr(env.C_USDC_TOKEN as Address),
    decimals: 6,
    ltvBps: 9000,
    hasMixer: false,
    role: ["collat", "debt"],
    description: "Circle stable · also the protocol's debt asset",
  },
};

export const COLLATERAL_ASSETS: AssetMeta[] = Object.values(ASSETS).filter((a) =>
  a.role.includes("collat"),
);

export const DEBT_ASSET: AssetMeta = ASSETS.USDC;

/** Look up by underlying ERC-20 plaintext address. */
export function assetByUnderlying(addr: Address): AssetMeta | undefined {
  const k = addr.toLowerCase();
  return Object.values(ASSETS).find((a) => a.underlying.toLowerCase() === k);
}

/** Look up by ERC-7984 confidential wrapper address. */
export function assetByCToken(addr: Address): AssetMeta | undefined {
  const k = addr.toLowerCase();
  return Object.values(ASSETS).find((a) => a.cToken.toLowerCase() === k);
}

/** Look up by symbol (case-insensitive). */
export function assetBySymbol(sym: string): AssetMeta | undefined {
  return ASSETS[sym.toUpperCase()];
}
