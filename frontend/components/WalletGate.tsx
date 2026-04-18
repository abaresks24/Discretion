"use client";

import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { useEffect, useState, type ReactNode } from "react";
import { useViewKey, VIEW_KEY_MESSAGE } from "@/context/ViewKeyContext";
import { GoldHairline } from "./GoldHairline";
import { cn } from "@/lib/cn";

/**
 * Centered serif CTA when no wallet is connected. Once connected, prompts
 * the user to sign the view-key message one time per session. The view key
 * is kept in memory only (brief, "Wallet connection flow").
 */
export function WalletGate({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: signing } = useSignMessage();
  const { viewKey, setViewKey } = useViewKey();
  const [error, setError] = useState<string | null>(null);

  // Reset view key if the wallet changes.
  useEffect(() => {
    if (!isConnected) setViewKey(null);
  }, [isConnected, address, setViewKey]);

  if (!isConnected) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-10 px-10">
        <GoldHairline vertical width={96} />
        <p className="type-display-md text-ink-primary">
          Please connect a wallet to enter.
        </p>
        <div className="flex flex-col gap-3">
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              onClick={() => connect({ connector: c })}
              disabled={connecting}
              className={cn(
                "h-12 px-8 rounded-[4px] bg-accent-gold text-bg type-label",
                "transition-colors duration-300 ease-out",
                "hover:bg-accent-goldDeep disabled:opacity-50",
              )}
            >
              {connecting ? "CONNECTING…" : `CONTINUE WITH ${c.name.toUpperCase()}`}
            </button>
          ))}
        </div>
        {error && <span className="type-caption text-zone-danger">{error}</span>}
      </div>
    );
  }

  if (!viewKey) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center gap-10 px-10 max-w-xl mx-auto text-center">
        <GoldHairline vertical width={96} />
        <p className="type-display-md text-ink-primary">
          Authorize this session.
        </p>
        <p className="type-body-serif text-ink-secondary">
          Counsel requires your signature to compose a view of your vault.
          Nothing is stored. The signature lives in memory for this session.
        </p>
        <button
          type="button"
          disabled={signing}
          onClick={async () => {
            setError(null);
            try {
              const sig = await signMessageAsync({ message: VIEW_KEY_MESSAGE });
              setViewKey(sig);
            } catch (e: any) {
              setError(e?.shortMessage ?? e?.message ?? "Signature rejected.");
            }
          }}
          className={cn(
            "h-12 px-8 rounded-[4px] bg-accent-gold text-bg type-label",
            "transition-colors duration-300 ease-out",
            "hover:bg-accent-goldDeep disabled:opacity-50",
          )}
        >
          {signing ? "AWAITING SIGNATURE…" : "SIGN TO PROCEED"}
        </button>
        <button
          type="button"
          onClick={() => disconnect()}
          className="link type-caption text-ink-secondary"
        >
          disconnect
        </button>
        {error && <span className="type-caption text-zone-danger">{error}</span>}
      </div>
    );
  }

  return <>{children}</>;
}
