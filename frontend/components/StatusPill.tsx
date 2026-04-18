import { cn } from "@/lib/cn";
import { zoneLabel } from "@/lib/format";

const RING: Record<number, string> = {
  0: "border-zone-safe text-zone-safe",
  1: "border-zone-warning text-zone-warning",
  2: "border-zone-warning text-zone-warning",
  3: "border-zone-danger text-zone-danger",
};

/**
 * 1px outlined pill displaying the health zone.
 * Zones: 0 safe, 1 warning, 2 danger, 3 liquidatable.
 */
export function StatusPill({ zone, className }: { zone: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 type-label tracking-[0.18em]",
        RING[zone] ?? RING[0],
        className,
      )}
    >
      {zoneLabel(zone)}
    </span>
  );
}
