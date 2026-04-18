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
type GeneralChatClient = {
  createChatBlob: (opts: {
    model: string;
    question: string;
    chatHistory?: "on" | "off";
    sdkUniqueId?: string;
  }) => Promise<{ bot: string } & Record<string, unknown>>;
  createChatStream?: (opts: {
    model: string;
    question: string;
    chatHistory?: "on" | "off";
    sdkUniqueId?: string;
  }) => AsyncIterable<string>;
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

export const RISK_SYSTEM_PROMPT = `
You are the risk copilot for a confidential lending vault on Arbitrum.
You receive the user's current position state as structured JSON and must:
1. Produce a ONE-SENTENCE status summary in plain English.
2. If LTV > 7000 (in basis points), produce an alert with severity
   (info if <7500 / warning if >=7500 / danger if >=8500).
3. ALWAYS end your response with a JSON code block labelled
   \`suggested_actions\` listing at most 3 actionable, numerically concrete
   suggestions (type + amount + expected LTV bps after action).
   Action types allowed: "repay" (amount_debt), "add_collateral"
   (amount_collateral), "withdraw_collateral" (amount_collateral).
4. Compute expected LTVs correctly using the provided prices. Do not invent
   numbers. If any value is missing in the input, omit that action.
Be direct. No fluff. No disclaimers about "not financial advice".
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

export function buildAnalysisPrompt(ctx: PositionContext): string {
  return `${RISK_SYSTEM_PROMPT}\n\nPOSITION_STATE:\n${JSON.stringify(ctx, null, 2)}`;
}

export function buildChatPrompt(
  ctx: PositionContext,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  message: string,
): string {
  const h = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");
  return `${RISK_SYSTEM_PROMPT}

POSITION_STATE:
${JSON.stringify(ctx, null, 2)}

CONVERSATION_HISTORY:
${h}

USER_MESSAGE:
${message}`;
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

export async function askChainGpt(prompt: string, sdkUniqueId: string): Promise<string> {
  const client = await getClient();
  const res = await client.createChatBlob({
    model: config.CHAINGPT_MODEL,
    question: prompt,
    chatHistory: "off",
    sdkUniqueId,
  });
  return res.bot;
}

export async function* streamChainGpt(
  prompt: string,
  sdkUniqueId: string,
): AsyncGenerator<string> {
  const client = await getClient();
  if (!client.createChatStream) {
    yield await askChainGpt(prompt, sdkUniqueId);
    return;
  }
  for await (const chunk of client.createChatStream({
    model: config.CHAINGPT_MODEL,
    question: prompt,
    chatHistory: "off",
    sdkUniqueId,
  })) {
    yield chunk;
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
