"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { MeshBasicMaterial } from "three";

/**
 * Globe.gl backdrop for the landing page — the one décor piece Arthur pulled
 * from https://github.com/vasturiano/globe.gl. Everything else on the page
 * stays static per the brief.
 *
 * Design rules applied:
 *   - Positioned OFF-AXIS (bottom-right, partly offscreen) per asymmetric rule.
 *   - Monochromatic dark with faint gold hex polygons — no atmosphere glow.
 *   - Auto-rotates slowly; user interaction disabled (no drag, no zoom).
 *   - Opacity 0.35 so it recedes behind the wordmark.
 */

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

// Synthesise a sparse set of hex-polygon anchor points so we don't ship
// a country geojson bundle. Each point is a lat/lng; globe.gl's hexBin*
// APIs turn them into hex tiles around the sphere.
function useSparsePoints(count: number) {
  return useMemo(() => {
    const rng = mulberry32(42);
    return Array.from({ length: count }, () => ({
      lat: (rng() - 0.5) * 180,
      lng: (rng() - 0.5) * 360,
      weight: rng(),
    }));
  }, [count]);
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function GlobeBackdrop({ size = 720 }: { size?: number }) {
  const ref = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const points = useSparsePoints(260);

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0x1a1a1a,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !ref.current) return;
    const controls = ref.current.controls?.();
    if (!controls) return;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.25;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = false;
    // Nudge the initial camera angle so the globe reads as a sliver, not a face.
    ref.current.pointOfView?.({ lat: 18, lng: -52, altitude: 2.6 }, 0);
  }, [mounted]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-[-18%] right-[-12%] opacity-[0.35]"
      style={{ width: size, height: size }}
    >
      {mounted && (
        <Globe
          ref={ref}
          width={size}
          height={size}
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere={false}
          globeMaterial={material}
          hexBinPointsData={points}
          hexBinPointWeight="weight"
          hexBinResolution={3}
          hexAltitude={() => 0.005}
          hexTopColor={() => "rgba(200,178,115,0.55)"}
          hexSideColor={() => "rgba(200,178,115,0.18)"}
          hexBinMerge
        />
      )}
    </div>
  );
}

