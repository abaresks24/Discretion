"use client";

import { useEffect } from "react";

/**
 * Tracks cursor and writes --mouse-x / --mouse-y CSS variables on <html>.
 * The `.spotlight` selector in globals.css renders the radial gradient.
 */
export function Spotlight() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduced) return;

    const root = document.documentElement;
    let raf = 0;
    let pending: { x: number; y: number } | null = null;

    const onMove = (e: MouseEvent) => {
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!pending) return;
          root.style.setProperty("--mouse-x", `${pending.x}px`);
          root.style.setProperty("--mouse-y", `${pending.y}px`);
        });
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div aria-hidden className="spotlight" />;
}
