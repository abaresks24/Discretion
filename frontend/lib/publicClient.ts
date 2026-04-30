import { createPublicClient, http, type PublicClient } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { env } from "./env";

/**
 * Shared viem public client for imperative reads from components (wagmi's
 * `useReadContract` hook can't run inside event handlers — this fills the gap).
 */
export const publicClient: PublicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(env.RPC_URL, {
    timeout: 30_000,
    retryCount: 2,
    retryDelay: 500,
  }),
});
