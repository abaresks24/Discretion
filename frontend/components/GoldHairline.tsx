import { cn } from "@/lib/cn";

/**
 * Single thin gold hairline section divider (brief, decorative #1).
 * Never full-width. Default 80px. Centered unless `align` overrides.
 */
export function GoldHairline({
  width = 80,
  vertical = false,
  className,
  animate = false,
}: {
  width?: number;
  vertical?: boolean;
  className?: string;
  animate?: boolean;
}) {
  if (vertical) {
    return (
      <span
        className={cn(
          "block bg-accent-gold origin-top",
          animate && "animate-hairline-fade-in",
          className,
        )}
        style={{ width: 1, height: width }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={cn("block bg-accent-gold", className)}
      style={{ height: 1, width }}
      aria-hidden
    />
  );
}
