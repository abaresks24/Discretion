"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Global custom cursor — a phosphor block that lerps toward the real cursor,
 * morphs into a hollow bracket on interactive hover, and hides on touch.
 * Uses mix-blend-mode: difference so it stays visible on any background.
 */
export function BlockCursor() {
  const ref = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const [interactive, setInteractive] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (isCoarse) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;

    document.documentElement.classList.add("cursor-ready");
    setActive(true);

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
      if (reduced) {
        currentRef.current = { ...targetRef.current };
        apply();
      }
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const hit = el.closest(
        'button, a, [role="button"], input, textarea, select, [data-interactive]',
      );
      setInteractive(!!hit);
    };

    const apply = () => {
      if (!ref.current) return;
      ref.current.style.transform = `translate3d(${currentRef.current.x}px, ${currentRef.current.y}px, 0)`;
    };

    let raf = 0;
    const loop = () => {
      currentRef.current.x +=
        (targetRef.current.x - currentRef.current.x) * 0.28;
      currentRef.current.y +=
        (targetRef.current.y - currentRef.current.y) * 0.28;
      apply();
      raf = requestAnimationFrame(loop);
    };
    if (!reduced) raf = requestAnimationFrame(loop);

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("cursor-ready");
    };
  }, []);

  if (!active) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="fixed top-0 left-0 z-[110] pointer-events-none"
      style={{ mixBlendMode: "difference" }}
    >
      {interactive ? (
        <span
          className="inline-block text-phos font-mono leading-none"
          style={{ transform: "translate(-50%, -50%)", fontSize: 18 }}
        >
          [ ]
        </span>
      ) : (
        <span
          className="block bg-phos animate-blink-hard"
          style={{ width: 10, height: 18, transform: "translate(-50%, -50%)" }}
        />
      )}
    </div>
  );
}
