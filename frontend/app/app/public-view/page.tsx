"use client";

import { useEffect } from "react";
import { useViewMode } from "@/context/ViewModeContext";
import { PublicView } from "@/components/PublicView";

export default function PublicViewPage() {
  const { setMode } = useViewMode();
  useEffect(() => {
    setMode("public");
    return () => setMode("private");
  }, [setMode]);
  return <PublicView />;
}
