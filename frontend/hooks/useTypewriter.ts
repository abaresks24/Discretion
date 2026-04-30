"use client";

import { useEffect, useState } from "react";

/**
 * Reveals `text` one character at a time. Classic terminal typewriter.
 * Distinct from `useDecryptText` (scramble reveal) — this one is for prose
 * that should feel typed out by a live operator.
 */
export function useTypewriter(
  text: string,
  opts: { msPerChar?: number; delay?: number; enabled?: boolean } = {},
): { display: string; done: boolean } {
  const { msPerChar = 18, delay = 0, enabled = true } = opts;
  const [display, setDisplay] = useState<string>(enabled ? "" : text);

  useEffect(() => {
    if (!enabled) {
      setDisplay(text);
      return;
    }
    setDisplay("");
    let i = 0;
    let interval: number | undefined;
    const kickoff = window.setTimeout(() => {
      interval = window.setInterval(() => {
        i++;
        setDisplay(text.slice(0, i));
        if (i >= text.length && interval !== undefined) {
          window.clearInterval(interval);
        }
      }, msPerChar);
    }, delay);
    return () => {
      window.clearTimeout(kickoff);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [text, msPerChar, delay, enabled]);

  return { display, done: display.length >= text.length };
}
