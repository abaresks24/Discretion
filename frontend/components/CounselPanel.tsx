"use client";

import { useEffect, useRef } from "react";
import { Card } from "./Card";
import { CounselMessage, UserMessage } from "./CounselMessage";
import { SuggestionCard } from "./SuggestionCard";
import { ChatInput } from "./ChatInput";
import { useTypewriter } from "@/hooks/useTypewriter";
import type { CounselMessage as CM } from "@/hooks/useCounsel";
import type { SuggestedAction } from "@/lib/relayer";
import { cn } from "@/lib/cn";

/**
 * Column 3 — Counsel. Occupies the lion's share of the viewport. Live log
 * area grows to fill, chat input pinned at the bottom.
 */
export function CounselPanel({
  messages,
  pulse,
  isStreaming,
  onSend,
  onApplySuggestion,
}: {
  messages: CM[];
  pulse: boolean;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onApplySuggestion: (a: SuggestedAction) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  return (
    <div className="relative h-full">
      <Card label="counsel://root" className="h-full">
        <BootLine />
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-2 scroll-quiet"
        >
          {messages.length === 0 && <BootGreeting />}
          {messages.map((m) =>
            m.role === "counsel" ? (
              <div key={m.id} className="flex flex-col gap-2">
                <CounselMessage at={m.at}>
                  {m.text || (
                    <span className="animate-blink text-terminal-text">█</span>
                  )}
                </CounselMessage>
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-col gap-1 pl-6">
                    {m.actions.map((a, i) => (
                      <SuggestionCard
                        key={i}
                        index={i + 1}
                        action={a}
                        onApply={onApplySuggestion}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <UserMessage key={m.id} at={m.at} text={m.text} />
            ),
          )}
        </div>
        <ChatInput onSend={onSend} disabled={isStreaming} />
      </Card>

      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-2 bottom-2 right-0 w-px bg-terminal-text",
          pulse ? "animate-pulse-soft" : "opacity-0",
        )}
      />
    </div>
  );
}

function BootLine() {
  const { display, done } = useTypewriter(
    "# connected to chaingpt tty · stream open · awaiting events",
    { msPerChar: 14 },
  );
  return (
    <div className="text-terminal-fade text-[11px] font-mono">
      {display}
      {!done && <span className="animate-blink">█</span>}
    </div>
  );
}

function BootGreeting() {
  const { display, done } = useTypewriter(
    "session established. vault synchronized. awaiting instructions.",
    { msPerChar: 22, delay: 600 },
  );
  return (
    <div className="font-mono text-sm leading-relaxed">
      <span className="text-terminal-fade">[00:00]</span>{" "}
      <span className="text-terminal-dim">counsel&gt;</span>{" "}
      <span className="text-terminal-text">{display}</span>
      {!done && <span className="animate-blink text-terminal-text">█</span>}
    </div>
  );
}
