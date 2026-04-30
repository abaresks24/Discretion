"use client";

import { WalletGate } from "@/components/WalletGate";
import { DashboardScreen } from "@/components/app/DashboardScreen";

export default function AppPage() {
  return (
    <WalletGate>
      <DashboardScreen />
    </WalletGate>
  );
}
