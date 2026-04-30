"use client";

import { useEffect, useRef } from "react";

const HEX = "0123456789abcdef";
const PREFIXES = ["0x", "fn", "00", "ff", "7b", "a3"];

/**
 * Low-cost matrix rain: columns of short hex fragments falling at varied
 * speeds. Within ~150px of the cursor, columns fade out — visually
 * reinforcing the "privacy clears around you" motif.
 */
export function MatrixRain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let cols = 0;
    const fontSize = 14;
    let drops: { y: number; speed: number; frag: string }[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.font = `${fontSize}px ui-monospace, "JetBrains Mono", monospace`;
      cols = Math.floor(w / (fontSize * 0.9));
      drops = Array.from({ length: cols }, () => ({
        y: Math.random() * -h,
        speed: 0.4 + Math.random() * 1.2,
        frag: randomFrag(),
      }));
    };

    const mouse = { x: -999, y: -999 };
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -999;
      mouse.y = -999;
    };

    function randomFrag() {
      const prefix = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
      let tail = "";
      const len = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < len; i++) tail += HEX[Math.floor(Math.random() * 16)];
      return prefix + tail;
    }

    let raf = 0;
    let lastTick = 0;
    const targetFps = 20;
    const frameMs = 1000 / targetFps;

    const draw = (ts: number) => {
      if (document.hidden) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (ts - lastTick < frameMs) {
        raf = requestAnimationFrame(draw);
        return;
      }
      lastTick = ts;

      // Trail: fade out previous frame slightly.
      ctx.fillStyle = "rgba(8, 10, 12, 0.18)";
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < cols; i++) {
        const d = drops[i];
        const x = i * fontSize * 0.9;
        const dx = x - mouse.x;
        const dy = d.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const near = dist < 150 ? 1 - dist / 150 : 0;

        const alpha = 0.35 - 0.32 * near;
        if (alpha > 0.02) {
          ctx.fillStyle = `rgba(0, 255, 159, ${alpha})`;
          ctx.fillText(d.frag, x, d.y);
        }

        d.y += d.speed * 1.6;
        if (d.y > h + 40) {
          d.y = -20 - Math.random() * 200;
          d.speed = 0.4 + Math.random() * 1.2;
          d.frag = randomFrag();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    if (!reduced) raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
