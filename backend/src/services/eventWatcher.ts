import type { FastifyBaseLogger } from "fastify";
import type { Address } from "viem";
import { parseAbiItem } from "viem";
import { publicClient } from "./onchain.js";
import { sessionStore } from "./sessionStore.js";
import { config } from "../config.js";

/**
 * The vault no longer emits an encrypted-aware HealthFactorThresholdCrossed event
 * (moved off-chain — see ConfidentialLendingVault.sol header). The relayer instead
 * subscribes to the four balance-changing events and asks the frontend to refresh
 * its decrypted view on each one. Zone + LTV are computed in the frontend and
 * posted back through /analyze.
 */

const BALANCE_EVENTS = [
  parseAbiItem("event CollateralDeposited(address indexed user)"),
  parseAbiItem("event CollateralWithdrawn(address indexed user)"),
  parseAbiItem("event Borrowed(address indexed user)"),
  parseAbiItem("event Repaid(address indexed user)"),
];

export function startEventWatcher(logger: FastifyBaseLogger): () => void {
  logger.info({ vault: config.VAULT_ADDRESS }, "Event watcher starting");

  const unsubscribers = BALANCE_EVENTS.map((event) =>
    publicClient.watchEvent({
      address: config.VAULT_ADDRESS,
      event,
      onLogs: (logs) => {
        for (const log of logs) {
          const user = (log as unknown as { args?: { user?: Address } }).args?.user;
          if (!user) continue;
          if (!sessionStore.hasSubscribers(user)) continue;

          logger.info(
            { user, eventName: event.name },
            "Balance event — asking frontend to refresh",
          );
          sessionStore.publish(user, {
            kind: "refresh",
            at: new Date().toISOString(),
            reason: event.name,
          });
        }
      },
      onError: (err) => logger.error({ err }, `Event watcher error (${event.name})`),
    }),
  );

  return () => unsubscribers.forEach((u) => u());
}
