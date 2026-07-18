"use client";

import { useState } from "react";

/**
 * <img> that renders `fallback` (default: nothing) when the source is
 * missing OR fails to load — a dead host / hotlink block / deleted file
 * must never paint the browser's broken-image glyph. Callers pass the
 * same decorative fallback they'd show for a missing URL (letter tile,
 * glyph backdrop) so "no image" and "broken image" look identical.
 *
 * Remote URLs must already be scheme-checked (`safeImageSrc`) by the
 * caller — this component only handles load failure, not URL hygiene.
 */
export function SafeImg({
  fallback = null,
  src,
  alt = "",
  ...props
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string;
  fallback?: React.ReactNode;
}) {
  // Keyed by src so a later src change gets a fresh attempt without an
  // effect-based reset.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  if (!src || brokenSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      // SSR race: on a server-rendered page the browser can finish (and
      // fail) the fetch BEFORE hydration attaches onError — the error
      // event never re-fires, so the mount ref inspects the dead state
      // directly (complete with zero naturalWidth = failed load).
      ref={(el) => {
        if (el && el.complete && el.naturalWidth === 0) setBrokenSrc(src);
      }}
      src={src}
      alt={alt}
      onError={() => setBrokenSrc(src)}
    />
  );
}
