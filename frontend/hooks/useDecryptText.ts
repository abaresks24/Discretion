"use client";

import { useEffect, useRef, useState } from "react";
import { useViewMode } from "@/context/ViewModeContext";

const SCRAMBLE_CHARS = "█▓▒░0123456789.,\u2009";
const DURATION = 700; // ms, per brief
const TOTAL_FRAMES = 35; // ~50ms per frame
const VEIL = "████████";

/**
 * Scrambles → reveals a target string over 700ms. Reveals left-to-right.
 * When view mode flips to `public`, returns a permanent veil (no animation).
 * When view mode flips back, retriggers the reveal.
 */
export function useDecryptText(target: string, delay = 0): string {
  const { mode } = useViewMode();
  const [display, setDisplay] = useState<string>("");
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

    if (mode === "public") {
      setDisplay(VEIL);
      return;
    }

    let frame = 0;
    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        frame++;
        if (frame >= TOTAL_FRAMES) {
          setDisplay(target);
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          return;
        }
        const progress = frame / TOTAL_FRAMES;
        const revealedCount = Math.floor(progress * target.length);
        const revealed = target.slice(0, revealedCount);
        const scrambled = Array.from({ length: target.length - revealedCount })
          .map(() => SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)])
          .join("");
        setDisplay(revealed + scrambled);
      }, DURATION / TOTAL_FRAMES);
    }, delay);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [target, delay, mode]);

  return display;
}
