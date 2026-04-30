"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const CHARS = "!<>-_\\/[]{}—=+*^?#";

/**
 * Reveals `text` by scrambling characters from left to right over ~300ms.
 * Triggers on mount (optional) and on hover. Drops to plain text under
 * `prefers-reduced-motion`.
 */
export function ScrambleText({
  text,
  className,
  onMount = false,
  duration = 300,
  trigger = "hover",
}: {
  text: string;
  className?: string;
  onMount?: boolean;
  duration?: number;
  trigger?: "hover" | "none";
}) {
  const [display, setDisplay] = useState(onMount ? "" : text);
  const ref = useRef<number | null>(null);

  const run = (target: string) => {
    if (typeof window === "undefined") return;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(target);
      return;
    }
    if (ref.current) cancelAnimationFrame(ref.current);
    const start = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / duration);
      const revealed = Math.floor(p * target.length);
      let out = target.slice(0, revealed);
      for (let i = revealed; i < target.length; i++) {
        out += CHARS[Math.floor(Math.random() * CHARS.length)];
      }
      setDisplay(out);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (onMount) run(text);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, onMount]);

  return (
    <span
      className={cn(className)}
      onMouseEnter={trigger === "hover" ? () => run(text) : undefined}
    >
      {display || text}
    </span>
  );
}
