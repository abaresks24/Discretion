import { cn } from "@/lib/cn";

type LogoSize = "sm" | "md" | "lg";

const MARK_PX: Record<LogoSize, number> = { sm: 20, md: 32, lg: 56 };
const TYPE_PX: Record<LogoSize, number> = { sm: 13, md: 18, lg: 32 };

/**
 * Discretion mark — uses the brand asset under `/public/logo-discretion.svg`.
 */
export function DiscretionMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/logo-discretion.svg"
      alt="Discretion"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("object-contain", className)}
    />
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
