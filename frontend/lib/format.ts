/**
 * European-convention number formatting with THIN SPACE (U+2009) between
 * thousands. Always 2 decimals by default per the brief.
 */
const THIN_SPACE = "\u2009";

export function formatAmount(value: number | string, decimals = 2): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "0.00";
  const fixed = n.toFixed(decimals);
  const [int, dec] = fixed.split(".");
  const signed = int.startsWith("-");
  const digits = signed ? int.slice(1) : int;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
  return `${signed ? "-" : ""}${grouped}${dec !== undefined ? "." + dec : ""}`;
}

/** Format a BigInt amount (with the token's native decimals) for display. */
export function formatUnits(raw: bigint, decimals: number, displayDecimals = 2): string {
  const base = 10n ** BigInt(decimals);
  const int = raw / base;
  const frac = raw % base;
  const fracStr = frac.toString().padStart(decimals, "0");
  const num = Number(`${int}.${fracStr}`);
  return formatAmount(num, displayDecimals);
}

/** Format an LTV in basis points as a percentage with two decimals. */
export function formatLtvBps(bps: number | bigint): string {
  const n = typeof bps === "bigint" ? Number(bps) : bps;
  return formatAmount(n / 100, 2);
}

/** Zone → short English status label. */
export const zoneLabel = (z: number) =>
  ["SAFE", "WARNING", "DANGER", "LIQUIDATABLE"][Math.min(Math.max(z, 0), 3)];

/** Zone → Tailwind color key (matches tailwind.config colors.zone.*). */
export const zoneColor = (z: number) =>
  (["safe", "safe", "warning", "danger"] as const)[Math.min(Math.max(z, 0), 3)];

/** Short wallet address: 0x1234…abcd, monospace-friendly. */
export function truncateAddress(addr: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** "09:42" clock for Counsel message timestamps. */
export function formatClock(d: Date = new Date()): string {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}
