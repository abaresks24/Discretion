"use client";

import { Card } from "./Card";
import { LtvGauge } from "./LtvGauge";
import { DecryptedNumber } from "./DecryptedNumber";

/**
 * Column 1 — borrower-side position only. LP stats live in the LenderActionsCard
 * so the cognitive surfaces are separate: this card answers "how risky am I?",
 * not "what am I earning as an LP?".
 */
export function PositionCard({
  ltvPercent,
  zone,
  collateralAmount,
  collateralUsd,
  debtAmount,
  debtUsd: _debtUsd,
  liquidationThresholdPct,
}: {
  ltvPercent: number;
  zone: number;
  collateralAmount: number;
  collateralUsd: number;
  debtAmount: number;
  debtUsd: number;
  liquidationThresholdPct: number;
}) {
  return (
    <Card label="position" className="h-full">
      <LtvGauge ltvPercent={ltvPercent} zone={zone} />

      <div className="h-px bg-terminal-border" />

      <div className="flex flex-col gap-2 font-mono">
        <Line
          label="collateral"
          value={
            <DecryptedNumber
              value={collateralAmount}
              unit="RLC"
              size="md"
              decimals={4}
            />
          }
        />
        <Line
          label="  ≈ in usd"
          value={<DecryptedNumber value={collateralUsd} unit="USD" size="sm" />}
          faint
        />
      </div>

      <div className="h-px bg-terminal-border" />

      <div className="flex flex-col gap-2 font-mono">
        <Line
          label="debt      "
          value={
            <DecryptedNumber
              value={debtAmount}
              unit="USDC"
              size="md"
              decimals={2}
            />
          }
        />
        <Line
          label="  liq @"
          value={
            <span className="text-terminal-fade font-mono tabular-nums text-[11px]">
              {liquidationThresholdPct.toFixed(0)}.00%
            </span>
          }
          faint
        />
      </div>
    </Card>
  );
}

function Line({
  label,
  value,
  faint,
}: {
  label: string;
  value: React.ReactNode;
  faint?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className={faint ? "text-terminal-fade" : "text-terminal-dim"}>
        {label}
      </span>
      <span className="text-terminal-fade">:</span>
      <span>{value}</span>
    </div>
  );
}
