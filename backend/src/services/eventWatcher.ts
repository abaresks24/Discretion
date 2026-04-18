import type { FastifyBaseLogger } from "fastify";
import type { Address } from "viem";
import { parseAbiItem } from "viem";
import { publicClient } from "./onchain.js";
import { sessionStore } from "./sessionStore.js";
import { analyzePosition } from "./analyzer.js";
import { config } from "../config.js";

const ZONE_CROSSED = parseAbiItem(
  "event HealthFactorThresholdCrossed(address indexed user, uint8 newZone)",
);

/**
 * Subscribes to zone-crossing events on the vault. For any event where we
 * have an active SSE subscriber for the user, we kick off a ChainGPT
 * analysis and publish the result. Users without subscribers are ignored —
 * we don't want to burn ChainGPT credits on positions nobody is watching.
 */
export function startEventWatcher(logger: FastifyBaseLogger): () => void {
  logger.info({ vault: config.VAULT_ADDRESS }, "Event watcher starting");

  const unwatch = publicClient.watchEvent({
    address: config.VAULT_ADDRESS,
    event: ZONE_CROSSED,
    onLogs: async (logs) => {
      for (const log of logs) {
        const user = log.args.user as Address | undefined;
        const newZone = log.args.newZone;
        if (!user || newZone === undefined) continue;
        if (!sessionStore.hasSubscribers(user)) continue;

        logger.info({ user, newZone }, "Zone crossing — triggering analysis");
        try {
          const viewKey = sessionStore.getViewKey(user);
          const analysis = await analyzePosition(user, viewKey, `alert-${user}-${Date.now()}`);
          sessionStore.publish(user, {
            kind: "alert",
            at: new Date().toISOString(),
            zone: Number(newZone),
            ...analysis,
          });
        } catch (err) {
          logger.error({ err, user }, "Analysis failed for zone crossing");
        }
      }
    },
    onError: (err) => {
      logger.error({ err }, "Event watcher error");
    },
  });

  return () => unwatch();
}
