import { config } from "../config.js";

/**
 * Thin wrapper around the ChainGPT Web3 General Chat SDK (`@chaingpt/generalchat`).
 *
 * We intentionally keep the surface tiny — one method per use case — so we can
 * swap the underlying client without touching callers. The SDK shape below
 * follows the published package at the time of writing; if the hackathon SDK
 * version differs, adapt this wrapper and nothing else.
 */

// The SDK exports both ESM and CJS. We import dynamically so type issues in
// the package don't break type-checking of our own code.
type ContextInjection = {
  companyName?: string;
  companyDescription?: string;
  purpose?: string;
  limitation?: boolean;
  customTone?: string;
  aiTone?: number;
};

type ChatOpts = {
  question: string;
  chatHistory?: "on" | "off";
  sdkUniqueId?: string;
  useCustomContext?: boolean;
  contextInjection?: ContextInjection;
};

type GeneralChatClient = {
  createChatBlob: (opts: ChatOpts) => Promise<any>;
  createChatStream?: (opts: ChatOpts) => Promise<any>;
};

let cachedClient: GeneralChatClient | null = null;

async function getClient(): Promise<GeneralChatClient> {
  if (cachedClient) return cachedClient;
  const mod: any = await import("@chaingpt/generalchat");
  const Ctor = mod.GeneralChat ?? mod.default ?? mod;
  cachedClient = new Ctor({ apiKey: config.CHAINGPT_API_KEY });
  return cachedClient!;
}

// --------------------------------------------------------------------------
// Prompt engineering — kept in one place so it's easy to iterate on.
// --------------------------------------------------------------------------

export const DISCRETION_DESCRIPTION = `
Discretion is a confidential lending vault on Arbitrum built on iExec Nox
(ERC-7984 confidential tokens) with entry/exit mixers and a public
liquidation market.

How it works:
- Users wrap plaintext tokens (RLC, WETH, USDC) into confidential cTokens,
  optionally via a mixer (WrapQueue / UnwrapQueue) processed by an iExec TDX
  iApp that batches and shuffles deposits to break the sender->receiver link.
- Users deposit cTokens as collateral, then borrow cUSDC against them. All
  balances are encrypted; only the user can decrypt theirs via the Nox SDK.
- Per-asset LTV caps: RLC 70%, WETH 75%, USDC 75%. Liquidation threshold 85%.
- Liquidations: a TEE iApp scans encrypted positions, calls
  revealLiquidatable for any user with HF<1, then anyone can call
  liquidate(user) (first-write-wins) and receives a 5% bonus.
- Live deployment on Arbitrum Sepolia (chainId 421614). Vault address
  0x2264d9328ff9bf7a5076bba8ce6284546e659a5e.
`.trim();

export const DISCRETION_PURPOSE = `
Act as the AI copilot for users of Discretion. Answer ANY question about the
protocol: how to deposit, how mixers work, how liquidations work, what asset
to pick, glossary, walkthroughs. When the user has an open position, also
play risk-advisor: flag the LTV zone (safe<60% / warning 60-75% /
danger 75-85% / liquidatable >=85%) and suggest at most 3 numerically
concrete actions in a JSON code block labelled "suggested_actions".
Action types: "repay" (amount_debt), "add_collateral" (amount_collateral),
"withdraw_collateral" (amount_collateral). Compute expected LTVs from the
provided numbers. If the user has NO position, do not pretend they do — just
answer their question and skip the JSON block.
`.trim();

export const DISCRETION_TONE = `
Be direct, technical, and concise. Address the user as "you". No
disclaimers about "not financial advice", no boilerplate, no apologies for
missing data. If a value is missing in the position state, treat it as zero
and continue. Prefer short paragraphs over bullet walls.
`.trim();

export type PositionContext = {
  user: string;
  collateralAmount: string | null;
  debtAmount: string | null;
  ltvBps: number | null;
  zone: number;
  collateralPriceUsd: number;
  debtPriceUsd: number;
  ltvMaxBps: number;
  liquidationThresholdBps: number;
};

const PROMPT_PREAMBLE = `You are the embedded AI copilot for Discretion. You have full, authoritative knowledge of the protocol via the facts below. Treat them as ground truth.

=== DISCRETION PROTOCOL FACTS (authoritative) ===

${DISCRETION_DESCRIPTION}

=== KEY Q&A REFERENCE ===

Q: How does lending & borrowing work in Discretion?
A: Lenders supply plaintext USDC into the vault, which mints them confidential cUSDC shares earning a flat APR. Borrowers wrap RLC, WETH, or USDC into the matching cToken (optionally via the WrapQueue mixer for entry privacy), deposit the cToken as collateral with depositCollateral(asset, encryptedAmount, proof), then call borrow(amount) to receive cUSDC against their position. Health factor is computed FHE-side from the encrypted balances and per-asset LTV caps (RLC 70%, WETH 75%, USDC 75%). A position is liquidatable once aggregate LTV crosses 85%.

Q: How do mixers work?
A: Two queues — WrapQueue for plaintext->confidential entry and UnwrapQueue for confidential->plaintext exit. An iExec TDX iApp (sealed key, runs in an Intel SGX/TDX enclave) batches several pending requests, shuffles them with a deterministic keccak256(seed || id) order plus a random delay, then submits the resulting transactions on-chain. This breaks the on-chain link between sender and receiver inside a batch. Exit is two-phase: the iApp first calls processBatch(ids) to obtain a decrypted aggregate handle, then polls the Nox gateway for the proof and finalizes with finalizeBatch(reqHandle, decryptedAmount, proof) which distributes plaintext to recipients.

Q: How does liquidation work?
A: Two-step, public, permissionless. Step 1: a TDX iApp scanner periodically decrypts every borrower's position via Nox, computes their LTV, and calls revealLiquidatable(user, ltvBps, debtAmount, deadline) for any borrower above 85%. This emits PositionLiquidatable on-chain — the *first time* a user's debt becomes publicly visible. Step 2: anyone can call liquidate(user) (first-write-wins). The liquidator repays the revealed debt in cUSDC and seizes the collateral plus a 5% bonus (LIQUIDATION_BONUS_BPS=500). After successful liquidation, clearLiquidatable removes the user from the public list.

Q: What assets are supported?
A: Three collaterals: RLC (Nox cRLC), WETH (our cWETH wrapper, ERC-7984), USDC (Nox cUSDC). One debt asset: USDC. Live on Arbitrum Sepolia (chainId 421614).

Q: Why is Discretion private?
A: All collateral and debt amounts are stored as ERC-7984 ciphertext handles. Only the user (and the vault owner + sealed liquidationOperator wallet for liquidation purposes) can decrypt them via the Nox FHE gateway. Public observers see only that "user X did a deposit" — no amount, no asset, no LTV.

=== BEHAVIOUR ===

${DISCRETION_PURPOSE}

=== TONE ===

${DISCRETION_TONE}

=== HARD RULES ===

- NEVER say "information is not available" or "I don't have access". You have the facts above; use them.
- NEVER describe generic DeFi mechanics that don't match the Discretion-specific design above.
- When asked about lending, borrowing, mixers, or liquidation, anchor your answer in the specific Discretion functions (depositCollateral, borrow, WrapQueue.processBatch, revealLiquidatable, liquidate, finalizeBatch).
- Numbers in the position state below are decrypted client-side and authoritative. Trust them.`;

export function buildAnalysisPrompt(ctx: PositionContext): string {
  return `${PROMPT_PREAMBLE}

The user's current Discretion position is:
${JSON.stringify(ctx, null, 2)}

Produce a one-sentence status, the LTV zone, and at most 3 numerically concrete suggested_actions in a JSON code block.`;
}

export function buildChatPrompt(
  ctx: PositionContext,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  message: string,
): string {
  const h = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
  return `${PROMPT_PREAMBLE}

The user's current Discretion position (decrypted client-side):
${JSON.stringify(ctx, null, 2)}

Recent conversation:
${h || "(none)"}

User asks:
${message}

Answer the user's question directly, using ONLY the Discretion-specific knowledge above. If they have a position and the question is risk-related, end with a suggested_actions JSON block. Otherwise no JSON block.`;
}

export const DISCRETION_CONTEXT_INJECTION = {
  companyName: "Discretion",
  companyDescription: DISCRETION_DESCRIPTION,
  purpose: DISCRETION_PURPOSE,
  customTone: DISCRETION_TONE,
  // CUSTOM_TONE = 2 (see PRE_SET_TONES enum in @chaingpt/generalchat).
  aiTone: 2,
  // Tells ChainGPT to stick to the injected context and not pull in
  // generic "DeFi 101" knowledge that drowns out our system prompt.
  limitation: true,
} as const;

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export async function askChainGpt(prompt: string, sdkUniqueId: string): Promise<string> {
  const client = await getClient();
  const res = await client.createChatBlob({
    question: prompt,
    chatHistory: "off",
    sdkUniqueId,
    useCustomContext: true,
    contextInjection: DISCRETION_CONTEXT_INJECTION,
  });
  // SDK wraps response: { statusCode, message, data: { bot } }
  return res?.data?.bot ?? res?.bot ?? "";
}

export async function* streamChainGpt(
  prompt: string,
  sdkUniqueId: string,
): AsyncGenerator<string> {
  const client = await getClient();
  // SDK's createChatStream returns Promise<Readable>; we have to await it
  // before iterating. The stream emits Buffer chunks of raw SSE-style frames
  // ("data: <token>\n\n" repeated). If anything goes wrong we fall back to
  // the blocking blob endpoint so the UI still gets a response.
  if (!client.createChatStream) {
    yield await askChainGpt(prompt, sdkUniqueId);
    return;
  }
  let stream: any;
  try {
    stream = await client.createChatStream({
      question: prompt,
      chatHistory: "off",
      sdkUniqueId,
      useCustomContext: true,
      contextInjection: DISCRETION_CONTEXT_INJECTION,
    });
  } catch {
    yield await askChainGpt(prompt, sdkUniqueId);
    return;
  }
  if (!stream || typeof stream[Symbol.asyncIterator] !== "function") {
    yield await askChainGpt(prompt, sdkUniqueId);
    return;
  }
  for await (const raw of stream as AsyncIterable<Buffer | string>) {
    const text = typeof raw === "string" ? raw : raw.toString("utf8");
    // Strip the "data: " SSE prefix if present, otherwise pass through.
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.startsWith("data:") ? line.slice(5).trimStart() : line;
      if (trimmed) yield trimmed;
    }
  }
}

// --------------------------------------------------------------------------
// Parsing: pull the trailing `suggested_actions` JSON block out of a response.
// --------------------------------------------------------------------------

export type SuggestedAction =
  | { type: "repay"; amount_debt: string; expected_new_ltv_bps: number }
  | { type: "add_collateral"; amount_collateral: string; expected_new_ltv_bps: number }
  | { type: "withdraw_collateral"; amount_collateral: string; expected_new_ltv_bps: number };

export function extractSuggestedActions(raw: string): {
  narrative: string;
  actions: SuggestedAction[];
} {
  const fence = raw.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (!fence) return { narrative: raw.trim(), actions: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(fence[1]);
  } catch {
    return { narrative: raw.trim(), actions: [] };
  }

  const maybeArray = Array.isArray(parsed)
    ? parsed
    : (parsed as { suggested_actions?: unknown })?.suggested_actions;

  if (!Array.isArray(maybeArray)) return { narrative: raw.trim(), actions: [] };

  const actions = maybeArray.filter(isSuggestedAction);
  const narrative = raw.replace(fence[0], "").trim();
  return { narrative, actions };
}

function isSuggestedAction(v: unknown): v is SuggestedAction {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  if (typeof a.type !== "string") return false;
  if (typeof a.expected_new_ltv_bps !== "number") return false;
  if (a.type === "repay") return typeof a.amount_debt === "string";
  if (a.type === "add_collateral" || a.type === "withdraw_collateral") {
    return typeof a.amount_collateral === "string";
  }
  return false;
}
