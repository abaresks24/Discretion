import { cn } from "@/lib/cn";
import { zoneLabel } from "@/lib/format";

const CLS: Record<number, string> = {
  0: "text-terminal-text",
  1: "text-terminal-amber",
  2: "text-terminal-amber",
  3: "text-terminal-danger",
};

/**
 * Bracketed zone tag — `[SAFE]`, `[WARNING]`, `[DANGER]`, `[LIQUIDATABLE]`.
 * Colored by severity, same mono stroke as everything else.
 */
export function StatusPill({ zone, className }: { zone: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-xs uppercase tracking-[0.2em]",
        CLS[zone] ?? CLS[0],
        className,
      )}
    >
      [{zoneLabel(zone)}]
    </span>
  );
}
