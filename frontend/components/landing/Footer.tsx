import Link from "next/link";
import { Logo } from "../primitives/Logo";

const SOCIALS = [
  { label: "GITHUB", href: "https://github.com/abaresks24/Discretion" },
  { label: "TWITTER", href: "https://twitter.com" },
  { label: "TELEGRAM", href: "https://t.me" },
];

export function Footer() {
  return (
    <footer className="px-6 md:px-12 py-12 border-t border-ink-tertiary">
      <div className="max-w-6xl flex flex-wrap items-end justify-between gap-8">
        <div className="space-y-3">
          <Logo size={22} />
          <p className="text-[10px] uppercase tracking-widest text-ink-tertiary">
            built on iexec nox · arbitrum sepolia · 2026
          </p>
        </div>
        <ul className="flex flex-wrap gap-6 text-[11px] uppercase tracking-widest font-mono">
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="cursor-target text-ink-secondary hover:text-phos transition-colors"
              >
                {s.label} ↗
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-12 font-mono text-sm text-ink-tertiary">
        <span className="text-phos animate-blink-hard">█</span> _
      </div>
    </footer>
  );
}
