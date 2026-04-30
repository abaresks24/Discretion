"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string;
  suffix?: string;
  containerClassName?: string;
};

/**
 * Input with a `>` prompt prefix and an optional trailing unit. The container
 * has a bottom border that phosphor-highlights on focus. No rounded corners.
 */
export const TerminalInput = forwardRef<HTMLInputElement, Props>(
  function TerminalInput(
    { className, prefix = ">", suffix, containerClassName, ...rest },
    ref,
  ) {
    return (
      <div
        className={cn(
          "flex items-baseline gap-2 pb-1 border-b border-ink-tertiary focus-within:border-phos transition-colors cursor-target",
          containerClassName,
        )}
      >
        <span className="text-phos phos-glow-soft">{prefix}</span>
        <input
          ref={ref}
          {...rest}
          style={{ fieldSizing: "content", ...(rest.style ?? {}) } as React.CSSProperties}
          className={cn(
            "bg-transparent outline-none border-0 font-mono tabular-nums text-lg text-ink-primary placeholder:text-ink-tertiary min-w-[4ch]",
            className,
          )}
        />
        {suffix && (
          <span className="text-phos phos-glow-soft text-xs uppercase tracking-widest shrink-0">
            {suffix}
          </span>
        )}
        <span className="flex-1" />
      </div>
    );
  },
);
