"use client";

import { WalletGate } from "@/components/WalletGate";
import { AdminPanel } from "@/components/AdminPanel";

export default function AdminPage() {
  return (
    <WalletGate>
      <AdminPanel />
    </WalletGate>
  );
}
