"use client";

import Link from "next/link";
import { Logo } from "../primitives/Logo";
import { ScrambleText } from "../primitives/ScrambleText";

const NAV = [
  { label: "DOCS", href: "/about" },
  { label: "APP", href: "/app" },
  { label: "GITHUB", href: "https://github.com/abaresks24/Discretion" },
];

export function LandingNav() {
  return (
    <header className="px-6 md:px-12 h-14 flex items-center justify-between border-b border-ink-tertiary sticky top-0 z-40 bg-bg/85 backdrop-blur-sm">
      <Link href="/" className="flex items-center cursor-target">
        <Logo size={22} />
      </Link>
      <nav>
        <ul className="flex gap-6 text-[11px] uppercase tracking-[0.2em] font-mono">
          {NAV.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                className="cursor-target text-ink-secondary hover:text-phos transition-colors"
              >
                <ScrambleText text={item.label} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
