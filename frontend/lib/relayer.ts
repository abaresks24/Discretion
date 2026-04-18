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

export async function analyzePosition(
  userAddress: string,
  viewKey?: string,
): Promise<AnalyzeResponse> {
  const res = await fetch(`${env.RELAYER_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userAddress, viewKey }),
  });
  if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
  return (await res.json()) as AnalyzeResponse;
}

export type ChatHistoryItem = { role: "user" | "assistant"; content: string };

/**
 * Streams the /chat endpoint as a stream of token chunks + a final `actions` list.
 * Uses fetch + manual parsing of the SSE framing so we can also pass POST body.
 */
export async function* streamChat(opts: {
  userAddress: string;
  viewKey?: string;
  message: string;
  history: ChatHistoryItem[];
  signal?: AbortSignal;
}): AsyncGenerator<
  { kind: "token"; chunk: string } | { kind: "done"; actions: SuggestedAction[] }
> {
  const res = await fetch(`${env.RELAYER_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
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

    // SSE frames are terminated by a blank line.
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

export type AlertEvent = {
  kind: "alert";
  at: string;
  zone: number;
  narrative: string;
  actions: SuggestedAction[];
};

/**
 * Subscribes to the server-sent alert stream for a user. Returns an unsubscribe
 * function. Uses EventSource — the relayer sets `viewKey` as a query param.
 */
export function subscribeAlerts(
  userAddress: string,
  viewKey: string | undefined,
  onAlert: (e: AlertEvent) => void,
  onError?: (e: unknown) => void,
): () => void {
  const url = new URL(`${env.RELAYER_URL}/alerts/${userAddress}`);
  if (viewKey) url.searchParams.set("viewKey", viewKey);

  const es = new EventSource(url.toString());
  es.addEventListener("alert", (ev) => {
    try {
      onAlert(JSON.parse((ev as MessageEvent).data));
    } catch (err) {
      onError?.(err);
    }
  });
  es.addEventListener("error", (err) => onError?.(err));
  return () => es.close();
}
