"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * ASCII-bordered container. The title sits inside the top border
 * (`┌─ TITLE ──┐` vibe) rendered via CSS because real box-drawing chars at
 * scale is fragile across fonts. Inner tilt + glow driven by mouse pos.
 */
export function AsciiCard({
  title,
  trailing,
  children,
  className,
  bodyClassName,
  interactive = false,
}: {
  title?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    if (!interactive || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--rel-x", `${(e.clientX - r.left) / r.width}`);
    ref.current.style.setProperty("--rel-y", `${(e.clientY - r.top) / r.height}`);
  };

  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty("--rel-x", "0.5");
    ref.current.style.setProperty("--rel-y", "0.5");
  };

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "relative bg-bg-raised border border-ink-tertiary",
        interactive && "tilt-card",
        className,
      )}
    >
      {title && (
        <header className="flex items-center gap-3 px-3 py-2 border-b border-ink-tertiary overflow-hidden">
          <span className="flex items-baseline gap-2 shrink-0 text-[11px] uppercase tracking-[0.2em]">
            <span className="text-ink-tertiary">┌─[</span>
            <span className="text-phos phos-glow">{title}</span>
            <span className="text-ink-tertiary">]</span>
          </span>
          <span
            aria-hidden
            className="flex-1 h-px border-t border-dashed border-ink-tertiary/70 -translate-y-[4px]"
          />
          {trailing}
          <span aria-hidden className="text-ink-tertiary text-[11px] shrink-0">
            ─┐
          </span>
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
