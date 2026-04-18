import { http, createConfig } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";
import { env } from "./env";

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected({ shimDisconnect: true }), metaMask()],
  transports: {
    [arbitrumSepolia.id]: http(env.RPC_URL),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
