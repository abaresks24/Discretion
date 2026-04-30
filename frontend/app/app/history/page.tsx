"use client";

import { useState } from "react";
import { WalletGate } from "@/components/WalletGate";
import { ScreenShell } from "@/components/app/ScreenShell";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { ActivityLog } from "@/components/app/ActivityLog";
import { cn } from "@/lib/cn";

const FILTERS = [
  { label: "ALL", mine: false },
  { label: "MINE", mine: true },
];

export default function HistoryPage() {
  return (
    <WalletGate>
      <HistoryScreen />
    </WalletGate>
  );
}

function HistoryScreen() {
  const [mine, setMine] = useState(false);

  return (
    <ScreenShell
      tag="/history"
      title="vault activity."
      subtitle="public events · amounts sealed"
      trailing={
        <div className="flex gap-2 font-mono text-[10px] uppercase tracking-widest">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setMine(f.mine)}
              className={cn(
                "px-3 py-1 border transition-colors",
                mine === f.mine
                  ? "border-phos text-phos phos-glow-soft"
                  : "border-ink-tertiary text-ink-secondary hover:text-phos",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      <AsciiCard title={mine ? "filter: my events" : "filter: all events"}>
        <ActivityLog mineOnly={mine} limit={80} />
      </AsciiCard>
    </ScreenShell>
  );
}
