"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import type { Address } from "viem";
import { Logo } from "../primitives/Logo";
import { ScrambleText } from "../primitives/ScrambleText";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { cn } from "@/lib/cn";

type NavItem = { label: string; href: string; hint?: string };
type NavSection = { heading: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    heading: "home",
    items: [{ label: "Dashboard", href: "/app", hint: "overview & status" }],
  },
  {
    heading: "vault",
    items: [
      { label: "Borrow", href: "/app/borrow", hint: "open / extend a loan" },
      { label: "Manage", href: "/app/manage", hint: "repay · adjust collat" },
    ],
  },
  {
    heading: "lender",
    items: [{ label: "Lend", href: "/app/lend", hint: "supply usdc · earn" }],
  },
  {
    heading: "explore",
    items: [
      { label: "Learn", href: "/app/learn", hint: "primer · 6 modules" },
      { label: "Mixer", href: "/app/mix", hint: "entry + exit · tdx" },
      { label: "Liquidations", href: "/app/liquidations", hint: "public market · live" },
      { label: "Journal", href: "/app/history", hint: "your actions only" },
    ],
  },
];

const EXTERNAL = [
  { label: "Docs", href: "/about" },
  { label: "GitHub", href: "https://github.com/abaresks24/Discretion" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { address: connected } = useAccount();

  const { data: owner } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "owner",
  });
  const isOwner =
    !!connected && !!owner &&
    (connected as Address).toLowerCase() === (owner as Address).toLowerCase();

  const isActive = (href: string) =>
    href === "/app"
      ? pathname === "/app"
      : pathname === href || pathname?.startsWith(href + "/");

  return (
    <aside className="w-64 shrink-0 border-r border-ink-tertiary bg-bg flex flex-col">
      <div className="h-14 px-4 border-b border-ink-tertiary flex items-center">
        <Link href="/" className="cursor-target flex items-center">
          <Logo size={22} />
        </Link>
      </div>

      <div className="px-4 pt-4 pb-3 font-mono text-[10px] leading-tight text-ink-tertiary border-b border-ink-tertiary">
        <div>
          <span className="text-phos">root</span>@discretion
        </div>
        <div>
          <span className="text-ink-secondary">~</span>/vault
          <span className="animate-blink-hard text-phos">█</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-y-auto scroll-quiet font-mono">
        {SECTIONS.map((section) => (
          <div key={section.heading}>
            <SectionHeading text={section.heading} />
            <ul className="mt-1 flex flex-col">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "cursor-target group flex items-start gap-2 px-2 py-1.5 transition-colors border-l-2",
                        active
                          ? "border-phos text-phos bg-phos/5 phos-glow-soft"
                          : "border-transparent text-ink-secondary hover:text-phos hover:border-phos-dim",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-[3px] text-[10px] leading-none",
                          active ? "text-phos" : "text-ink-tertiary",
                        )}
                      >
                        {active ? "▸" : "·"}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12px] tracking-[0.05em]">
                          <ScrambleText text={item.label} />
                        </span>
                        {item.hint && (
                          <span
                            className={cn(
                              "block text-[10px] leading-tight mt-0.5 transition-colors",
                              active ? "text-phos/60" : "text-ink-tertiary",
                            )}
                          >
                            {item.hint}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {isOwner && (
          <div>
            <SectionHeading text="root / audit" tone="amber" />
            <ul className="mt-1">
              <li>
                <Link
                  href="/app/admin"
                  className={cn(
                    "cursor-target flex items-start gap-2 px-2 py-1.5 transition-colors border-l-2",
                    pathname?.startsWith("/app/admin")
                      ? "border-amber text-amber bg-amber/5 phos-glow-soft"
                      : "border-transparent text-amber-dim hover:text-amber hover:border-amber/60",
                  )}
                >
                  <span className="mt-[3px] text-[10px] leading-none">
                    {pathname?.startsWith("/app/admin") ? "▸" : "·"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12px]">
                      <ScrambleText text="Audit root" />
                    </span>
                    <span className="block text-[10px] leading-tight mt-0.5 text-amber/50">
                      decrypt any position
                    </span>
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      <div className="px-3 pb-4 pt-3 border-t border-ink-tertiary flex flex-col gap-1 font-mono">
        {EXTERNAL.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            target={item.href.startsWith("http") ? "_blank" : undefined}
            rel={item.href.startsWith("http") ? "noreferrer" : undefined}
            className="cursor-target flex items-center gap-2 px-2 py-1 text-[11px] text-ink-tertiary hover:text-phos transition-colors uppercase tracking-[0.18em]"
          >
            <span className="text-ink-tertiary">·</span>
            <span className="flex-1">
              <ScrambleText text={item.label} />
            </span>
            {item.href.startsWith("http") && (
              <span className="text-[10px]">↗</span>
            )}
          </Link>
        ))}
        <div className="pt-2 px-2 text-[9px] text-ink-tertiary leading-snug">
          # chain · arb-sepolia
          <br /># tee · iexec tdx-v2
        </div>
      </div>
    </aside>
  );
}

function SectionHeading({
  text,
  tone = "default",
}: {
  text: string;
  tone?: "default" | "amber";
}) {
  return (
    <div
      className={cn(
        "px-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em]",
        tone === "amber" ? "text-amber/80" : "text-ink-secondary",
      )}
    >
      <span>{text}</span>
      <span
        aria-hidden
        className={cn(
          "flex-1 border-t border-dashed",
          tone === "amber" ? "border-amber/30" : "border-ink-tertiary/60",
        )}
      />
    </div>
  );
}
