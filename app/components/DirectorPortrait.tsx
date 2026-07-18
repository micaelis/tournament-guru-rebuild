import { safeImageSrc } from "@/lib/url";
import { SafeImg } from "@/app/components/ui/SafeImg";

/**
 * Portrait for a director card. Renders the profile picture through
 * SafeImg with a designed initials avatar on a brand-tinted gradient as
 * the fallback — never a broken image or an empty grey box, including
 * fetches that fail before hydration. Fully occupies its parent, which
 * owns the aspect ratio.
 */
export function DirectorPortrait({
  src,
  name,
}: {
  src?: string | null;
  name: string;
}) {
  const safeSrc = safeImageSrc(src);
  const initials = getInitials(name);
  const gradient = pickGradient(name);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <SafeImg
        src={safeSrc ?? undefined}
        alt={`Portrait of ${name}`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        style={{
          transition: "transform .5s ease",
        }}
        fallback={
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center"
            style={{
              backgroundImage: gradient,
              backgroundColor: "var(--color-dark-mid)",
            }}
          >
            {/* Faint monogram watermark for texture */}
            <span
              className="pointer-events-none absolute font-heading select-none"
              style={{
                fontSize: "clamp(96px, 18vw, 180px)",
                fontWeight: 900,
                color: "rgba(255,255,255,.06)",
                letterSpacing: "-0.05em",
                lineHeight: 1,
                transform: "translate(6%, 4%)",
              }}
            >
              {initials}
            </span>
            <span
              className="relative font-heading"
              style={{
                color: "#fff",
                fontSize: "clamp(30px, 5.4vw, 44px)",
                fontWeight: 800,
                letterSpacing: "-0.03em",
                textShadow: "0 2px 20px rgba(0,0,0,.25)",
              }}
            >
              {initials}
            </span>
          </div>
        }
      />
    </div>
  );
}

function getInitials(name: string): string {
  const words = (name || "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* Deterministic gradient chosen from a shortlist that all sit on the
   established palette (accent + gold + dark). Same name → same gradient. */
const GRADIENTS = [
  "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
  "linear-gradient(135deg, #1e293b 0%, #b91c1c 100%)",
  "linear-gradient(135deg, #0f172a 0%, #7c2d12 100%)",
  "linear-gradient(135deg, #1e293b 0%, #b45309 100%)",
  "linear-gradient(135deg, #334155 0%, #dc2626 100%)",
  "linear-gradient(135deg, #0f172a 0%, #4b5563 100%)",
];

function pickGradient(name: string): string {
  const hash = [...(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}
