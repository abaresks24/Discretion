"use client";

import { AsciiCard } from "../primitives/AsciiCard";
import { Divider } from "../primitives/Divider";

const STEPS = [
  {
    id: "01",
    title: "DEPOSIT",
    body:
      "Seal plaintext RLC inside the wrap-queue. Pending entries aggregate per batch.",
  },
  {
    id: "02",
    title: "MIX",
    body:
      "The iExec TDX enclave batches wraps and fan-outs cRLC to destinations, correlations broken.",
  },
  {
    id: "03",
    title: "WITHDRAW",
    body:
      "Repay or withdraw against your confidential position. Addresses can be fresh, unlinked.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 md:px-12 py-24 md:py-32">
      <div className="flex flex-col gap-8 max-w-5xl">
        <header className="space-y-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-phos">
            ▸ how it works
          </div>
          <h2 className="font-mono text-3xl md:text-4xl text-ink-primary">
            Three steps, end-to-end confidential.
          </h2>
          <Divider variant="thin" />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.id} className="relative">
              <AsciiCard
                title={`${s.id} — ${s.title}`}
                interactive
                className="h-full"
                bodyClassName="min-h-[140px] flex flex-col justify-between"
              >
                <p className="text-sm text-ink-secondary leading-relaxed">
                  {s.body}
                </p>
                <div className="pt-4 text-[10px] uppercase tracking-widest text-phos-dim">
                  [{String(i + 1).padStart(2, "0")}/03] ok
                </div>
              </AsciiCard>

              {/* Arrow between steps (hidden on mobile, hidden on last) */}
              {i < STEPS.length - 1 && (
                <div
                  aria-hidden
                  className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 text-phos text-lg"
                >
                  ─▶
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
