"use client";

import { useAccount, useBlockNumber, useDisconnect } from "wagmi";
import { TeeStatusDot } from "./TeeStatusDot";
import { TerminalButton } from "../primitives/TerminalButton";
import { truncateAddress } from "@/lib/format";

export function TopBar() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: block } = useBlockNumber({ watch: true });

  return (
    <header className="h-14 border-b border-ink-tertiary px-6 flex items-center justify-between bg-bg">
      <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-widest">
        <span className="text-ink-tertiary">net</span>
        <span className="text-phos">arb-sepolia</span>
        <span className="text-ink-tertiary">|</span>
        <span className="text-ink-tertiary">block</span>
        <span className="text-ink-secondary tabular-nums">
          #{block !== undefined ? block.toString() : "—"}
        </span>
        <TeeStatusDot />
      </div>

      <div className="flex items-center gap-3 font-mono text-[11px]">
        {isConnected && address ? (
          <>
            <span className="text-ink-secondary">{truncateAddress(address)}</span>
            <TerminalButton
              variant="ghost"
              onClick={() => disconnect()}
              className="!h-8 !px-2"
            >
              DISCONNECT
            </TerminalButton>
          </>
        ) : (
          <span className="text-ink-tertiary uppercase tracking-widest">
            not connected
          </span>
        )}
      </div>
    </header>
  );
}
