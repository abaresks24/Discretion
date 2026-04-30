"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const LINES = [
  { tag: "INIT", tone: "phos", text: "discretion.daemon v0.1.0" },
  { tag: "OK", tone: "phos", text: "iExec TEE runtime detected" },
  { tag: "OK", tone: "phos", text: "entropy pool initialized" },
  { tag: "OK", tone: "phos", text: "mixer circuit online" },
  { tag: "READY", tone: "phos", text: "_" },
];

const LOCAL_KEY = "discretion.bootSeen";

/**
 * Typewrites the boot sequence on first visit, skips on repeat via
 * localStorage flag. Fires `onDone` once the last line finishes.
 */
export function BootIntro({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState<boolean | null>(null);
  const [printed, setPrinted] = useState<string[][]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(LOCAL_KEY) === "1";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduced) {
      setVisible(false);
      onDone();
      return;
    }
    setVisible(true);
  }, [onDone]);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    (async () => {
      for (let i = 0; i < LINES.length; i++) {
        const full = `[${LINES[i].tag}] ${LINES[i].text}`;
        setPrinted((prev) => [...prev, []]);
        for (let k = 1; k <= full.length; k++) {
          await wait(14);
          if (cancelled) return;
          setPrinted((prev) => {
            const copy = [...prev];
            copy[i] = full.slice(0, k).split("");
            return copy;
          });
        }
        await wait(120);
      }
      await wait(350);
      if (!cancelled) {
        window.localStorage.setItem(LOCAL_KEY, "1");
        setVisible(false);
        onDone();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, onDone]);

  const skip = () => {
    window.localStorage.setItem(LOCAL_KEY, "1");
    setVisible(false);
    onDone();
  };

  if (visible !== true) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-bg flex items-center justify-center px-10"
      onClick={skip}
    >
      <div className="max-w-xl w-full font-mono text-sm space-y-1.5">
        {printed.map((chars, i) => {
          const full = `[${LINES[i].tag}] ${LINES[i].text}`;
          const done = chars.length >= full.length;
          const tagEnd = LINES[i].tag.length + 2; // [TAG]
          const str = chars.join("");
          return (
            <div key={i} className="whitespace-pre-wrap">
              <span
                className={cn(
                  "text-phos phos-glow-soft",
                  LINES[i].tag === "INIT" && "text-amber",
                  LINES[i].tag === "READY" && "text-phos phos-glow",
                )}
              >
                {str.slice(0, tagEnd)}
              </span>
              <span className="text-ink-primary">{str.slice(tagEnd)}</span>
              {!done && <span className="animate-blink-hard">█</span>}
            </div>
          );
        })}
        <div className="pt-6 text-[10px] uppercase tracking-widest text-ink-tertiary">
          [click to skip]
        </div>
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
