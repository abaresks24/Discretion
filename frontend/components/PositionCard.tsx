"use client";

import { Card } from "./Card";
import { LtvGauge } from "./LtvGauge";
import { DecryptedNumber } from "./DecryptedNumber";
import { cn } from "@/lib/cn";

/**
 * Column 1 on the dashboard. LTV gauge up top, then COLLATERAL / DEBT rows.
 * All amounts run through <DecryptedNumber> — the 700ms reveal is the signature
 * entrance (brief, decorative #4).
 */
export function PositionCard({
  ltvPercent,
  zone,
  collateralAmount,
  collateralUsd,
  debtAmount,
  debtUsd,
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
    <Card label="POSITION">
      <div className="flex flex-col items-center pb-10">
        <LtvGauge ltvPercent={ltvPercent} zone={zone} />
      </div>

      <Row
        label="COLLATERAL"
        value={
          <DecryptedNumber
            value={collateralAmount}
            unit="RLC"
            size="md"
            decimals={4}
          />
        }
        caption={
          <span className="type-caption">
            ≈ <DecryptedNumber value={collateralUsd} unit="USD" size="sm" /> at spot
          </span>
        }
      />

      <div className="h-px bg-border-subtle my-6" />

      <Row
        label="DEBT"
        value={
          <DecryptedNumber
            value={debtAmount}
            unit="USDC"
            size="md"
            decimals={2}
          />
        }
        caption={
          <span className="type-caption">
            liquidation threshold · {liquidationThresholdPct.toFixed(0)}%
          </span>
        }
      />
    </Card>
  );
}

function Row({
  label,
  value,
  caption,
}: {
  label: string;
  value: React.ReactNode;
  caption: React.ReactNode;
}) {
  return (
    <div className={cn("grid grid-cols-[1fr_auto] gap-y-1 gap-x-6 items-baseline")}>
      <span className="type-label">{label}</span>
      <div className="text-right">{value}</div>
      <span />
      <div className="text-right">{caption}</div>
    </div>
  );
}
