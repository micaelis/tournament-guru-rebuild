import { safeImageSrc } from "@/lib/url";
import { SafeImg } from "./SafeImg";
import { cn } from "./cn";

/**
 * User / organization avatar. Falls back to a neutral placeholder with
 * initials when no photo is set (spec: "display a nice neutral
 * placeholder icon for missing photos") — and when the photo URL fails
 * to load (SafeImg handles both post-hydration errors and fetches that
 * died before hydration). Size is a fixed CSS size so the placeholder
 * ring stays circular.
 */
export function Avatar({
  src,
  name,
  size = 36,
  dark,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  dark?: boolean;
  className?: string;
}) {
  const safe = safeImageSrc(src);
  const initials = getInitials(name);
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center overflow-hidden rounded-full text-[13px] font-bold",
        dark
          ? "bg-white/[0.12] text-white/70"
          : "bg-slate-100 text-slate-600",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={name ?? "User avatar"}
    >
      <SafeImg
        src={safe ?? undefined}
        alt={name ?? "User avatar"}
        width={size}
        height={size}
        className="h-full w-full object-cover"
        fallback={<span>{initials || "?"}</span>}
      />
    </span>
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}
