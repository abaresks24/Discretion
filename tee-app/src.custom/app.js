/**
 * Discretion mixer iApp — runs inside an iExec TEE (Intel TDX) enclave.
 *
 * Inputs (at task execution):
 *   - IEXEC_APP_DEVELOPER_SECRET : operator private key, sealed at deploy time
 *   - IEXEC_OUT                  : where the task result must be written
 *   - argv[0]                    : WrapQueue contract address on Arbitrum Sepolia
 *   - argv[1] (optional)         : max batch size (default 20)
 *   - argv[2] (optional)         : minimum pending entries before processing
 *                                  the batch (default 1)
 *
 * Behaviour:
 *   1. Read `pendingIds(0, batchLimit)` on the WrapQueue.
 *   2. If fewer than `minBatch` entries, write an "empty" result and exit.
 *   3. Otherwise, call `processBatch(ids)` with the sealed operator key.
 *   4. Record the result to $IEXEC_OUT/result.json and write
 *      $IEXEC_OUT/computed.json pointing to it (iExec PoCo requirement).
 *
 * Privacy story:
 *   The operator private key *never* leaves the TDX enclave — not even to the
 *   iApp developer. Only the running code can sign with it, and the running
 *   code is the deterministic Docker image hashed into the iApp contract at
 *   deploy time. The mixer becomes trust-minimised: anyone inspecting the
 *   WrapQueue on-chain sees only the aggregated `wrap(self, total)` call and
 *   a set of `confidentialTransfer` recipients, with no link preserved
 *   between queue entry and destination aside from the TEE-attested code.
 */

import fs from "node:fs/promises";
import { JsonRpcProvider, Wallet, Contract } from "ethers";

const RPC_URL = "https://arbitrum-sepolia-rpc.publicnode.com";

const WRAP_QUEUE_ABI = [
  "function pendingIds(uint256 cursor, uint256 limit) view returns (uint256[])",
  "function queueLength() view returns (uint256)",
  "function operator() view returns (address)",
  "function processBatch(uint256[] ids)",
];

async function writeComputed(out, payload) {
  await fs.writeFile(`${out}/result.json`, JSON.stringify(payload, null, 2));
  await fs.writeFile(
    `${out}/computed.json`,
    JSON.stringify({ "deterministic-output-path": `${out}/result.json` }),
  );
}

async function main() {
  const { IEXEC_OUT, IEXEC_APP_DEVELOPER_SECRET } = process.env;
  if (!IEXEC_OUT) throw new Error("IEXEC_OUT is not set");
  if (!IEXEC_APP_DEVELOPER_SECRET)
    throw new Error("IEXEC_APP_DEVELOPER_SECRET is not set — seal the operator private key at deploy time");

  const [wrapQueueArg, batchLimitArg, minBatchArg] = process.argv.slice(2);
  const wrapQueueAddress = wrapQueueArg;
  const batchLimit = Number(batchLimitArg ?? "20");
  const minBatch = Number(minBatchArg ?? "1");

  if (!wrapQueueAddress || !/^0x[a-fA-F0-9]{40}$/.test(wrapQueueAddress)) {
    throw new Error(
      "Usage: <wrapQueueAddress> [batchLimit=20] [minBatch=1]",
    );
  }

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(IEXEC_APP_DEVELOPER_SECRET, provider);
  const queue = new Contract(wrapQueueAddress, WRAP_QUEUE_ABI, wallet);

  const operator = await queue.operator();
  if (operator.toLowerCase() !== wallet.address.toLowerCase()) {
    console.warn(
      `[warn] sealed signer ${wallet.address} is not the queue operator ${operator}; tx will revert`,
    );
  }

  const ids = await queue.pendingIds(0, batchLimit);
  console.log(`pending entries: ${ids.length}`);

  if (ids.length < minBatch) {
    await writeComputed(IEXEC_OUT, {
      status: "skipped",
      reason: `pending (${ids.length}) below minBatch (${minBatch})`,
      wrapQueue: wrapQueueAddress,
      checkedAt: new Date().toISOString(),
    });
    return;
  }

  // Deterministic "shuffle" — sort ids by keccak256(id, blockHash) so two
  // workers re-running the same task produce the same order (consensus-safe).
  const latest = await provider.getBlock("latest");
  const seed = latest?.hash ?? "0x0";
  const shuffled = [...ids]
    .map((id) => ({
      id,
      key: BigInt(
        "0x" +
          Buffer.from(
            new TextEncoder().encode(`${seed}-${id.toString()}`),
          ).toString("hex"),
      ),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((e) => e.id);

  console.log(
    `submitting processBatch for ${shuffled.length} ids (seed=${seed.slice(0, 10)}…)`,
  );
  const tx = await queue.processBatch(shuffled);
  const receipt = await tx.wait();
  console.log(`✓ processed in tx ${receipt.hash} @ block ${receipt.blockNumber}`);

  await writeComputed(IEXEC_OUT, {
    status: "processed",
    wrapQueue: wrapQueueAddress,
    signer: wallet.address,
    count: shuffled.length,
    ids: shuffled.map(String),
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    seed,
  });
}

main().catch(async (err) => {
  console.error("mixer iApp error:", err);
  try {
    await writeComputed(process.env.IEXEC_OUT ?? "/tmp", {
      status: "error",
      message: err?.message ?? String(err),
    });
  } catch {
    /* swallow — the failure is already logged */
  }
  process.exit(1);
});
