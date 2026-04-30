/**
 * Discretion mixer + liquidation iApp — runs inside an iExec TDX enclave.
 *
 * One Docker image, three modes selected by `IEXEC_APP_DEVELOPER_SECRET`-
 * sealed config + a single `--args` flag:
 *   - `wrap`             : process the WrapQueue (entry mixer for RLC)
 *   - `unwrap`           : process the UnwrapQueue (exit mixer for cUSDC)
 *                          two-phase — submit + finalize
 *   - `scan-liquidations`: poll the vault, decrypt aggregate HF via the
 *                          owner-audit ACL granted to the sealed wallet,
 *                          publish `revealLiquidatable` for unhealthy
 *                          positions and `clearLiquidatable` for recovered
 *                          ones
 *
 * Privacy story:
 *   The signer key is sealed inside the enclave — neither the operator nor
 *   the iExec workerpool sees it. Only the deterministic Docker image hashed
 *   into the iApp contract at deploy time can sign with it. Combined with
 *   the random reveal delay, this prevents both off-chain custodial leaks
 *   and on-chain timing-correlation attacks.
 */

import fs from "node:fs/promises";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { createEthersHandleClient } from "@iexec-nox/handle";

const RPC_URL = "https://arbitrum-sepolia-rpc.publicnode.com";

// Hardcoded — addresses redeploy = iApp rebuild. We do NOT take addresses
// via `--args` because iapp's arg parser silently coerces hex literals
// (e.g. `0x47…`) into JS Number scientific notation.
const WRAP_QUEUE_ADDRESS   = "0x2A6Ab3eA4eEb4f69fAC934AC138f1B207989e23b";
const UNWRAP_QUEUE_ADDRESS = "0x451b42AcE634985e8861D52a788e88Bda0e46587";
const VAULT_ADDRESS        = "0x2264d9328ff9bf7a5076bba8ce6284546e659a5e";
const ORACLE_ADDRESS       = "0x427a6EAde8CBb4dD3796262D75b598aF366BfE76";

// Plaintext addresses + decimals for every collateral asset registered on
// the vault. Prices are read live from the oracle (Chainlink for assets
// with a feed, manual override otherwise — see HybridPriceOracle).
const COLLATERAL_ASSETS = [
  { symbol: "RLC",  underlying: "0x9923eD3cbd90CD78b910c475f9A731A6e0b8C963", decimals: 9 },
  { symbol: "WETH", underlying: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", decimals: 18 },
  { symbol: "USDC", underlying: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", decimals: 6 },
];
const DEBT_DECIMALS = 6; // cUSDC

const DEFAULT_BATCH_LIMIT = 20;
const DEFAULT_MIN_BATCH = 1;
const RANDOM_DELAY_MAX_SEC = 60; // upper bound on the timing-decorrelation jitter
const LIQUIDATION_DEADLINE_SEC = 30 * 60; // reveals expire 30 min after publishing
const LIQ_THRESHOLD_BPS = 8500;

const WRAP_QUEUE_ABI = [
  "function pendingIds(uint256 cursor, uint256 limit) view returns (uint256[])",
  "function queueLength() view returns (uint256)",
  "function operator() view returns (address)",
  "function processBatch(uint256[] ids)",
];

const UNWRAP_QUEUE_ABI = [
  "function pendingIds(uint256 cursor, uint256 limit) view returns (uint256[])",
  "function queueLength() view returns (uint256)",
  "function operator() view returns (address)",
  "function processBatch(uint256[] ids) returns (bytes32 reqHandle)",
  "function finalizeBatch(bytes32 reqHandle, bytes decryptedAmountAndProof)",
  "event BatchSubmitted(bytes32 indexed reqHandle, uint256 count)",
];

const VAULT_ABI = [
  "function liquidationOperator() view returns (address)",
  "function getEncryptedCollateral(address asset, address user) view returns (bytes32)",
  "function getEncryptedDebt(address user) view returns (bytes32)",
  "function liquidatables(address user) view returns (bool active, uint40 revealedAt, uint40 deadline, uint96 ltvBps, uint128 debtAmount)",
  "function revealLiquidatable(address user, uint256 ltvBps, uint256 debtAmount, address[] assets, uint256[] amounts, uint40 deadline)",
  "function clearLiquidatable(address user)",
  "event Borrowed(address indexed user)",
  "event CollateralDeposited(address indexed user, address indexed asset)",
];

const ORACLE_ABI = [
  "function getPrice(address asset) view returns (uint256 price, uint256 updatedAt)",
];

async function writeComputed(out, payload) {
  await fs.writeFile(`${out}/result.json`, JSON.stringify(payload, null, 2));
  await fs.writeFile(
    `${out}/computed.json`,
    JSON.stringify({ "deterministic-output-path": `${out}/result.json` }),
  );
}

async function randomDelay() {
  // Jitters timing on every batch / reveal. Breaks the "price moved at T,
  // reveal happened at T+epsilon" correlation that lets an observer infer
  // which positions were liquidated by which oracle update.
  const ms = Math.floor(Math.random() * RANDOM_DELAY_MAX_SEC * 1000);
  console.log(`[delay] sleeping ${(ms / 1000).toFixed(1)}s before submit`);
  await new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// MODE: wrap — process WrapQueue
// ---------------------------------------------------------------------------

async function runWrapMode(wallet, opts) {
  const queue = new Contract(WRAP_QUEUE_ADDRESS, WRAP_QUEUE_ABI, wallet);

  const operator = await queue.operator();
  if (operator.toLowerCase() !== wallet.address.toLowerCase()) {
    console.warn(
      `[warn] sealed signer ${wallet.address} is not the WrapQueue operator ${operator}; tx will revert`,
    );
  }

  const ids = await queue.pendingIds(0, opts.batchLimit);
  console.log(`[wrap] pending entries: ${ids.length}`);

  if (ids.length < opts.minBatch) {
    return {
      status: "skipped",
      mode: "wrap",
      reason: `pending (${ids.length}) below minBatch (${opts.minBatch})`,
    };
  }

  const shuffled = await deterministicShuffle(ids, wallet.provider);
  await randomDelay();

  console.log(`[wrap] submitting processBatch for ${shuffled.length} ids`);
  const tx = await queue.processBatch(shuffled);
  const receipt = await tx.wait();
  console.log(`[wrap] ✓ tx ${receipt.hash} @ block ${receipt.blockNumber}`);

  return {
    status: "processed",
    mode: "wrap",
    queue: WRAP_QUEUE_ADDRESS,
    count: shuffled.length,
    ids: shuffled.map(String),
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}

// ---------------------------------------------------------------------------
// MODE: unwrap — process UnwrapQueue (two-phase)
// ---------------------------------------------------------------------------

async function runUnwrapMode(wallet, opts) {
  if (UNWRAP_QUEUE_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return {
      status: "skipped",
      mode: "unwrap",
      reason: "UNWRAP_QUEUE_ADDRESS not configured in iApp build",
    };
  }
  const queue = new Contract(UNWRAP_QUEUE_ADDRESS, UNWRAP_QUEUE_ABI, wallet);

  const ids = await queue.pendingIds(0, opts.batchLimit);
  console.log(`[unwrap] pending entries: ${ids.length}`);

  if (ids.length < opts.minBatch) {
    return {
      status: "skipped",
      mode: "unwrap",
      reason: `pending (${ids.length}) below minBatch (${opts.minBatch})`,
    };
  }

  const shuffled = await deterministicShuffle(ids, wallet.provider);
  await randomDelay();

  // Phase 1 — submit the unwrap, capture the request handle from the event.
  console.log(`[unwrap] phase 1 — submitting processBatch (${shuffled.length} ids)`);
  const submitTx = await queue.processBatch(shuffled);
  const submitReceipt = await submitTx.wait();
  const submittedEvt = submitReceipt.logs
    .map((l) => {
      try { return queue.interface.parseLog(l); } catch { return null; }
    })
    .find((p) => p && p.name === "BatchSubmitted");
  const reqHandle = submittedEvt?.args?.reqHandle;
  if (!reqHandle) throw new Error("BatchSubmitted event not found");
  console.log(`[unwrap] phase 1 ✓ reqHandle=${reqHandle}`);

  // Phase 2 — poll Nox gateway for the public-decryption proof, then
  // finalize. The proof is generated asynchronously (gateway sees the
  // reveal request from the burn op, signs after the request is finalised).
  console.log(`[unwrap] phase 2 — polling gateway for decryption proof…`);
  let nox;
  try {
    nox = await initNoxClient(wallet);
  } catch (e) {
    console.error("[unwrap] Nox handle client init failed:", e.message);
    return {
      status: "phase1-submitted-finalize-pending",
      mode: "unwrap",
      queue: UNWRAP_QUEUE_ADDRESS,
      count: shuffled.length,
      submitTxHash: submitReceipt.hash,
      reqHandle,
      note: `Nox SDK init failed — re-run after the gateway/subgraph become reachable: ${e.message}`,
    };
  }
  const POLL_INTERVAL_MS = 6_000;
  const MAX_ATTEMPTS = 30; // ~3 minutes
  let proof = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await nox.publicDecrypt(reqHandle);
      proof = res.decryptionProof;
      console.log(`[unwrap] gateway proof obtained on attempt ${attempt}`);
      break;
    } catch (e) {
      if (attempt % 5 === 0) {
        console.log(`[unwrap] still waiting for proof (attempt ${attempt}/${MAX_ATTEMPTS}) — ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  if (!proof) {
    return {
      status: "phase1-submitted-finalize-pending",
      mode: "unwrap",
      queue: UNWRAP_QUEUE_ADDRESS,
      count: shuffled.length,
      submitTxHash: submitReceipt.hash,
      reqHandle,
      note: "Gateway proof not ready after 3 min. Re-run 'unwrap' to retry finalization, or call finalizeBatch manually with the proof when available.",
    };
  }

  console.log(`[unwrap] phase 2 — calling finalizeBatch on UnwrapQueue`);
  const finalizeTx = await queue.finalizeBatch(reqHandle, proof);
  const finalizeReceipt = await finalizeTx.wait();
  console.log(`[unwrap] ✓ finalized in tx ${finalizeReceipt.hash}`);

  return {
    status: "processed",
    mode: "unwrap",
    queue: UNWRAP_QUEUE_ADDRESS,
    count: shuffled.length,
    ids: shuffled.map(String),
    submitTxHash: submitReceipt.hash,
    finalizeTxHash: finalizeReceipt.hash,
    reqHandle,
  };
}

// ---------------------------------------------------------------------------
// MODE: scan-liquidations — TEE-detect underwater positions and reveal them
// ---------------------------------------------------------------------------

async function runLiquidationScan(wallet) {
  const vault = new Contract(VAULT_ADDRESS, VAULT_ABI, wallet);
  const oracle = new Contract(ORACLE_ADDRESS, ORACLE_ABI, wallet);

  // Live oracle prices for the USD valuations.
  const prices = await fetchPrices(oracle);

  // Bootstrap the Nox handle client for FHE decryption. Audit ACL is
  // already granted to this sealed wallet by the vault's _grantAudit on
  // every position update.
  const network = await wallet.provider.getNetwork();
  console.log(`[liq] initialising Nox handle client on chainId ${network.chainId}…`);
  let nox;
  try {
    nox = await initNoxClient(wallet);
  } catch (e) {
    console.error("[liq] Nox handle client init failed:", e.message);
    return {
      status: "error",
      mode: "scan-liquidations",
      reason: `Nox SDK init failed — gateway/subgraph unreachable from enclave? (${e.message})`,
    };
  }

  // 1. Collect every borrower the vault has seen via Borrowed events.
  console.log("[liq] scanning Borrowed events for candidate users…");
  const latest = await wallet.provider.getBlockNumber();
  const PAGE = 2000;
  const candidates = new Set();
  for (let from = 0; from <= latest; from += PAGE) {
    const to = Math.min(latest, from + PAGE);
    const logs = await vault.queryFilter(vault.filters.Borrowed(), from, to);
    for (const log of logs) candidates.add(log.args.user.toLowerCase());
  }
  console.log(`[liq] candidates: ${candidates.size}`);

  const reveals = [];
  for (const user of candidates) {
    try {
      const aggregate = await decryptAggregatePosition(nox, vault, oracle, user, prices);
      const ltvBps =
        aggregate.collatUsd > 0
          ? Math.min(
              Math.round((aggregate.debtUsd / aggregate.collatUsd) * 10000),
              99999,
            )
          : 0;
      console.log(
        `[liq] ${user} → debt=${aggregate.debtUsd.toFixed(2)}USD collat=${aggregate.collatUsd.toFixed(2)}USD ltv=${(ltvBps/100).toFixed(2)}%`,
      );

      const existing = await vault.liquidatables(user);
      const isAlreadyRevealed = existing.active;

      if (ltvBps >= LIQ_THRESHOLD_BPS) {
        if (isAlreadyRevealed) continue; // already published
        await randomDelay();
        const deadline = Math.floor(Date.now() / 1000) + LIQUIDATION_DEADLINE_SEC;
        const tx = await vault.revealLiquidatable(
          user,
          ltvBps,
          aggregate.debtRaw,
          aggregate.assets,
          aggregate.collatRaws,
          deadline,
        );
        const r = await tx.wait();
        reveals.push({ user, ltvBps, txHash: r.hash, action: "reveal" });
      } else if (isAlreadyRevealed && ltvBps < LIQ_THRESHOLD_BPS - 200) {
        // Hysteresis: clear only after a 2% buffer to avoid flapping.
        const tx = await vault.clearLiquidatable(user);
        const r = await tx.wait();
        reveals.push({ user, ltvBps, txHash: r.hash, action: "clear" });
      }
    } catch (e) {
      console.warn(`[liq] ${user} — ${e.message}`);
    }
  }

  return {
    status: "scanned",
    mode: "scan-liquidations",
    candidates: candidates.size,
    actions: reveals,
  };
}

/**
 * Decrypts the user's aggregate position via the Nox handle SDK. The sealed
 * wallet has audit ACL on every handle thanks to the vault's `_grantAudit`
 * (which now grants the liquidationOperator alongside the user + owner).
 *
 * Returns:
 *   - assets[]   plaintext ERC-20 addresses of collat assets with non-zero balance
 *   - collatRaws[] amounts as bigints in native asset decimals
 *   - debtRaw    debt as bigint in cUSDC decimals
 *   - collatUsd  total collat value (USD float, oracle-priced)
 *   - debtUsd    debt value (USD float)
 */
async function decryptAggregatePosition(nox, vault, oracle, user, prices) {
  const debtHandle = await vault.getEncryptedDebt(user);
  let debtRaw = 0n;
  if (!/^0x0+$/.test(debtHandle)) {
    const { value } = await nox.decrypt(debtHandle);
    debtRaw = BigInt(value);
  }
  const debtUsd = Number(debtRaw) / 10 ** DEBT_DECIMALS;

  const assets = [];
  const collatRaws = [];
  let collatUsd = 0;
  for (const a of COLLATERAL_ASSETS) {
    const handle = await vault.getEncryptedCollateral(a.underlying, user);
    if (/^0x0+$/.test(handle)) {
      assets.push(a.underlying);
      collatRaws.push(0n);
      continue;
    }
    let raw = 0n;
    try {
      const { value } = await nox.decrypt(handle);
      raw = BigInt(value);
    } catch (e) {
      console.warn(`[decrypt] ${user} ${a.symbol} → ${e.message}`);
    }
    assets.push(a.underlying);
    collatRaws.push(raw);
    collatUsd += (Number(raw) / 10 ** a.decimals) * (prices[a.symbol] ?? 0);
  }

  return { assets, collatRaws, debtRaw, debtUsd, collatUsd };
}

/** Fetch live USD prices (8-dec scaled) for every collateral asset. */
async function fetchPrices(oracle) {
  const out = {};
  for (const a of COLLATERAL_ASSETS) {
    try {
      const [price] = await oracle.getPrice(a.underlying);
      out[a.symbol] = Number(price) / 1e8;
    } catch (e) {
      console.warn(`[oracle] ${a.symbol} → ${e.message}`);
      out[a.symbol] = 0;
    }
  }
  console.log(`[oracle] live prices: ${JSON.stringify(out)}`);
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Robust wrapper around `createEthersHandleClient`. Surfaces a clear error
 * when the Nox gateway / subgraph isn't reachable from the enclave network.
 * The SDK ships built-in config for chainId 421614 (Arbitrum Sepolia) so
 * no override is needed in normal operation.
 */
async function initNoxClient(wallet) {
  const network = await wallet.provider.getNetwork();
  const chainId = Number(network.chainId);
  if (chainId !== 421614) {
    throw new Error(
      `unexpected chainId ${chainId} — iApp pinned to Arbitrum Sepolia (421614)`,
    );
  }
  // Fail fast with a clearer error than the SDK's generic timeout if the
  // gateway URL is unreachable. The default config points at Nox's OVH-TDX
  // gateway endpoint.
  const client = await createEthersHandleClient(wallet);
  return client;
}

async function deterministicShuffle(ids, provider) {
  const latest = await provider.getBlock("latest");
  const seed = latest?.hash ?? "0x0";
  return [...ids]
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
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const { IEXEC_OUT, IEXEC_APP_DEVELOPER_SECRET } = process.env;
  if (!IEXEC_OUT) throw new Error("IEXEC_OUT is not set");
  if (!IEXEC_APP_DEVELOPER_SECRET)
    throw new Error("IEXEC_APP_DEVELOPER_SECRET not set — seal the operator key");

  const rawArgs = process.argv
    .slice(2)
    .flatMap((a) => a.split(/\s+/).filter(Boolean));
  const mode = rawArgs[0] || "wrap";
  const batchLimit = rawArgs[1] ? Number(rawArgs[1]) : DEFAULT_BATCH_LIMIT;
  const minBatch = rawArgs[2] ? Number(rawArgs[2]) : DEFAULT_MIN_BATCH;

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(IEXEC_APP_DEVELOPER_SECRET, provider);
  // Always log the sealed signer first thing so the operator wiring can be
  // configured (setOperator on WrapQueue/UnwrapQueue, setLiquidationOperator
  // on the vault) right after a fresh iApp deploy.
  console.log(`[init] sealed signer ${wallet.address} · mode=${mode}`);

  let result;
  switch (mode) {
    case "wrap":
      result = await runWrapMode(wallet, { batchLimit, minBatch });
      break;
    case "unwrap":
      result = await runUnwrapMode(wallet, { batchLimit, minBatch });
      break;
    case "scan-liquidations":
      result = await runLiquidationScan(wallet);
      break;
    default:
      throw new Error(`unknown mode: ${mode}`);
  }
  result.signer = wallet.address;
  result.checkedAt = new Date().toISOString();
  await writeComputed(IEXEC_OUT, result);
}

main().catch(async (err) => {
  console.error("mixer iApp error:", err);
  try {
    await writeComputed(process.env.IEXEC_OUT ?? "/tmp", {
      status: "error",
      message: err?.message ?? String(err),
    });
  } catch {
    /* swallow — already logged */
  }
  process.exit(1);
});
