import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Terminal-style card: black body, green 1px border, `[ LABEL ]` header.
 * Designed to stretch to its grid cell so we can use it in a
 * single-viewport layout (`h-full flex flex-col`, children decide what
 * scrolls internally with `min-h-0 overflow-*`).
 */
export function Card({
  label,
  trailing,
  children,
  className,
  bodyClassName,
}: {
  label?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "bg-black border border-terminal-border font-mono flex flex-col min-h-0",
        className,
      )}
    >
      {label && (
        <header className="flex items-center justify-between border-b border-terminal-border px-4 py-2">
          <span className="flex items-center gap-2">
            <span className="text-terminal-fade">[</span>
            <span className="text-terminal-text terminal-glow uppercase tracking-[0.2em] text-[11px]">
              {label}
            </span>
            <span className="text-terminal-fade">]</span>
          </span>
          {trailing}
        </header>
      )}
      <div
        className={cn(
          "flex-1 min-h-0 flex flex-col gap-4 p-4 overflow-y-auto scroll-quiet",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
