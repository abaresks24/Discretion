"use client";

import { Sidebar } from "@/components/app/Sidebar";
import { TopBar } from "@/components/app/TopBar";
import { CopilotPanel } from "@/components/app/CopilotPanel";
import TargetCursor from "@/components/primitives/TargetCursor";
import { Scanlines } from "@/components/primitives/Scanlines";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Scanlines soft />
      <TargetCursor />
      <div className="h-screen flex bg-bg text-ink-primary overflow-hidden">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <TopBar />
          <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
        </div>
        <CopilotPanel />
      </div>
    </>
  );
}
