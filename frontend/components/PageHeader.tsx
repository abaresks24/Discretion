"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { useViewMode } from "@/context/ViewModeContext";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

export function PageHeader({ address }: { address?: string }) {
  const { mode } = useViewMode();
  const isPublic = mode === "public";

  return (
    <header className="h-20 flex items-center px-10 border-b border-border">
      <div className="flex items-center gap-6 flex-1">
        <Logo size="sm" />
        <span className="h-4 w-px bg-border" />
        <span className="type-label">Vault №001</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-block rounded-full",
              isPublic ? "bg-zone-danger" : "bg-zone-safe",
            )}
            style={{ width: 6, height: 6 }}
            aria-hidden
          />
          <span className="type-label">
            {isPublic ? "VIEWING AS PUBLIC" : "PRIVACY · ON"}
          </span>
        </div>
        <span className="h-4 w-px bg-border" />
        <span className="font-mono text-[12px] text-ink-secondary">
          {address ? truncateAddress(address) : "—"}
        </span>
        <span className="h-4 w-px bg-border" />
        {isPublic ? (
          <Link href="/app" className="link type-label text-accent-gold">
            ↩ RETURN TO PRIVATE
          </Link>
        ) : (
          <Link href="/app/public-view" className="link type-label text-ink-secondary">
            PUBLIC VIEW
          </Link>
        )}
      </div>
    </header>
  );
}
