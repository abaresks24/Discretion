import { cn } from "@/lib/cn";

type LogoSize = "sm" | "md" | "lg";

const MARK_PX: Record<LogoSize, number> = { sm: 20, md: 32, lg: 56 };
const TYPE_PX: Record<LogoSize, number> = { sm: 13, md: 18, lg: 32 };

/**
 * Discretion mark — a filled circle with a negative crescent in the upper-left.
 * This mark is positioned asymmetrically by design (see brief, decorative #2).
 */
export function DiscretionMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn("text-accent-gold", className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <circle cx="8.6" cy="8.6" r="4.2" fill="#0F0F0F" />
    </svg>
  );
}

/**
 * Full logo: mark + wordmark. Three sizes per brief.
 */
export function Logo({
  size = "md",
  wordmark = true,
  className,
}: {
  size?: LogoSize;
  wordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <DiscretionMark size={MARK_PX[size]} />
      {wordmark && (
        <span
          className="font-serif font-light text-ink-primary"
          style={{ fontSize: TYPE_PX[size], letterSpacing: "0.14em" }}
        >
          DISCRETION
        </span>
      )}
    </div>
  );
}
