"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { GoldHairline } from "./GoldHairline";
import { GlobeBackdrop } from "./GlobeBackdrop";

/**
 * Full-viewport landing hero. Header at top, centered block in the middle,
 * caption footer at the bottom. No scroll. No feature grid. The page IS the
 * hero (brief).
 *
 * The globe sits bottom-right, off-axis, low opacity — the single décor piece.
 */
export function LandingHero() {
  return (
    <main className="relative min-h-screen w-full landing-bg overflow-hidden">
      <GlobeBackdrop size={760} />

      <header className="relative z-10 flex items-center justify-between h-20 px-10 border-b border-border-subtle">
        <Logo size="sm" />
        <nav className="flex items-center gap-8">
          <Link href="/about" className="link type-label text-ink-secondary">
            ABOUT
          </Link>
          <Link
            href="/app"
            className="link type-label text-accent-gold"
          >
            LAUNCH APP
          </Link>
        </nav>
      </header>

      <section className="relative z-10 min-h-[calc(100vh-80px-40px)] flex flex-col items-center justify-center gap-10">
        <GoldHairline vertical width={120} animate />
        <h1
          className="type-display-xl text-ink-primary"
          style={{ letterSpacing: "0.14em" }}
        >
          DISCRETION
        </h1>
        <p className="type-display-md text-ink-secondary">
          Lending, in confidence.
        </p>
        <div className="flex items-center gap-6 pt-4">
          <Link href="/app" className="link type-label text-accent-gold">
            LAUNCH APP
          </Link>
          <span className="h-3 w-px bg-border" />
          <Link href="/about" className="link type-label text-ink-secondary">
            WATCH DEMO
          </Link>
        </div>
      </section>

      <footer className="relative z-10 pb-6 flex justify-center">
        <span className="type-caption">
          Built on iExec Nox · Powered by ChainGPT · Live on Arbitrum Sepolia
        </span>
      </footer>
    </main>
  );
}
