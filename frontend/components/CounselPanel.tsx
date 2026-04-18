"use client";

import { useEffect, useRef } from "react";
import { Card } from "./Card";
import { CounselMessage, UserMessage } from "./CounselMessage";
import { SuggestionCard } from "./SuggestionCard";
import { ChatInput } from "./ChatInput";
import type { CounselMessage as CM } from "@/hooks/useCounsel";
import type { SuggestedAction } from "@/lib/relayer";
import { cn } from "@/lib/cn";

/**
 * Column 3 on the dashboard. Scrollable thread + chat input. Right-edge gold
 * hairline pulses for 3s on new alerts (brief, animation C — "Gentle Pulse").
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

  // Stick to bottom on every new message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="relative">
      <Card label="COUNSEL" className="w-[464px] min-h-[760px]">
        <div
          ref={scrollRef}
          className="scroll-quiet flex flex-col gap-7 overflow-y-auto max-h-[600px] pr-2"
        >
          {messages.length === 0 && (
            <p className="type-body-serif text-ink-tertiary">
              Counsel is listening. Open your position to begin.
            </p>
          )}
          {messages.map((m) =>
            m.role === "counsel" ? (
              <div key={m.id} className="flex flex-col gap-3">
                <CounselMessage at={m.at}>
                  {m.text || <span className="text-ink-tertiary">…</span>}
                </CounselMessage>
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {m.actions.map((a, i) => (
                      <SuggestionCard key={i} action={a} onApply={onApplySuggestion} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <UserMessage key={m.id} at={m.at} text={m.text} />
            ),
          )}
        </div>

        <div className="mt-auto">
          <ChatInput onSend={onSend} disabled={isStreaming} />
        </div>
      </Card>

      {/* Right-edge gold hairline — pulses for 3s on new alerts. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-10 bottom-10 right-0 w-px bg-accent-gold",
          pulse ? "animate-pulse-soft" : "opacity-0",
        )}
      />
    </div>
  );
}
