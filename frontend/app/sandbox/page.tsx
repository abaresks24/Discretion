"use client";

import { useState } from "react";
import { Logo, DiscretionMark } from "@/components/Logo";
import { GoldHairline } from "@/components/GoldHairline";
import { DecryptedNumber } from "@/components/DecryptedNumber";
import { LtvGauge } from "@/components/LtvGauge";
import { StatusPill } from "@/components/StatusPill";
import { PositionCard } from "@/components/PositionCard";
import { AllocatePanel } from "@/components/AllocatePanel";
import { CounselMessage, UserMessage } from "@/components/CounselMessage";
import { SuggestionCard } from "@/components/SuggestionCard";

/**
 * Isolated component preview for Arthur's visual review. Not linked from the
 * app. Delete before production ship.
 */
export default function Sandbox() {
  const [ltv, setLtv] = useState(66);
  const zone = ltv < 60 ? 0 : ltv < 75 ? 1 : ltv < 85 ? 2 : 3;

  return (
    <main className="max-w-[1280px] mx-auto px-10 py-16 flex flex-col gap-20">
      <h1 className="type-display-lg">
        Sandbox <em className="text-ink-tertiary">(preview only)</em>
      </h1>

      <Section title="Logo">
        <div className="flex flex-col gap-6">
          <Logo size="sm" />
          <Logo size="md" />
          <Logo size="lg" />
          <DiscretionMark size={64} />
        </div>
      </Section>

      <Section title="Gold hairlines">
        <div className="flex items-center gap-12">
          <GoldHairline width={60} />
          <GoldHairline width={120} />
          <GoldHairline vertical width={80} />
          <GoldHairline vertical width={120} animate />
        </div>
      </Section>

      <Section title="DecryptedNumber">
        <div className="flex flex-col gap-6">
          <DecryptedNumber value={2015.4} unit="USDC" size="xl" />
          <DecryptedNumber value={1.2345} unit="WETH" size="lg" decimals={4} />
          <DecryptedNumber value={68.44} unit="%" size="md" />
          <DecryptedNumber value={12} size="sm" />
        </div>
      </Section>

      <Section title="Status pills">
        <div className="flex gap-4">
          {[0, 1, 2, 3].map((z) => (
            <StatusPill key={z} zone={z} />
          ))}
        </div>
      </Section>

      <Section title="LtvGauge">
        <div className="flex items-center gap-10">
          <LtvGauge ltvPercent={ltv} zone={zone} />
          <div className="flex flex-col gap-4">
            <span className="type-label">Drag to test transitions</span>
            <input
              type="range"
              min={0}
              max={110}
              value={ltv}
              onChange={(e) => setLtv(Number(e.target.value))}
              className="w-64 accent-accent-gold"
            />
          </div>
        </div>
      </Section>

      <Section title="PositionCard">
        <div className="w-[416px]">
          <PositionCard
            ltvPercent={ltv}
            zone={zone}
            collateralAmount={1.0}
            collateralUsd={3000}
            debtAmount={2000}
            debtUsd={2000}
            liquidationThresholdPct={85}
          />
        </div>
      </Section>

      <Section title="AllocatePanel">
        <div className="w-[416px]">
          <AllocatePanel
            currentLtvPct={ltv}
            onSubmit={(v, a) => alert(`${v} ${a}`)}
          />
        </div>
      </Section>

      <Section title="Counsel messages + suggestions">
        <div className="w-[464px] flex flex-col gap-7">
          <CounselMessage at="09:42">
            Your position has entered the warning band. ETH has slipped to
            $2 500 and LTV stands at 80.0%. Consider settling 500 USDC or
            reinforcing with 0.2 WETH to return to the safe band.
          </CounselMessage>
          <SuggestionCard
            action={{
              type: "repay",
              amount_debt: "500",
              expected_new_ltv_bps: 6200,
            }}
            onApply={() => {}}
          />
          <SuggestionCard
            action={{
              type: "add_collateral",
              amount_collateral: "0.2",
              expected_new_ltv_bps: 6400,
            }}
            onApply={() => {}}
          />
          <UserMessage at="09:43" text="What happens if ETH drops to 2 000?" />
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="type-label">{title}</span>
        <GoldHairline width={60} />
      </div>
      <div className="bg-bg-elevated border border-border rounded-lg p-10">
        {children}
      </div>
    </section>
  );
}
