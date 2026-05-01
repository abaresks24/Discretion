"use client";

import { WalletGate } from "@/components/WalletGate";
import { ScreenShell } from "@/components/app/ScreenShell";
import { AsciiCard } from "@/components/primitives/AsciiCard";
import { ActivityLog } from "@/components/app/ActivityLog";

export default function HistoryPage() {
  return (
    <WalletGate>
      <HistoryScreen />
    </WalletGate>
  );
}

function HistoryScreen() {
  return (
    <ScreenShell
      tag="/journal"
      title="your journal."
      subtitle="your own actions only · amounts always sealed"
    >
      <AsciiCard title="your events">
        <ActivityLog mineOnly limit={80} />
        <div className="mt-3 font-mono text-[10px] text-ink-tertiary leading-snug border-t border-dashed border-ink-tertiary/60 pt-3">
          # only your address is shown here. other users' on-chain actions
          are public events readable from any block explorer, but we don't
          surface them here — privacy by default.
        </div>
      </AsciiCard>
    </ScreenShell>
  );
}
