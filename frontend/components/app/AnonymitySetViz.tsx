"use client";

import { useEffect, useRef } from "react";

/**
 * Canvas cluster of drifting hash fragments representing the current
 * anonymity set. Purely aesthetic — size of the cluster is fed by `count`.
 */
export function AnonymitySetViz({
  count,
  highlightIndex,
}: {
  count: number;
  highlightIndex?: number | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.font = '12px "JetBrains Mono", ui-monospace, monospace';
    };

    type Dot = { x: number; y: number; vx: number; vy: number; hash: string; seed: number };
    const n = Math.max(8, Math.min(120, count));

    const dots: Dot[] = Array.from({ length: n }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006,
      vy: (Math.random() - 0.5) * 0.0006,
      hash:
        "0x" +
        Array.from({ length: 4 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join(""),
      seed: i,
    }));

    let raf = 0;
    let last = 0;
    const frame = 1000 / 20;
    const draw = (ts: number) => {
      if (ts - last < frame) {
        raf = requestAnimationFrame(draw);
        return;
      }
      last = ts;
      resize();
      ctx.clearRect(0, 0, w, h);

      for (const [i, d] of dots.entries()) {
        if (!reduced) {
          d.x = (d.x + d.vx + 1) % 1;
          d.y = (d.y + d.vy + 1) % 1;
        }
        const x = d.x * w;
        const y = d.y * h;
        const highlighted = highlightIndex === i;
        ctx.fillStyle = highlighted
          ? "rgba(255, 176, 0, 0.95)"
          : `rgba(0, 255, 159, ${0.35 + 0.4 * Math.abs(Math.sin(ts / 800 + i))})`;
        ctx.fillText(d.hash, x, y);
      }
      raf = requestAnimationFrame(draw);
    };
    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [count, highlightIndex]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
