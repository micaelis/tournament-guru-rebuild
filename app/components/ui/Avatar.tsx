import { safeImageSrc } from "@/lib/url";
import { cn } from "./cn";

/**
 * User / organization avatar. Falls back to a neutral placeholder with
 * initials when no photo is set (spec: "display a nice neutral
 * placeholder icon for missing photos"). Size is a fixed CSS size so
 * the placeholder ring stays circular.
 */
export function Avatar({
  src,
  name,
  size = 36,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const safe = safeImageSrc(src);
  const initials = getInitials(name);
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[13px] font-bold text-slate-600",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={name ?? "User avatar"}
    >
      {safe ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safe}
          alt={name ?? "User avatar"}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </span>
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}
