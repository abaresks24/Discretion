"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * View key is the per-user secret needed to decrypt confidential balances.
 * The frontend derives it by asking the wallet to sign a fixed message once
 * per session and caches the result IN MEMORY ONLY — never localStorage.
 * See CLAUDE.md §9.3 and the brief's "Wallet connection flow".
 */

type Ctx = {
  viewKey: string | null;
  setViewKey: (k: string | null) => void;
};

const ViewKeyCtx = createContext<Ctx | null>(null);

export function ViewKeyProvider({ children }: { children: ReactNode }) {
  const [viewKey, setViewKey] = useState<string | null>(null);
  const value = useMemo(() => ({ viewKey, setViewKey }), [viewKey]);
  return <ViewKeyCtx.Provider value={value}>{children}</ViewKeyCtx.Provider>;
}

export function useViewKey(): Ctx {
  const v = useContext(ViewKeyCtx);
  if (!v) throw new Error("useViewKey must be used within <ViewKeyProvider>");
  return v;
}

export const VIEW_KEY_MESSAGE =
  "Discretion · authorize this device to decrypt your vault view for this session.";
