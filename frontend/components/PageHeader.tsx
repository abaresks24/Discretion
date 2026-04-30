"use client";

import Link from "next/link";
import { useAccount, useReadContract } from "wagmi";
import type { Address } from "viem";
import { useViewMode } from "@/context/ViewModeContext";
import { truncateAddress } from "@/lib/format";
import { vaultAbi } from "@/lib/abi/vault";
import { env } from "@/lib/env";
import { cn } from "@/lib/cn";

/**
 * Bash-prompt style header. Exposes the public_view link for everyone and a
 * privileged `audit://` link when the connected wallet is the vault owner.
 */
export function PageHeader({ address }: { address?: string }) {
  const { mode } = useViewMode();
  const { address: connected } = useAccount();
  const { data: owner } = useReadContract({
    address: env.VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "owner",
  });
  const isPublic = mode === "public";
  const isOwner =
    !!connected && !!owner &&
    (connected as Address).toLowerCase() === (owner as Address).toLowerCase();

  return (
    <header className="px-6 py-3 border-b border-terminal-border flex items-center gap-3 text-sm font-mono">
      <span className="text-terminal-dim">user@discretion</span>
      <span className="text-terminal-fade">:</span>
      <span className="text-terminal-text terminal-glow">~</span>
      <span className="text-terminal-dim">$</span>
      <span className="text-terminal-text terminal-glow">vault://001</span>

      <span className="flex-1" />

      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "inline-block h-2 w-2",
            isPublic ? "bg-terminal-danger" : "bg-terminal-text",
          )}
        />
        <span
          className={cn(
            "uppercase text-xs tracking-widest",
            isPublic ? "text-terminal-danger" : "text-terminal-dim",
          )}
        >
          {isPublic ? "public_mode" : "private_mode"}
        </span>
      </span>

      <span className="text-terminal-fade">|</span>
      <span className="text-terminal-dim">
        {address ? truncateAddress(address) : "--"}
      </span>
      <span className="text-terminal-fade">|</span>

      {isOwner && (
        <>
          <Link
            href="/app/admin"
            className="text-terminal-amber hover:text-terminal-text underline underline-offset-4 uppercase text-xs tracking-widest"
          >
            ./audit
          </Link>
          <span className="text-terminal-fade">|</span>
        </>
      )}

      {isPublic ? (
        <Link
          href="/app"
          className="text-terminal-text hover:text-terminal-amber underline underline-offset-4 uppercase text-xs tracking-widest"
        >
          ./return_private
        </Link>
      ) : (
        <Link
          href="/app/public-view"
          className="text-terminal-dim hover:text-terminal-text underline underline-offset-4 uppercase text-xs tracking-widest"
        >
          ./public_view
        </Link>
      )}
    </header>
  );
}
