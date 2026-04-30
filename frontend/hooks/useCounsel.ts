"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Address } from "viem";
import {
  type ChatHistoryItem,
  type PositionSnapshot,
  type SuggestedAction,
  analyzePosition,
  streamChat,
  subscribeAlerts,
} from "@/lib/relayer";
import { formatClock } from "@/lib/format";

export type CounselMessage = {
  id: string;
  role: "counsel" | "user";
  text: string;
  actions?: SuggestedAction[];
  at: string;
};

/**
 * Owns the Counsel conversation: refresh notices in, chat messages in/out.
 * State is session-only — never persisted.
 *
 * NOTE: `_viewKey` is kept in the signature for forward-compat — it used to
 * authenticate /analyze. The relayer no longer takes it (decryption is the
 * frontend's responsibility through the Nox gateway), so the value is ignored.
 */
export function useCounsel(user: Address | undefined, _viewKey: string | null) {
  const [messages, setMessages] = useState<CounselMessage[]>([]);
  const [pulse, setPulse] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const idRef = useRef(0);

  const pushMessage = useCallback((m: Omit<CounselMessage, "id" | "at">) => {
    const msg: CounselMessage = {
      id: `${Date.now()}-${idRef.current++}`,
      at: formatClock(),
      ...m,
    };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  }, []);

  const triggerPulse = useCallback(() => {
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 3000);
    return () => window.clearTimeout(t);
  }, []);

  const analyze = useCallback(async () => {
    if (!user) return;
    try {
      const res = await analyzePosition(user);
      pushMessage({ role: "counsel", text: res.narrative, actions: res.actions });
      triggerPulse();
    } catch {
      // Counsel will greet once the relayer is reachable.
    }
  }, [user, pushMessage, triggerPulse]);

  // Initial analysis.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await analyze();
    })();
    return () => {
      cancelled = true;
    };
  }, [user, analyze]);

  // Refresh notices from the relayer's event watcher.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeAlerts(
      user,
      () => {
        void analyze();
      },
      () => {
        // Connection errors auto-retried by EventSource.
      },
    );
    return unsub;
  }, [user, analyze]);

  const send = useCallback(
    async (message: string, snapshot?: PositionSnapshot) => {
      if (!user || !message.trim()) return;
      pushMessage({ role: "user", text: message });

      const history: ChatHistoryItem[] = messages.map((m) => ({
        role: m.role === "counsel" ? "assistant" : "user",
        content: m.text,
      }));

      const streamId = pushMessage({ role: "counsel", text: "" });
      setIsStreaming(true);

      try {
        let accumulated = "";
        for await (const evt of streamChat({
          userAddress: user,
          message,
          history,
          decrypted: snapshot ? { snapshot } : undefined,
        })) {
          if (evt.kind === "token") {
            accumulated += evt.chunk;
            setMessages((prev) =>
              prev.map((m) => (m.id === streamId ? { ...m, text: accumulated } : m)),
            );
          } else if (evt.kind === "done") {
            setMessages((prev) =>
              prev.map((m) => (m.id === streamId ? { ...m, actions: evt.actions } : m)),
            );
          }
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [user, messages, pushMessage],
  );

  return { messages, pulse, isStreaming, send };
}
