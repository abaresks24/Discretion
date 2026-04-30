/**
 * Fixed CRT scanline overlay. `soft` variant for in-app (lower opacity).
 */
export function Scanlines({ soft = false }: { soft?: boolean }) {
  return (
    <>
      <div
        aria-hidden
        className={soft ? "crt-scanlines-soft" : "crt-scanlines"}
      />
      <div aria-hidden className="crt-scanlines crt-flicker" />
    </>
  );
}
