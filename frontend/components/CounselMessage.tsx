"use client";

import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/**
 * A Counsel message. Letterhead treatment: `bg-high` background, 1px gold
 * left border, 24px padding, serif italic 16px, line-height 1.7 (brief).
 */
export function CounselMessage({
  at,
  children,
}: {
  at: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="type-caption tracking-[0.18em] uppercase text-ink-tertiary">
        Counsel · {at}
      </span>
      <div className={cn("counsel-letter type-body-serif text-ink-primary")}>
        {children}
      </div>
    </div>
  );
}

export function UserMessage({ at, text }: { at: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 pl-10">
      <span className="type-caption tracking-[0.18em] uppercase text-ink-tertiary">
        You · {at}
      </span>
      <p className="type-body text-ink-secondary">{text}</p>
    </div>
  );
}
