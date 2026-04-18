"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";
import { ViewModeProvider } from "@/context/ViewModeContext";
import { ViewKeyProvider } from "@/context/ViewKeyContext";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }),
  );
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ViewKeyProvider>
          <ViewModeProvider>{children}</ViewModeProvider>
        </ViewKeyProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
