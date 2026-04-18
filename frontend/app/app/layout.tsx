"use client";

import { useAccount } from "wagmi";
import { PageHeader } from "@/components/PageHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  return (
    <div className="min-h-screen flex flex-col">
      <PageHeader address={address} />
      {children}
    </div>
  );
}
