import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * Discretion card primitive. 8px radius, 1px border, elevated surface, 40px
 * padding. No shadows (brief). Composes with a label header + hairline.
 */
export function Card({
  label,
  trailing,
  children,
  className,
}: {
  label?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "bg-bg-elevated border border-border rounded-lg p-10 flex flex-col",
        className,
      )}
    >
      {label && (
        <header className="flex items-center justify-between pb-6">
          <span className="type-label">{label}</span>
          {trailing}
        </header>
      )}
      {label && <div className="h-px bg-border -mx-10 mb-8" />}
      {children}
    </section>
  );
}
