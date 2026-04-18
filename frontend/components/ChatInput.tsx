"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const m = value.trim();
    if (!m || disabled) return;
    onSend(m);
    setValue("");
  };

  return (
    <div className="pt-6 border-t border-border">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="Ask Counsel…"
        className={cn(
          "w-full bg-transparent resize-none outline-none",
          "font-serif italic text-[15px] leading-relaxed text-ink-primary",
          "placeholder:text-ink-tertiary placeholder:italic",
          "border-0 border-b border-border focus:border-accent-gold",
          "transition-colors duration-300 ease-out pb-2",
        )}
      />
    </div>
  );
}
