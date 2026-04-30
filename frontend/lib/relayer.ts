import { env } from "./env";

export type SuggestedAction =
  | { type: "repay"; amount_debt: string; expected_new_ltv_bps: number }
  | { type: "add_collateral"; amount_collateral: string; expected_new_ltv_bps: number }
  | { type: "withdraw_collateral"; amount_collateral: string; expected_new_ltv_bps: number };

export type AnalyzeResponse = {
  ok: boolean;
  narrative: string;
  actions: SuggestedAction[];
  context: {
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
};

export type PositionSnapshot = {
  totalCollatUsd: number;
  weightedCollatUsd: number;
  debtUsd: number;
  ltvBps: number;
  zone: number;
  perAsset: Array<{
    symbol: string;
    amount: number;
    valueUsd: number;
    ltvBps: number;
  }>;
};

export type DecryptedAmounts = {
  collateralRaw?: bigint;
  debtRaw?: bigint;
  snapshot?: PositionSnapshot;
};

function toBody(userAddress: string, decrypted: DecryptedAmounts) {
  return {
    userAddress,
    collateralRaw:
      decrypted.collateralRaw !== undefined ? decrypted.collateralRaw.toString() : undefined,
    debtRaw: decrypted.debtRaw !== undefined ? decrypted.debtRaw.toString() : undefined,
    snapshot: decrypted.snapshot,
  };
}

export async function analyzePosition(
  userAddress: string,
  decrypted: DecryptedAmounts = {},
): Promise<AnalyzeResponse> {
  const res = await fetch(`${env.RELAYER_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toBody(userAddress, decrypted)),
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return (await res.json()) as AnalyzeResponse;
}

export type ChatHistoryItem = { role: "user" | "assistant"; content: string };

export async function* streamChat(opts: {
  userAddress: string;
  message: string;
  history: ChatHistoryItem[];
  decrypted?: DecryptedAmounts;
  signal?: AbortSignal;
}): AsyncGenerator<
  { kind: "token"; chunk: string } | { kind: "done"; actions: SuggestedAction[] }
> {
  const body = {
    ...toBody(opts.userAddress, opts.decrypted ?? {}),
    message: opts.message,
    history: opts.history,
  };
  const res = await fetch(`${env.RELAYER_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const parsed = parseSseFrame(frame);
      if (!parsed) continue;
      if (parsed.event === "token") {
        yield { kind: "token", chunk: parsed.data.chunk ?? "" };
      } else if (parsed.event === "done") {
        yield { kind: "done", actions: parsed.data.actions ?? [] };
      } else if (parsed.event === "error") {
        throw new Error(parsed.data.error ?? "chat stream error");
      }
    }
  }
}

function parseSseFrame(frame: string): { event: string; data: any } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

export type RefreshEvent = {
  kind: "refresh";
  at: string;
  reason: string;
};

/**
 * Subscribes to server-sent refresh notices. The relayer emits these whenever
 * an on-chain balance event fires for the user — the frontend should then
 * re-decrypt handles via the Nox gateway and re-run `/analyze`.
 */
export function subscribeAlerts(
  userAddress: string,
  onRefresh: (e: RefreshEvent) => void,
  onError?: (e: unknown) => void,
): () => void {
  const url = new URL(`${env.RELAYER_URL}/alerts/${userAddress}`);
  const es = new EventSource(url.toString());
  es.addEventListener("refresh", (ev) => {
    try {
      onRefresh(JSON.parse((ev as MessageEvent).data));
    } catch (err) {
      onError?.(err);
    }
  });
  es.addEventListener("error", (err) => onError?.(err));
  return () => es.close();
}
