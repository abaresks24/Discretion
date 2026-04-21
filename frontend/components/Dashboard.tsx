"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { PositionCard } from "./PositionCard";
import { AllocatePanel } from "./AllocatePanel";
import { CounselPanel } from "./CounselPanel";
import { usePosition } from "@/hooks/usePosition";
import { useCounsel } from "@/hooks/useCounsel";
import { vaultAbi, erc7984Abi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { encryptAmount, decryptHandle } from "@/lib/noxSdk";
import type { SuggestedAction } from "@/lib/relayer";

const TOKEN_DECIMALS = 6; // ERC-7984 spec recommendation; cRLC / cUSDC both follow.
const OPERATOR_TTL_SECS = 60 * 60; // 1h operator grant when depositing / repaying.

export function Dashboard() {
  const { address } = useAccount();
  const { collateralHandle, debtHandle, refetch } = usePosition(address);
  const counsel = useCounsel(address, null);
  const { writeContractAsync, isPending } = useWriteContract();

  const [collateralRaw, setCollateralRaw] = useState<bigint>(0n);
  const [debtRaw, setDebtRaw] = useState<bigint>(0n);

  // Decrypt handles on every change. Until the Nox SDK is wired these resolve
  // to 0n (see lib/noxSdk.ts), so the PositionCard shows a placeholder until
  // the gateway is plumbed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, d] = await Promise.all([
        decryptHandle(collateralHandle),
        decryptHandle(debtHandle),
      ]);
      if (!cancelled) {
        setCollateralRaw(c);
        setDebtRaw(d);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collateralHandle, debtHandle]);

  const collateralAmount = Number(collateralRaw) / 10 ** TOKEN_DECIMALS;
  const debtAmount = Number(debtRaw) / 10 ** TOKEN_DECIMALS;
  const collateralUsd = collateralAmount * 1.5; // placeholder until oracle read is added
  // Off-chain advisory LTV — relayer computes the canonical value; this mirrors it
  // for immediate UI feedback so actions feel responsive.
  const ltvPct =
    debtAmount > 0 && collateralUsd > 0
      ? Math.min((debtAmount / collateralUsd) * 100, 999)
      : 0;
  const zone = ltvPct >= 85 ? 3 : ltvPct >= 75 ? 2 : ltvPct >= 60 ? 1 : 0;

  async function handleAllocate(
    verb: "Deposit" | "Withdraw" | "Borrow" | "Settle",
    amount: string,
  ) {
    if (!address) return;
    const raw = parseUnits(amount, TOKEN_DECIMALS);
    const { handle, proof } = await encryptAmount(raw, address);

    // Deposits and settlements pull from the user's wallet → the vault must be
    // an operator on the relevant cToken first. One-time per TTL.
    if (verb === "Deposit" || verb === "Settle") {
      const cToken = verb === "Deposit" ? env.COLLATERAL_TOKEN : env.DEBT_TOKEN;
      const until = Math.floor(Date.now() / 1000) + OPERATOR_TTL_SECS;
      await writeContractAsync({
        address: cToken,
        abi: erc7984Abi,
        functionName: "setOperator",
        args: [env.VAULT_ADDRESS, until],
      });
    }

    const fn =
      verb === "Deposit"
        ? "depositCollateral"
        : verb === "Withdraw"
          ? "withdrawCollateral"
          : verb === "Borrow"
            ? "borrow"
            : "repay";

    await writeContractAsync({
      address: env.VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: fn,
      args: [handle, proof],
    });
    await refetch();
  }

  async function handleApplySuggestion(a: SuggestedAction) {
    if (a.type === "repay") return handleAllocate("Settle", a.amount_debt);
    if (a.type === "add_collateral")
      return handleAllocate("Deposit", a.amount_collateral);
    return handleAllocate("Withdraw", a.amount_collateral);
  }

  return (
    <div className="grid grid-cols-[416px_416px_464px] gap-8 px-10 py-10 max-w-[1400px] mx-auto">
      <PositionCard
        ltvPercent={ltvPct}
        zone={zone}
        collateralAmount={collateralAmount}
        collateralUsd={collateralUsd}
        debtAmount={debtAmount}
        debtUsd={debtAmount}
        liquidationThresholdPct={85}
      />
      <AllocatePanel
        currentLtvPct={ltvPct}
        onSubmit={handleAllocate}
        pending={isPending}
      />
      <CounselPanel
        messages={counsel.messages}
        pulse={counsel.pulse}
        isStreaming={counsel.isStreaming}
        onSend={counsel.send}
        onApplySuggestion={handleApplySuggestion}
      />
    </div>
  );
}
