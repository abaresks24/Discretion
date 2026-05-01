import type { FastifyBaseLogger } from "fastify";
import {
  createWalletClient,
  http,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia } from "viem/chains";
import { config } from "../config.js";
import { publicClient } from "./onchain.js";
import { wrapQueueAbi } from "../abi/wrapQueue.js";

/**
 * Polls the WrapQueue (and UnwrapQueue if configured) for pending entries
 * and submits processBatch() as the on-chain operator. Stand-in for the TEE
 * iApp keeper while the iApp deployment is pending.
 *
 * Disabled (no-op) unless MIXER_OPERATOR_PRIVATE_KEY + WRAP_QUEUE_ADDRESS are
 * both configured.
 */
export function startMixerKeeper(logger: FastifyBaseLogger): () => void {
  if (!config.MIXER_OPERATOR_PRIVATE_KEY || !config.WRAP_QUEUE_ADDRESS) {
    logger.info(
      {
        hasKey: !!config.MIXER_OPERATOR_PRIVATE_KEY,
        hasQueue: !!config.WRAP_QUEUE_ADDRESS,
      },
      "Mixer keeper disabled (missing config)",
    );
    return () => {};
  }

  const account = privateKeyToAccount(config.MIXER_OPERATOR_PRIVATE_KEY as Hex);
  const wallet = createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(config.ARBITRUM_SEPOLIA_RPC),
  });

  const queues: { name: string; address: Address }[] = [
    { name: "WrapQueue.RLC", address: config.WRAP_QUEUE_ADDRESS },
  ];
  if (config.WRAP_QUEUE_WETH_ADDRESS) {
    queues.push({ name: "WrapQueue.WETH", address: config.WRAP_QUEUE_WETH_ADDRESS });
  }
  if (config.WRAP_QUEUE_USDC_ADDRESS) {
    queues.push({ name: "WrapQueue.USDC", address: config.WRAP_QUEUE_USDC_ADDRESS });
  }
  if (config.UNWRAP_QUEUE_ADDRESS) {
    queues.push({ name: "UnwrapQueue.USDC", address: config.UNWRAP_QUEUE_ADDRESS });
  }

  logger.info(
    {
      operator: account.address,
      queues: queues.map((q) => `${q.name}@${q.address}`),
      intervalMs: config.MIXER_POLL_INTERVAL_MS,
      minBatch: config.MIXER_MIN_BATCH,
      batchLimit: config.MIXER_BATCH_LIMIT,
    },
    "Mixer keeper starting",
  );

  let inFlight = false;
  let stopped = false;

  const tick = async () => {
    if (inFlight || stopped) return;
    inFlight = true;
    try {
      for (const q of queues) {
        if (stopped) break;
        await processQueue(q.address, q.name, wallet, logger);
      }
    } catch (err) {
      logger.error({ err }, "Mixer keeper tick error");
    } finally {
      inFlight = false;
    }
  };

  // Fire once immediately so deploy doesn't wait the full interval.
  void tick();
  const handle = setInterval(tick, config.MIXER_POLL_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(handle);
  };
}

async function processQueue(
  queueAddress: Address,
  name: string,
  wallet: WalletClient,
  logger: FastifyBaseLogger,
) {
  const ids = (await publicClient.readContract({
    address: queueAddress,
    abi: wrapQueueAbi,
    functionName: "pendingIds",
    args: [0n, BigInt(config.MIXER_BATCH_LIMIT)],
  })) as bigint[];

  if (ids.length < config.MIXER_MIN_BATCH) {
    logger.debug({ name, pending: ids.length }, "Mixer: nothing to process");
    return;
  }

  logger.info({ name, ids: ids.map((i) => i.toString()) }, "Mixer: submitting batch");

  // Simulate first so we get a sharp revert reason instead of a silent fail.
  const { request } = await publicClient.simulateContract({
    account: wallet.account!,
    address: queueAddress,
    abi: wrapQueueAbi,
    functionName: "processBatch",
    args: [ids],
  });

  const hash = await wallet.writeContract(request);
  logger.info({ name, hash }, "Mixer: tx submitted");
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  logger.info(
    { name, hash, status: receipt.status, blockNumber: receipt.blockNumber.toString() },
    "Mixer: tx mined",
  );
}
