"use client";

/**
 * Landing-page backdrop.
 *
 * Full-viewport muted/looping video, with a dark gradient overlay on top so
 * the wordmark + tagline stay legible. Video lives at `public/landing-bg.mp4`.
 * The name `GlobeBackdrop` is kept for call-site stability — the component
 * is the landing's visual anchor regardless of medium.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GlobeBackdrop(_props: { size?: number }) {
  return (
    <>
      <video
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        src="/landing-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden
      />
      {/* Dark vignette — stronger at edges, softer center — keeps text legible
          without hiding the video entirely. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(15,15,15,0.25) 0%, rgba(15,15,15,0.55) 55%, rgba(15,15,15,0.85) 100%)",
        }}
      />
    </>
  );
}
