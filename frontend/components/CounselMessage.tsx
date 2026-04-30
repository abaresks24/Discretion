"use client";

import type { ReactNode } from "react";

/**
 * Log-line style messages. Each line carries a timestamp tag, a role
 * prompt (`counsel>` or `you>`), and the body. No background fills —
 * the whole Counsel column reads as scroll-back.
 */
export function CounselMessage({
  at,
  children,
}: {
  at: string;
  children: ReactNode;
}) {
  return (
    <div className="font-mono text-sm leading-relaxed">
      <span className="text-terminal-fade">[{at}]</span>{" "}
      <span className="text-terminal-dim">counsel&gt;</span>{" "}
      <span className="text-terminal-text">{children}</span>
    </div>
  );
}

export function UserMessage({ at, text }: { at: string; text: string }) {
  return (
    <div className="font-mono text-sm leading-relaxed">
      <span className="text-terminal-fade">[{at}]</span>{" "}
      <span className="text-terminal-dim">you&gt;</span>{" "}
      <span className="text-terminal-dim">{text}</span>
    </div>
  );
}
