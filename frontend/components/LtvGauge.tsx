"use client";

import { DecryptedNumber } from "./DecryptedNumber";
import { StatusPill } from "./StatusPill";
import { cn } from "@/lib/cn";

const STROKE_BG = "#2A2A2A";

const ZONE_STROKE: Record<number, string> = {
  0: "#84A07C",
  1: "#C9974A",
  2: "#C9974A",
  3: "#A6453B",
};

/**
 * Circular SVG gauge for LTV. Background ring + filled arc colored by zone.
 * Arc fraction = min(value / maxDisplay, 1). The display maps zones safe →
 * danger as the arc grows clockwise from the top.
 */
export function LtvGauge({
  ltvPercent,
  zone,
  size = 220,
  maxDisplay = 100,
  className,
}: {
  ltvPercent: number;
  zone: number;
  size?: number;
  maxDisplay?: number;
  className?: string;
}) {
  const stroke = 1.5;
  const radius = (size - stroke) / 2 - 6;
  const circ = 2 * Math.PI * radius;
  const fraction = Math.min(Math.max(ltvPercent / maxDisplay, 0), 1);
  const dash = circ * fraction;
  const zoneColor = ZONE_STROKE[zone] ?? ZONE_STROKE[0];

  return (
    <div className={cn("flex flex-col items-center gap-6", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={STROKE_BG}
            strokeWidth={stroke}
          />
          {/* filled arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={zoneColor}
            strokeWidth={stroke}
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: "stroke-dasharray 800ms cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <DecryptedNumber
            value={ltvPercent}
            size="xl"
            unit="%"
            unitClassName="text-ink-secondary"
          />
          <span className="type-caption mt-2">LOAN-TO-VALUE</span>
        </div>
      </div>
      <StatusPill zone={zone} />
    </div>
  );
}
