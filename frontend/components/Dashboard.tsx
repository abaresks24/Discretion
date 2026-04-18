"use client";

import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, toHex } from "viem";
import { PositionCard } from "./PositionCard";
import { AllocatePanel } from "./AllocatePanel";
import { CounselPanel } from "./CounselPanel";
import { usePosition, placeholderDecrypt } from "@/hooks/usePosition";
import { useCounsel } from "@/hooks/useCounsel";
import { useViewKey } from "@/context/ViewKeyContext";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import type { SuggestedAction } from "@/lib/relayer";

export function Dashboard() {
  const { address } = useAccount();
  const { viewKey } = useViewKey();
  const { collateralHandle, debtHandle, ltvHandle, zone, refetch } =
    usePosition(address);
  const counsel = useCounsel(address, viewKey);
  const { writeContractAsync, isPending } = useWriteContract();

  // FIXME(nox): replace placeholder decrypt with a relayer call — see usePosition.
  const collateralRaw = placeholderDecrypt(collateralHandle);
  const debtRaw = placeholderDecrypt(debtHandle);
  const ltvBps = Number(placeholderDecrypt(ltvHandle));

  // Placeholder decimal config mirrors the vault deploy default (8/6).
  const collateralAmount = Number(collateralRaw) / 1e8;
  const debtAmount = Number(debtRaw) / 1e6;
  const collateralUsd = collateralAmount * 3000;
  const ltvPct = Number.isFinite(ltvBps) ? ltvBps / 100 : 0;

  async function handleAllocate(
    verb: "Deposit" | "Withdraw" | "Borrow" | "Settle",
    amount: string,
  ) {
    const raw = parseUnits(amount, verb === "Deposit" || verb === "Withdraw" ? 8 : 6);
    // FIXME(nox): swap to encrypted-input encoding once Nox input proofs are wired.
    const encoded = toHex(raw, { size: 32 });

    const functionName =
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
      functionName,
      args: [encoded],
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
