"use client";

import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { useEffect, useState, type ReactNode } from "react";
import { useViewKey, VIEW_KEY_MESSAGE } from "@/context/ViewKeyContext";
import { useTypewriter } from "@/hooks/useTypewriter";
import { TerminalButton } from "./primitives/TerminalButton";
import { cn } from "@/lib/cn";

/**
 * Two-stage gate: wallet connect → session challenge signature. Each stage
 * types its own boot sequence, then reveals the relevant buttons.
 */
export function WalletGate({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync, isPending: signing } = useSignMessage();
  const { viewKey, setViewKey } = useViewKey();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected) setViewKey(null);
  }, [isConnected, address, setViewKey]);

  if (!isConnected) {
    return (
      <ConnectGate
        connectors={connectors as any}
        connect={connect as any}
        connecting={connecting}
        error={error}
      />
    );
  }
  if (!viewKey) {
    return (
      <SignGate
        address={address}
        signing={signing}
        signMessageAsync={signMessageAsync}
        disconnect={disconnect}
        setViewKey={setViewKey}
        error={error}
        setError={setError}
      />
    );
  }
  return <>{children}</>;
}

// ---------------------------------------------------------------------------

function ConnectGate({
  connectors,
  connect,
  connecting,
  error,
}: {
  connectors: readonly { uid: string; name: string }[];
  connect: (args: { connector: any }) => void;
  connecting: boolean;
  error: string | null;
}) {
  const LINES = [
    { text: "# discretion-shell v0.1.0", delay: 0, tone: "text-ink-tertiary" },
    { text: "> booting secure vault runtime…", delay: 400, tone: "text-ink-tertiary" },
    { text: "> probing wallet provider…", delay: 1100, tone: "text-ink-tertiary" },
    { text: "[error] no authenticated session detected.", delay: 1800, tone: "text-crit phos-glow-soft" },
    { text: "> select an authenticator to continue:", delay: 2600, tone: "text-phos phos-glow-soft" },
  ];
  const revealAfter = 3400;
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReveal(true), revealAfter);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-full flex items-center justify-center px-10">
      <div className="max-w-xl w-full font-mono text-sm space-y-1.5">
        {LINES.map((line, i) => (
          <TypeLine key={i} text={line.text} delay={line.delay} className={line.tone} />
        ))}
        <div
          className={cn(
            "flex flex-col gap-2 pt-4 transition-opacity duration-500",
            reveal ? "opacity-100" : "opacity-0",
          )}
        >
          {connectors.map((c) => (
            <TerminalButton
              key={c.uid}
              variant="secondary"
              disabled={connecting || !reveal}
              onClick={() => connect({ connector: c as any })}
              className="justify-start"
            >
              {connecting ? "$ CONNECTING…" : `$ LOGIN --via ${c.name.toUpperCase()}`}
            </TerminalButton>
          ))}
        </div>
        {error && <div className="text-crit pt-2">{error}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SignGate({
  address,
  signing,
  signMessageAsync,
  disconnect,
  setViewKey,
  error,
  setError,
}: {
  address?: string;
  signing: boolean;
  signMessageAsync: (args: { message: string }) => Promise<string>;
  disconnect: () => void;
  setViewKey: (k: string | null) => void;
  error: string | null;
  setError: (e: string | null) => void;
}) {
  const LINES = [
    { text: `# wallet detected ${address?.slice(0, 10)}…${address?.slice(-6)}`, delay: 0, tone: "text-ink-tertiary" },
    { text: "> requesting session view key…", delay: 400, tone: "text-ink-tertiary" },
    { text: "# sign the challenge to authorize decryption", delay: 1100, tone: "text-ink-tertiary" },
    { text: "# nothing is stored — in-memory, session-only", delay: 1600, tone: "text-ink-tertiary" },
  ];
  const revealAfter = 2400;
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReveal(true), revealAfter);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-full flex items-center justify-center px-10">
      <div className="max-w-xl w-full font-mono text-sm space-y-1.5">
        {LINES.map((line, i) => (
          <TypeLine key={i} text={line.text} delay={line.delay} className={line.tone} />
        ))}
        <div
          className={cn(
            "flex flex-col gap-2 pt-4 transition-opacity duration-500",
            reveal ? "opacity-100" : "opacity-0",
          )}
        >
          <TerminalButton
            variant="primary"
            glitch
            disabled={signing || !reveal}
            className="justify-start"
            onClick={async () => {
              setError(null);
              try {
                const sig = await signMessageAsync({ message: VIEW_KEY_MESSAGE });
                setViewKey(sig);
              } catch (e: any) {
                setError(e?.shortMessage ?? e?.message ?? "signature rejected.");
              }
            }}
          >
            {signing ? "$ AWAITING SIGNATURE…" : "$ ./SIGN-CHALLENGE --CONFIRM"}
          </TerminalButton>
          <TerminalButton
            variant="ghost"
            onClick={() => disconnect()}
            className="justify-start !h-8 !px-2"
          >
            $ LOGOUT
          </TerminalButton>
        </div>
        {error && <div className="text-crit pt-2">{error}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TypeLine({
  text,
  delay,
  className,
}: {
  text: string;
  delay: number;
  className?: string;
}) {
  const { display, done } = useTypewriter(text, { delay, msPerChar: 14 });
  return (
    <div className={cn("whitespace-pre-wrap", className)}>
      {display}
      {!done && <span className="animate-blink-hard text-phos">█</span>}
    </div>
  );
}
