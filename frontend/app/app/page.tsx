"use client";

import { WalletGate } from "@/components/WalletGate";
import { Dashboard } from "@/components/Dashboard";

export default function AppPage() {
  return (
    <WalletGate>
      <Dashboard />
    </WalletGate>
  );
}
