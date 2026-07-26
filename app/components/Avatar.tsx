import { safeImageSrc } from "@/lib/url";
import { SafeImg } from "@/app/components/ui/SafeImg";

/** Sized variant of the avatar for public pages. The placeholder is the
 * same red-bg treatment as app/components/ui/Avatar — one style
 * app-wide, dashboard and public. */
export function Avatar({
  name,
  size = 36,
  src,
}: {
  name: string;
  size?: number;
  src?: string | null;
}) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const initialsBadge = (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: "var(--color-accent)",
        fontSize: Math.round(size * 0.4),
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );

  const safe = safeImageSrc(src);
  if (!safe) return initialsBadge;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* A broken photo URL falls back to the same initials badge a
          missing one gets. */}
      <SafeImg
        src={safe}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        fallback={initialsBadge}
      />
    </span>
  );
}
