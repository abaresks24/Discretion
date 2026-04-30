"use client";

import { useState } from "react";
import { BootIntro } from "@/components/landing/BootIntro";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { WhyIexec } from "@/components/landing/WhyIexec";
import { StatsStrip } from "@/components/landing/StatsStrip";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import TargetCursor from "@/components/primitives/TargetCursor";
import { Spotlight } from "@/components/primitives/Spotlight";
import { Scanlines } from "@/components/primitives/Scanlines";

export default function LandingPage() {
  const [bootDone, setBootDone] = useState(false);

  return (
    <>
      <BootIntro onDone={() => setBootDone(true)} />
      <Scanlines />
      <Spotlight />
      <TargetCursor />

      <main
        className="relative min-h-screen bg-bg transition-opacity duration-300"
        style={{ opacity: bootDone ? 1 : 0 }}
      >
        <LandingNav />
        <Hero />
        <StatsStrip />
        <HowItWorks />
        <WhyIexec />
        <Faq />
        <Footer />
      </main>
    </>
  );
}
