"use client";

import Link from "next/link";
import { MatrixRain } from "./MatrixRain";
import { ScrambleText } from "../primitives/ScrambleText";
import { TerminalButton } from "../primitives/TerminalButton";

export function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-56px)] flex items-center px-6 md:px-12">
      <div className="absolute inset-0 -z-10 opacity-70">
        <MatrixRain />
      </div>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-bg/40 via-bg/70 to-bg pointer-events-none" />

      <div className="relative max-w-5xl w-full flex flex-col gap-10">
        <div className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.3em] text-ink-secondary">
          <span className="text-phos">▸ /daemon/discretion</span>
          <span className="text-ink-tertiary">
            confidential vault · iexec tee · arbitrum sepolia
          </span>
        </div>

        <h1 className="font-mono font-normal leading-[1.02] text-[54px] md:text-[80px] text-ink-primary">
          <span className="block">
            <ScrambleText text="YOUR ASSETS." onMount />
          </span>
          <span className="block text-phos phos-glow">
            <ScrambleText text="ZERO WITNESSES." onMount duration={500} />
          </span>
        </h1>

        <p className="max-w-2xl text-ink-secondary text-sm leading-relaxed">
          A confidential lending vault with on-chain mixing, powered by
          iExec&apos;s TEE. Deposit, borrow and supply liquidity — your
          balances, your LTV, your activity, all sealed end-to-end.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href="/app">
            <TerminalButton variant="primary" glitch>
              LAUNCH APP →
            </TerminalButton>
          </Link>
          <Link href="/about">
            <TerminalButton variant="secondary">READ DOCS</TerminalButton>
          </Link>
        </div>

        <div className="pt-6 text-[10px] uppercase tracking-widest text-ink-tertiary">
          <span className="animate-blink-hard text-phos">█</span> awaiting
          instructions
        </div>
      </div>
    </section>
  );
}
