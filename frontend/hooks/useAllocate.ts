"use client";

import { useRef, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, type Address } from "viem";
import { useNoxHandle, type NoxHandleClient } from "./useNoxHandle";
import { usePosition } from "./usePosition";
import { vaultAbi, erc7984Abi, erc20Abi, wrapQueueAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { publicClient } from "@/lib/publicClient";
import {
  ASSETS,
  COLLATERAL_ASSETS,
  DEBT_ASSET,
  type AssetMeta,
} from "@/lib/assets";

const OPERATOR_TTL_SECS = 60 * 60 * 6;
const MAX_UINT256 = 2n ** 256n - 1n;
const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

// MetaMask's eth_estimateGas + fee suggestion is broken on Arbitrum Sepolia
// for FHE-heavy calls. Hardcoded limits sidestep absurd gas suggestions and
// "max fee per gas less than block base fee" reverts. Arbitrum sequencer
// ignores priority fee, so 0 is fine; 0.1 gwei caps the *displayed* MetaMask
// max — actual paid cost is gasUsed × base fee (~0.02 gwei).
const FHE_GAS_OVERRIDES = {
  gas: 1_500_000n,
  maxFeePerGas: 100_000_000n,
  maxPriorityFeePerGas: 0n,
} as const;
const LIGHT_GAS_OVERRIDES = {
  gas: 100_000n,
  maxFeePerGas: 100_000_000n,
  maxPriorityFeePerGas: 0n,
} as const;
const APPROVE_GAS_OVERRIDES = {
  gas: 80_000n,
  maxFeePerGas: 100_000_000n,
  maxPriorityFeePerGas: 0n,
} as const;
const WRAP_GAS_OVERRIDES = {
  gas: 400_000n,
  maxFeePerGas: 100_000_000n,
  maxPriorityFeePerGas: 0n,
} as const;
const QUEUE_GAS_OVERRIDES = {
  gas: 200_000n,
  maxFeePerGas: 100_000_000n,
  maxPriorityFeePerGas: 0n,
} as const;

const MIXER_BATCH_TIMEOUT_MS = 5 * 60 * 1000;
const MIXER_POLL_INTERVAL_MS = 5_000;

export type Verb =
  | "Deposit"
  | "Withdraw"
  | "Borrow"
  | "Settle"
  | "Supply"
  | "Unsupply";

export const isPullVerb = (v: Verb) =>
  v === "Deposit" || v === "Settle" || v === "Supply";

function defaultAssetForVerb(v: Verb): AssetMeta {
  if (v === "Deposit" || v === "Withdraw") return COLLATERAL_ASSETS[0]; // RLC
  return DEBT_ASSET;
}

/**
 * Unified entry point for every user allocation. The mixer is now automatic:
 * any wrap leg routes through the WrapQueue when the asset has one
 * (RLC today). Assets without a WrapQueue fall back to a direct wrap.
 */
export function useAllocate() {
  const { address } = useAccount();
  const { client: nox, isLoading: noxLoading, error: noxError } = useNoxHandle();
  const { writeContractAsync, isPending } = useWriteContract();
  const { refetch } = usePosition(address);

  // Mirror the latest nox in a ref so the click handler never reads a stale
  // `null` snapshot from a transient re-render.
  const noxRef = useRef(nox);
  noxRef.current = nox;

  const [pendingVerb, setPendingVerb] = useState<Verb | null>(null);
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  async function allocate(
    verb: Verb,
    amount: string,
    opts: { assetSymbol?: string } = {},
  ): Promise<boolean> {
    console.log("[allocate] called", { verb, amount, opts, hasAddress: !!address, hasNox: !!noxRef.current });
    if (!address) {
      console.warn("[allocate] no address");
      setStepError("connect a wallet first");
      return false;
    }
    // Wait up to 5s for the Nox client if it's mid-init (wagmi can flicker
    // walletClient on render and momentarily null `nox`).
    let resolvedNox = noxRef.current;
    if (!resolvedNox) {
      setPendingVerb(verb);
      setPendingStep("waiting for nox gateway…");
      const start = Date.now();
      while (Date.now() - start < 5_000) {
        await new Promise((r) => setTimeout(r, 200));
        if (noxRef.current) {
          resolvedNox = noxRef.current;
          break;
        }
      }
      if (!resolvedNox) {
        setStepError(
          noxLoading
            ? "nox gateway still initialising — retry in a moment"
            : "nox gateway unavailable — see devtools",
        );
        setPendingVerb(null);
        setPendingStep(null);
        return false;
      }
    }
    const noxClient = resolvedNox;
    const asset = opts.assetSymbol
      ? ASSETS[opts.assetSymbol.toUpperCase()] ?? defaultAssetForVerb(verb)
      : defaultAssetForVerb(verb);
    if (!asset) {
      setStepError(`unknown asset: ${opts.assetSymbol}`);
      return false;
    }
    const raw = parseUnits(amount, asset.decimals);
    setStepError(null);
    setPendingVerb(verb);
    try {
      if (isPullVerb(verb)) {
        await runPullFlow(
          verb as "Deposit" | "Settle" | "Supply",
          asset,
          raw,
          address,
          noxClient,
        );
      } else {
        await runPushFlow(
          verb as "Withdraw" | "Borrow" | "Unsupply",
          asset,
          raw,
          noxClient,
        );
      }
      await refetch();
      setPendingStep(null);
      setPendingVerb(null);
      return true;
    } catch (err: any) {
      console.error("allocate failed", err);
      setStepError(err?.shortMessage ?? err?.message ?? "transaction failed");
      setPendingStep(null);
      setPendingVerb(null);
      return false;
    }
  }

  async function readCBalance(
    wrapper: Address,
    user: Address,
    noxClient: NoxHandleClient,
    cSym: string,
  ): Promise<bigint> {
    const handle = (await publicClient.readContract({
      address: wrapper,
      abi: erc7984Abi,
      functionName: "confidentialBalanceOf",
      args: [user],
    })) as `0x${string}`;
    if (!handle || handle === "0x" || handle === ZERO_HANDLE) return 0n;
    try {
      return await noxClient.decrypt(handle);
    } catch (err: any) {
      const msg = err?.shortMessage ?? err?.message ?? String(err);
      if (/network|fetch|gateway|timeout|secrets/i.test(msg)) {
        throw new Error(
          `cannot read confidential ${cSym} balance (gateway unreachable). Aborting before wrap to avoid double-wrapping. Retry in a moment.`,
        );
      }
      return 0n;
    }
  }

  async function ensureWrapped(
    asset: AssetMeta,
    raw: bigint,
    user: Address,
    noxClient: NoxHandleClient,
  ): Promise<void> {
    const wrapper = asset.cToken;
    const underlying = asset.underlying;
    const sym = asset.symbol.toLowerCase();
    const cSym = `c${sym}`;

    let cBalance = await readCBalance(wrapper, user, noxClient, cSym);
    if (cBalance >= raw) return; // nothing to wrap

    const toWrap = raw - cBalance;

    const queueAddr = asset.wrapQueue;
    const ZERO = "0x0000000000000000000000000000000000000000";
    if (asset.hasMixer && queueAddr && queueAddr.toLowerCase() !== ZERO) {
      // ---- Anonymous wrap via WrapQueue (TEE batch) ----
      const allowance = (await publicClient.readContract({
        address: underlying,
        abi: erc20Abi,
        functionName: "allowance",
        args: [user, queueAddr],
      })) as bigint;
      if (allowance < toWrap) {
        setPendingStep(`approve ${sym} → mixer (one-time)…`);
        await writeContractAsync({
          address: underlying,
          abi: erc20Abi,
          functionName: "approve",
          args: [queueAddr, MAX_UINT256],
          ...APPROVE_GAS_OVERRIDES,
        });
      }
      setPendingStep(`queueing ${sym} for tee batch (anonymous)…`);
      await writeContractAsync({
        address: queueAddr,
        abi: wrapQueueAbi,
        functionName: "queueWrap",
        args: [toWrap, user],
        ...QUEUE_GAS_OVERRIDES,
      });
      // Wait for the keeper to process the batch.
      const start = Date.now();
      while (Date.now() - start < MIXER_BATCH_TIMEOUT_MS) {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setPendingStep(
          `waiting for tee batch · ~${elapsed}s · cTokens land at your address`,
        );
        await new Promise((r) => setTimeout(r, MIXER_POLL_INTERVAL_MS));
        try {
          cBalance = await readCBalance(wrapper, user, noxClient, cSym);
          if (cBalance >= raw) return;
        } catch {
          // gateway hiccup — keep polling
        }
      }
      throw new Error(
        `mixer batch did not settle in ${Math.round(
          MIXER_BATCH_TIMEOUT_MS / 60_000,
        )} min. Try again in a moment.`,
      );
    }

    // ---- Direct wrap (asset has no WrapQueue deployed) ----
    const allowance = (await publicClient.readContract({
      address: underlying,
      abi: erc20Abi,
      functionName: "allowance",
      args: [user, wrapper],
    })) as bigint;
    if (allowance < toWrap) {
      setPendingStep(`approve ${sym} (one-time)…`);
      await writeContractAsync({
        address: underlying,
        abi: erc20Abi,
        functionName: "approve",
        args: [wrapper, MAX_UINT256],
        ...APPROVE_GAS_OVERRIDES,
      });
    }
    setPendingStep(`wrapping ${sym} → ${cSym}…`);
    await writeContractAsync({
      address: wrapper,
      abi: erc7984Abi,
      functionName: "wrap",
      args: [user, toWrap],
      ...WRAP_GAS_OVERRIDES,
    });
  }

  async function runPullFlow(
    verb: "Deposit" | "Settle" | "Supply",
    asset: AssetMeta,
    raw: bigint,
    user: Address,
    noxClient: NoxHandleClient,
  ) {
    const wrapper = asset.cToken;
    const sym = asset.symbol.toLowerCase();

    await ensureWrapped(asset, raw, user, noxClient);

    const isOp = (await publicClient.readContract({
      address: wrapper,
      abi: erc7984Abi,
      functionName: "isOperator",
      args: [user, env.VAULT_ADDRESS],
    })) as boolean;
    if (!isOp) {
      setPendingStep("granting vault operator rights…");
      const until = Math.floor(Date.now() / 1000) + OPERATOR_TTL_SECS;
      await writeContractAsync({
        address: wrapper,
        abi: erc7984Abi,
        functionName: "setOperator",
        args: [env.VAULT_ADDRESS, until],
        ...LIGHT_GAS_OVERRIDES,
      });
    }

    setPendingStep("encrypting amount…");
    const { handle, handleProof } = await noxClient.encryptInput(
      raw,
      "uint256",
      env.VAULT_ADDRESS,
    );

    if (verb === "Deposit") {
      setPendingStep(`submitting deposit-${sym}…`);
      await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "depositCollateral",
        args: [asset.underlying, handle, handleProof],
        ...FHE_GAS_OVERRIDES,
      });
    } else {
      const fn = verb === "Settle" ? "repay" : "supplyLiquidity";
      const label = verb === "Settle" ? "repay" : "supply-liquidity";
      setPendingStep(`submitting ${label}…`);
      // The third arg (`raw`) is the plaintext amount needed by the vault to
      // maintain its public totalDebt / totalSupplied counters and derive a
      // live utilization-based APR. Individual user balances stay encrypted.
      await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: fn,
        args: [handle, handleProof, raw],
        ...FHE_GAS_OVERRIDES,
      });
    }
  }

  async function runPushFlow(
    verb: "Withdraw" | "Borrow" | "Unsupply",
    asset: AssetMeta,
    raw: bigint,
    noxClient: NoxHandleClient,
  ) {
    console.log("[push] enter", { verb, asset: asset.symbol, raw: raw.toString() });
    setPendingStep("encrypting amount…");
    console.log("[push] encryptInput…");
    const { handle, handleProof } = await noxClient.encryptInput(
      raw,
      "uint256",
      env.VAULT_ADDRESS,
    );
    console.log("[push] encryptInput ✓", { handle, handleProof: handleProof.slice(0, 18) + "…" });
    if (verb === "Withdraw") {
      setPendingStep(`submitting withdraw-${asset.symbol.toLowerCase()}…`);
      console.log("[push] writeContract: withdrawCollateral");
      const tx = await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "withdrawCollateral",
        args: [asset.underlying, handle, handleProof],
        ...FHE_GAS_OVERRIDES,
      });
      console.log("[push] tx submitted ✓", tx);
    } else {
      const fn = verb === "Borrow" ? "borrow" : "withdrawLiquidity";
      const label = verb === "Borrow" ? "borrow" : "withdraw-liquidity";
      setPendingStep(`submitting ${label}…`);
      console.log("[push] writeContract:", fn);
      // `raw` is the plaintext amount fed into the vault's public aggregate
      // counters (utilization). Encrypted handle still drives privacy.
      const tx = await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: fn,
        args: [handle, handleProof, raw],
        ...FHE_GAS_OVERRIDES,
      });
      console.log("[push] tx submitted ✓", tx);
    }
  }

  return {
    allocate,
    pendingVerb,
    pendingStep,
    stepError,
    setStepError,
    busy: isPending || !!pendingVerb,
    nox,
    noxLoading,
    noxError,
  };
}

// Backwards-compat exports — some pages still import these constants.
export const COLLATERAL_DECIMALS = ASSETS.RLC.decimals;
export const DEBT_DECIMALS = DEBT_ASSET.decimals;
export const decimalsForVerb = (v: Verb) =>
  v === "Deposit" || v === "Withdraw" ? COLLATERAL_DECIMALS : DEBT_DECIMALS;
