"use client";

import { useState } from "react";
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

// MetaMask's eth_estimateGas + fee suggestion is broken on Arbitrum Sepolia
// for FHE-heavy calls — it sometimes returns absurd gas (7900 ETH suggestions)
// and at other times sets maxFeePerGas below the live base fee, causing
// reverts with "max fee per gas less than block base fee". We sidestep both
// by hard-coding generous limits. Arbitrum sequencer ignores priority fee, so
// 0 is fine; 0.1 gwei caps the *displayed* MetaMask max — actual paid cost is
// gasUsed × base fee (~0.02 gwei), so a couple of microcents per tx.
const FHE_GAS_OVERRIDES = {
  gas: 1_500_000n,
  maxFeePerGas: 100_000_000n, // 0.1 gwei
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

export type Verb =
  | "Deposit"
  | "Withdraw"
  | "Borrow"
  | "Settle"
  | "Supply"
  | "Unsupply";

export const isPullVerb = (v: Verb) =>
  v === "Deposit" || v === "Settle" || v === "Supply";

/** Default asset for a verb when the caller doesn't specify one. */
function defaultAssetForVerb(v: Verb): AssetMeta {
  if (v === "Deposit" || v === "Withdraw") return COLLATERAL_ASSETS[0]; // RLC
  return DEBT_ASSET; // USDC for Borrow / Settle / Supply / Unsupply
}

/**
 * Unified entry point for every user allocation.
 * `opts.assetSymbol` selects which collateral asset Deposit / Withdraw target.
 * Borrow / Settle / Supply / Unsupply always operate on the single debt asset
 * (USDC) so the asset is implicit.
 */
export function useAllocate() {
  const { address } = useAccount();
  const { client: nox, isLoading: noxLoading, error: noxError } = useNoxHandle();
  const { writeContractAsync, isPending } = useWriteContract();
  const { refetch } = usePosition(address);

  const [pendingVerb, setPendingVerb] = useState<Verb | null>(null);
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  async function allocate(
    verb: Verb,
    amount: string,
    opts: { mixer?: boolean; assetSymbol?: string } = {},
  ) {
    if (!address) {
      setStepError("connect a wallet first");
      return;
    }
    if (!nox) {
      setStepError(
        noxLoading
          ? "nox gateway still initialising — retry in ~5s"
          : "nox gateway unavailable — see devtools",
      );
      return;
    }
    const asset = opts.assetSymbol
      ? ASSETS[opts.assetSymbol.toUpperCase()] ?? defaultAssetForVerb(verb)
      : defaultAssetForVerb(verb);
    if (!asset) {
      setStepError(`unknown asset: ${opts.assetSymbol}`);
      return;
    }
    const raw = parseUnits(amount, asset.decimals);
    setStepError(null);
    setPendingVerb(verb);
    try {
      if (verb === "Deposit" && opts.mixer && asset.hasMixer) {
        await runMixerQueueFlow(asset, raw, address);
        setPendingStep(
          `queued · iapp will batch within 2–5 min · c${asset.symbol} arrives in your wallet`,
        );
        await new Promise((r) => setTimeout(r, 8000));
      } else if (isPullVerb(verb)) {
        await runPullFlow(verb as "Deposit" | "Settle" | "Supply", asset, raw, address, nox);
      } else {
        await runPushFlow(verb as "Withdraw" | "Borrow" | "Unsupply", asset, raw, nox);
      }
      await refetch();
    } catch (err: any) {
      console.error("allocate failed", err);
      setStepError(err?.shortMessage ?? err?.message ?? "transaction failed");
    } finally {
      setPendingStep(null);
      setPendingVerb(null);
    }
  }

  async function runMixerQueueFlow(asset: AssetMeta, raw: bigint, user: Address) {
    if (!asset.hasMixer) {
      throw new Error(`${asset.symbol} has no mixer`);
    }
    const currentAllowance = (await publicClient.readContract({
      address: asset.underlying,
      abi: erc20Abi,
      functionName: "allowance",
      args: [user, env.WRAP_QUEUE_ADDRESS],
    })) as bigint;
    if (currentAllowance < raw) {
      setPendingStep(
        `approving ${asset.symbol.toLowerCase()} → wrap_queue (one-time, unlimited)…`,
      );
      await writeContractAsync({
        address: asset.underlying,
        abi: erc20Abi,
        functionName: "approve",
        args: [env.WRAP_QUEUE_ADDRESS, MAX_UINT256],
        ...APPROVE_GAS_OVERRIDES,
      });
    }
    setPendingStep("queueing wrap for tee batch…");
    await writeContractAsync({
      address: env.WRAP_QUEUE_ADDRESS,
      abi: wrapQueueAbi,
      functionName: "queueWrap",
      args: [raw, user],
      gas: 200_000n,
      maxFeePerGas: 100_000_000n,
      maxPriorityFeePerGas: 0n,
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
    const underlying = asset.underlying;
    const sym = asset.symbol.toLowerCase();
    const cSym = `c${asset.symbol.toLowerCase()}`;

    let cBalance = 0n;
    try {
      const handle = (await publicClient.readContract({
        address: wrapper,
        abi: erc7984Abi,
        functionName: "confidentialBalanceOf",
        args: [user],
      })) as `0x${string}`;
      cBalance = await noxClient.decrypt(handle);
    } catch {
      /* no ACL yet — assume zero confidential balance */
    }

    if (cBalance < raw) {
      const toWrap = raw - cBalance;
      const currentAllowance = (await publicClient.readContract({
        address: underlying,
        abi: erc20Abi,
        functionName: "allowance",
        args: [user, wrapper],
      })) as bigint;
      if (currentAllowance < toWrap) {
        setPendingStep(`approving ${sym} (one-time, unlimited)…`);
        // Explicit gas limit sidesteps a MetaMask bug on Arbitrum Sepolia
        // where eth_estimateGas sporadically returns "unavailable" for
        // ERC-20 approvals, blocking the user from confirming in MetaMask.
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

    const isOp = (await publicClient.readContract({
      address: wrapper,
      abi: erc7984Abi,
      functionName: "isOperator",
      args: [user, env.VAULT_ADDRESS],
    })) as boolean;
    if (!isOp) {
      setPendingStep("granting vault operator rights…");
      const until = Math.floor(Date.now() / 1000) + OPERATOR_TTL_SECS;
      // Explicit gas: MetaMask's eth_estimateGas is unreliable on Arbitrum
      // Sepolia for FHE-related calls and shows absurd suggestions like
      // "7900 ETH". Hardcoded limits are well above actual usage.
      await writeContractAsync({
        address: wrapper,
        abi: erc7984Abi,
        functionName: "setOperator",
        args: [env.VAULT_ADDRESS, until],
        ...LIGHT_GAS_OVERRIDES,
      });
    }

    setPendingStep("encrypting amount…");
    // The proof's applicationContract must be the contract the user signs
    // against (the vault) — not the inner cToken that the vault relays the
    // confidentialTransferFrom call into. Using `wrapper` here causes
    // "Owner mismatch" inside the cToken's Nox.fromExternal verifier.
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
      await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: fn,
        args: [handle, handleProof],
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
    setPendingStep("encrypting amount…");
    const { handle, handleProof } = await noxClient.encryptInput(
      raw,
      "uint256",
      env.VAULT_ADDRESS,
    );
    if (verb === "Withdraw") {
      setPendingStep(`submitting withdraw-${asset.symbol.toLowerCase()}…`);
      await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "withdrawCollateral",
        args: [asset.underlying, handle, handleProof],
        ...FHE_GAS_OVERRIDES,
      });
    } else {
      const fn = verb === "Borrow" ? "borrow" : "withdrawLiquidity";
      const label = verb === "Borrow" ? "borrow" : "withdraw-liquidity";
      setPendingStep(`submitting ${label}…`);
      await writeContractAsync({
        address: env.VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: fn,
        args: [handle, handleProof],
        ...FHE_GAS_OVERRIDES,
      });
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
