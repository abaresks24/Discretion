"use client";

import { Card } from "./Card";
import { truncateAddress } from "@/lib/format";
import { useAccount } from "wagmi";

/**
 * /app/public-view — the terminal in "external observer" mode. Everything
 * confidential is redacted to `████████` and Counsel is explicitly blocked.
 */
export function PublicView() {
  const { address } = useAccount();

  return (
    <div className="px-10 py-10 max-w-[1400px] mx-auto font-mono">
      <div className="flex flex-col items-start gap-1 pb-10 text-sm">
        <div className="text-terminal-fade"># whoami — external_observer</div>
        <div className="text-terminal-danger terminal-glow">
          [access_denied] confidential payload is end-to-end encrypted.
        </div>
        <div className="text-terminal-dim pt-2">
          # everything a public observer sees about this vault appears below.
        </div>
      </div>

      <div className="grid grid-cols-[416px_416px_464px] gap-8">
        <Card label="position">
          <VeiledRow label="loan-to-value" unit="%" />
          <VeiledRow label="collateral" unit="RLC" />
          <VeiledRow label="debt" unit="USDC" />
        </Card>

        <Card label="activity">
          <ul className="flex flex-col divide-y divide-terminal-border text-sm">
            {sampleActivity.map((row, i) => (
              <li key={i} className="flex items-center justify-between py-3 gap-3">
                <span className="text-terminal-fade">{row.tx}</span>
                <span className="text-terminal-dim">{row.cmd}</span>
                <span className="text-terminal-danger">████████</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card label="counsel://root" className="min-h-[320px]">
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <div className="text-terminal-danger terminal-glow text-sm">
              [access_denied]
            </div>
            <div className="text-terminal-fade text-sm max-w-xs">
              # counsel is scoped to the vault holder only.
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-14 text-terminal-dim text-sm text-center">
        # any observer can see this address used the protocol.
        <br />
        # nobody can see how, when, or with what.
      </div>

      {address && (
        <div className="mt-3 text-xs text-terminal-fade text-center">
          {truncateAddress(address)}
        </div>
      )}
    </div>
  );
}

function VeiledRow({ label, unit }: { label: string; unit?: string }) {
  return (
    <div className="flex items-baseline justify-between py-3 border-b border-terminal-border last:border-0 text-sm">
      <span className="text-terminal-dim">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-terminal-danger">████████</span>
        {unit && (
          <span className="text-terminal-fade text-xs uppercase tracking-widest">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

const sampleActivity = [
  { tx: "0x9b5a…e241", cmd: "$ ./deposit" },
  { tx: "0x3f01…4bba", cmd: "$ ./borrow" },
  { tx: "0xa719…c0d3", cmd: "$ ./repay" },
  { tx: "0x24e8…9fa5", cmd: "$ ./deposit" },
  { tx: "0x11dc…7712", cmd: "$ ./borrow" },
  { tx: "0xf502…0abe", cmd: "$ ./repay" },
];
