"use client";

import { Card } from "./Card";
import { GoldHairline } from "./GoldHairline";
import { DiscretionMark } from "./Logo";
import { truncateAddress } from "@/lib/format";
import { useAccount } from "wagmi";

/**
 * /app/public-view — the "empty" version of the dashboard. The whole point
 * is that anyone looking at this address on-chain sees nothing meaningful.
 */
export function PublicView() {
  const { address } = useAccount();

  return (
    <div className="px-10 py-10 max-w-[1400px] mx-auto opacity-[0.92]">
      <div className="flex flex-col items-center gap-6 pb-14">
        <p className="type-display-md text-ink-primary text-center max-w-xl">
          This is what the world sees about your position.
        </p>
        <GoldHairline width={80} />
      </div>

      <div className="grid grid-cols-[416px_416px_464px] gap-8 opacity-60">
        <Card label="POSITION">
          <VeiledRow label="LOAN-TO-VALUE" />
          <VeiledRow label="COLLATERAL" unit="WETH" />
          <VeiledRow label="DEBT" unit="USDC" />
        </Card>

        <Card label="ACTIVITY">
          <ul className="flex flex-col divide-y divide-border-subtle">
            {sampleActivity.map((row, i) => (
              <li key={i} className="flex items-center justify-between py-4">
                <span className="font-mono text-[12px] text-ink-tertiary">
                  {row.tx}
                </span>
                <span className="font-serif italic text-ink-secondary">
                  {row.verb}
                </span>
                <span className="font-mono text-ink-veiled">████████</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card label="COUNSEL" className="min-h-[420px] items-center justify-center">
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <DiscretionMark size={48} className="text-ink-veiled" />
            <p className="type-body-serif text-ink-secondary text-center max-w-xs">
              Counsel is available only to the vault holder.
            </p>
          </div>
        </Card>
      </div>

      <p className="mt-16 type-body-serif text-ink-secondary text-center">
        Anyone can see this address used the protocol. No one can see how, when,
        or with what.
      </p>

      {address && (
        <p className="mt-3 font-mono text-[12px] text-ink-tertiary text-center">
          {truncateAddress(address)}
        </p>
      )}
    </div>
  );
}

function VeiledRow({ label, unit }: { label: string; unit?: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-y-1 gap-x-6 py-4 border-b border-border-subtle last:border-0">
      <span className="type-label">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-ink-veiled text-lg">████████</span>
        {unit && <span className="font-serif italic text-ink-veiled">{unit}</span>}
      </div>
    </div>
  );
}

const sampleActivity = [
  { tx: "0x9b5a…e241", verb: "Deposit collateral" },
  { tx: "0x3f01…4bba", verb: "Draw" },
  { tx: "0xa719…c0d3", verb: "Settle" },
  { tx: "0x24e8…9fa5", verb: "Reinforce" },
  { tx: "0x11dc…7712", verb: "Draw" },
  { tx: "0xf502…0abe", verb: "Settle" },
];
