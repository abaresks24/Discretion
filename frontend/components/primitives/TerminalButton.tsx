"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "warn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  glitch?: boolean;
  children: ReactNode;
};

const BASE =
  "inline-flex items-center justify-center gap-2 px-4 h-10 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors select-none";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-phos text-bg border border-phos hover:bg-phos-dim hover:border-phos-dim phos-glow-soft",
  secondary:
    "bg-transparent text-phos border border-phos hover:bg-phos hover:text-bg",
  ghost:
    "bg-transparent text-ink-secondary border border-transparent hover:text-phos",
  danger:
    "bg-transparent text-crit border border-crit hover:bg-crit hover:text-bg",
  warn:
    "bg-transparent text-amber border border-amber hover:bg-amber hover:text-bg",
};

export const TerminalButton = forwardRef<HTMLButtonElement, Props>(
  function TerminalButton(
    { className, variant = "primary", glitch = false, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        {...rest}
        className={cn(
          BASE,
          VARIANTS[variant],
          glitch && "glitch-hover",
          !rest.disabled && "cursor-target",
          rest.disabled && "opacity-40 cursor-not-allowed",
          className,
        )}
      >
        {children}
      </button>
    );
  },
);
