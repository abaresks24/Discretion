"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Address } from "viem";
import {
  type AlertEvent,
  type ChatHistoryItem,
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
  at: string; // HH:MM
};

/**
 * Owns the Counsel conversation: SSE alerts in, chat messages in/out.
 * State is session-only — never persisted.
 */
export function useCounsel(user: Address | undefined, viewKey: string | null) {
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

  // Initial analysis — fires once after wallet + view key are available.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    analyzePosition(user, viewKey ?? undefined)
      .then((res) => {
        if (cancelled) return;
        pushMessage({ role: "counsel", text: res.narrative, actions: res.actions });
      })
      .catch(() => {
        /* silently swallow — Counsel will greet once the relayer is reachable */
      });
    return () => {
      cancelled = true;
    };
  }, [user, viewKey, pushMessage]);

  // SSE alerts — one pulse + one Counsel message per alert.
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeAlerts(
      user,
      viewKey ?? undefined,
      (ev: AlertEvent) => {
        pushMessage({ role: "counsel", text: ev.narrative, actions: ev.actions });
        triggerPulse();
      },
      () => {
        // Connection errors are silent — SSE auto-retries via EventSource.
      },
    );
    return unsub;
  }, [user, viewKey, pushMessage, triggerPulse]);

  const send = useCallback(
    async (message: string) => {
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
          viewKey: viewKey ?? undefined,
          message,
          history,
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
    [user, viewKey, messages, pushMessage],
  );

  return { messages, pulse, isStreaming, send };
}
