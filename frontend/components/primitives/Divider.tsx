import { cn } from "@/lib/cn";

/**
 * ASCII-style divider — renders repeated `─` or `═` across full width.
 */
export function Divider({
  variant = "thin",
  className,
}: {
  variant?: "thin" | "thick";
  className?: string;
}) {
  const ch = variant === "thick" ? "═" : "─";
  return (
    <div
      aria-hidden
      className={cn(
        "font-mono text-ink-tertiary whitespace-nowrap overflow-hidden select-none leading-none",
        className,
      )}
    >
      {ch.repeat(200)}
    </div>
  );
}
