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
    <img {...props} src={src} alt={alt} onError={() => setBrokenSrc(src)} />
  );
}
