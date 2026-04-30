"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Shell-style prompt with a trailing blinking block cursor. Enter submits,
 * Shift+Enter newlines (textarea under the hood, 1 visible row by default).
 */
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
    <div className="pt-3 border-t border-terminal-border flex items-center gap-2 font-mono">
      <span className="text-terminal-text terminal-glow">$</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="ask counsel…"
        disabled={disabled}
        className={cn(
          "flex-1 bg-transparent outline-none border-0",
          "font-mono text-sm text-terminal-text caret-terminal-text",
          "placeholder:text-terminal-fade",
          "disabled:opacity-50",
        )}
      />
      {!disabled && !value && (
        <span aria-hidden className="text-terminal-text animate-blink">
          █
        </span>
      )}
    </div>
  );
}
