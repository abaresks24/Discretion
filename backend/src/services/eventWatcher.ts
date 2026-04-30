import type { FastifyBaseLogger } from "fastify";
import type { Address } from "viem";
import { parseAbiItem } from "viem";
import { publicClient } from "./onchain.js";
import { sessionStore } from "./sessionStore.js";
import { config } from "../config.js";

/**
 * Watches every event that should trigger a frontend refresh:
 *   - balance-changing events (per-user)
 *   - liquidation reveals + executions (per-user, also broadcast to all
 *     viewers of the public liquidation page)
 *
 * On each match, asks the frontend (via the SSE /alerts stream) to
 * re-decrypt handles and re-run /analyze so ChainGPT can comment.
 */

const BALANCE_EVENTS = [
  parseAbiItem("event CollateralDeposited(address indexed user, address indexed asset)"),
  parseAbiItem("event CollateralWithdrawn(address indexed user, address indexed asset)"),
  parseAbiItem("event Borrowed(address indexed user)"),
  parseAbiItem("event Repaid(address indexed user)"),
  parseAbiItem("event LiquiditySupplied(address indexed lender)"),
  parseAbiItem("event LiquidityWithdrawn(address indexed lender)"),
];

const LIQUIDATION_REVEAL = parseAbiItem(
  "event PositionLiquidatable(address indexed user, uint256 ltvBps, uint256 debtAmount, uint40 deadline)",
);
const LIQUIDATION_EXECUTED = parseAbiItem(
  "event Liquidated(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 bonusBps)",
);

export function startEventWatcher(logger: FastifyBaseLogger): () => void {
  logger.info({ vault: config.VAULT_ADDRESS }, "Event watcher starting");

  const unsubscribers: (() => void)[] = [];

  for (const event of BALANCE_EVENTS) {
    unsubscribers.push(
      publicClient.watchEvent({
        address: config.VAULT_ADDRESS,
        event,
        onLogs: (logs) => {
          for (const log of logs) {
            const args = (log as unknown as {
              args?: { user?: Address; lender?: Address };
            }).args;
            const user = args?.user ?? args?.lender;
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
        onError: (err) =>
          logger.error({ err }, `Event watcher error (${event.name})`),
      }),
    );
  }

  // Liquidation reveal — push a critical alert to the user being liquidated,
  // so the copilot can produce a "your position has just been revealed for
  // public liquidation" notice in real time.
  unsubscribers.push(
    publicClient.watchEvent({
      address: config.VAULT_ADDRESS,
      event: LIQUIDATION_REVEAL,
      onLogs: (logs) => {
        for (const log of logs) {
          const args = (log as unknown as {
            args?: { user?: Address; ltvBps?: bigint; debtAmount?: bigint };
          }).args;
          const user = args?.user;
          if (!user) continue;
          logger.warn(
            { user, ltvBps: args?.ltvBps?.toString() },
            "Liquidation revealed — pushing critical alert",
          );
          if (sessionStore.hasSubscribers(user)) {
            sessionStore.publish(user, {
              kind: "refresh",
              at: new Date().toISOString(),
              reason: "PositionLiquidatable",
            });
          }
        }
      },
      onError: (err) =>
        logger.error({ err }, "Event watcher error (PositionLiquidatable)"),
    }),
  );

  unsubscribers.push(
    publicClient.watchEvent({
      address: config.VAULT_ADDRESS,
      event: LIQUIDATION_EXECUTED,
      onLogs: (logs) => {
        for (const log of logs) {
          const args = (log as unknown as { args?: { user?: Address } }).args;
          const user = args?.user;
          if (!user) continue;
          logger.info({ user }, "Liquidated — refreshing the liquidated user");
          if (sessionStore.hasSubscribers(user)) {
            sessionStore.publish(user, {
              kind: "refresh",
              at: new Date().toISOString(),
              reason: "Liquidated",
            });
          }
        }
      },
      onError: (err) =>
        logger.error({ err }, "Event watcher error (Liquidated)"),
    }),
  );

  return () => unsubscribers.forEach((u) => u());
}
