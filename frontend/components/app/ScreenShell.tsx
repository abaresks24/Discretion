"use client";

import { usePathname } from "next/navigation";
import { type ReactNode } from "react";
import { Divider } from "../primitives/Divider";

/**
 * Standard screen container: a bash prompt line, a title, a divider, then
 * children. Keeps every /app route visually aligned + terminal-authentic.
 */
export function ScreenShell({
  tag,
  title,
  subtitle,
  trailing,
  children,
}: {
  tag: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const cmd = pathname.replace(/^\/app/, "~/vault") || "~/vault";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="px-6 md:px-10 pt-5 pb-2 flex items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="font-mono text-[11px] text-ink-tertiary truncate">
            <span className="text-phos">root@discretion</span>
            <span>:</span>
            <span className="text-ink-secondary">{cmd}</span>
            <span className="text-phos">$</span>{" "}
            <span className="text-ink-secondary">./{tag.replace(/\W+/g, "")}</span>{" "}
            <span className="text-ink-tertiary">--interactive</span>
          </div>
          <h1 className="font-mono text-2xl md:text-3xl text-ink-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-ink-tertiary font-mono uppercase tracking-widest">
              # {subtitle}
            </p>
          )}
        </div>
        {trailing}
      </header>
      <Divider className="px-6 md:px-10" />
      <div className="flex-1 min-h-0 overflow-y-auto scroll-quiet px-6 md:px-10 py-6">
        {children}
      </div>
    </div>
  );
}
