"use client";

import { ScrambleText } from "../primitives/ScrambleText";

const STATS = [
  { label: "TEE", value: "TDX-v2" },
  { label: "MIXER", value: "POISSON-Δ" },
  { label: "VAULT", value: "ERC-7984" },
  { label: "RATE", value: "KINKED-80" },
  { label: "AUDITS", value: "01" },
];

export function StatsStrip() {
  return (
    <section className="border-y border-ink-tertiary bg-bg-raised">
      <div className="px-6 md:px-12 py-6 flex flex-wrap gap-x-10 gap-y-3 font-mono text-[11px] uppercase tracking-widest">
        {STATS.map((s) => (
          <div key={s.label} className="flex items-baseline gap-2">
            <span className="text-ink-tertiary">{s.label}</span>
            <span className="text-ink-tertiary">:</span>
            <ScrambleText
              text={s.value}
              onMount
              className="text-phos phos-glow"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
