"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ViewMode = "private" | "public";

type ViewModeCtx = {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
  toggle: () => void;
};

const Ctx = createContext<ViewModeCtx | null>(null);

export function ViewModeProvider({
  children,
  initialMode = "private",
}: {
  children: ReactNode;
  initialMode?: ViewMode;
}) {
  const [mode, setMode] = useState<ViewMode>(initialMode);
  const value = useMemo<ViewModeCtx>(
    () => ({
      mode,
      setMode,
      toggle: () => setMode((m) => (m === "private" ? "public" : "private")),
    }),
    [mode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewMode(): ViewModeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useViewMode must be used within <ViewModeProvider>");
  return v;
}
