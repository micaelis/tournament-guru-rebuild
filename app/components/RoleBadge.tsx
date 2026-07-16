/*
 * Reviewer badges.
 *
 * The role badge is derived from the review AUTHOR's profile (author_id →
 * profiles), never from a field on the review itself:
 *   user_type 'event_director'            → "Event Director"
 *   user_type 'attendee' + attendee_type  → Parent / Spectator · Coach · Team Manager
 *   no author / unknown type              → "Attendee" (never blank / "NULL")
 *
 * The GURU pill is independent — shown whenever guru_review is true, alongside
 * the role (a review can be Coach AND Guru).
 */

import type { ReviewAuthor } from "@/app/components/types";

type Tone = { color: string; bg: string; border: string };

const TONES: Record<string, Tone> = {
  parent: { color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  coach: { color: "#0f766e", bg: "#f0fdfa", border: "#99f6e4" },
  manager: { color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  director: { color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  attendee: { color: "#475569", bg: "#f1f5f9", border: "#e2e8f0" },
};

/** Normalize the Supabase join (object | array | null) to a single author. */
export function normalizeAuthor(
  author: ReviewAuthor | ReviewAuthor[] | null | undefined
): ReviewAuthor | null {
  if (!author) return null;
  return Array.isArray(author) ? author[0] ?? null : author;
}

/* Fallback for legacy / seeded reviews with no linked profile: derive the
   label + tone from the review's own `user_role` text (e.g. "Coach",
   "Team Manager", "Parent / Spectator"). Keeps the badge accurate without
   needing to invent a full profile row. */
function fromRoleText(text: string): { label: string; toneKey: keyof typeof TONES } | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("director"))
    return { label: "Event Director", toneKey: "director" };
  if (t.includes("coach")) return { label: "Coach", toneKey: "coach" };
  if (t.includes("manager")) return { label: "Team Manager", toneKey: "manager" };
  if (t.includes("parent") || t.includes("spectator"))
    return { label: "Parent / Spectator", toneKey: "parent" };
  return null;
}

export function deriveRoleBadge(
  author: ReviewAuthor | ReviewAuthor[] | null | undefined,
  fallbackText: string | null = null
): { label: string; toneKey: keyof typeof TONES } {
  const a = normalizeAuthor(author);
  if (!a) {
    if (fallbackText) {
      const fromText = fromRoleText(fallbackText);
      if (fromText) return fromText;
    }
    return { label: "Attendee", toneKey: "attendee" };
  }

  if (a.user_type === "event_director")
    return { label: "Event Director", toneKey: "director" };

  if (a.user_type === "attendee") {
    switch (a.attendee_type) {
      case "parent_spectator":
        return { label: "Parent / Spectator", toneKey: "parent" };
      case "coach":
        return { label: "Coach", toneKey: "coach" };
      case "team_manager":
        return { label: "Team Manager", toneKey: "manager" };
      default:
        return { label: "Attendee", toneKey: "attendee" };
    }
  }

  return { label: "Attendee", toneKey: "attendee" };
}

export function RoleBadge({
  author,
  fallbackText = null,
}: {
  author: ReviewAuthor | ReviewAuthor[] | null | undefined;
  fallbackText?: string | null;
}) {
  const { label, toneKey } = deriveRoleBadge(author, fallbackText);
  const tone = TONES[toneKey];
  return (
    <span
      className="font-heading relative inline-flex shrink-0 items-center gap-1.5 rounded-full uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".08em",
        color: tone.color,
        // gentle diagonal wash so the pill has depth against white cards
        background: `linear-gradient(135deg, ${tone.bg} 0%, #ffffff 100%)`,
        border: `1px solid ${tone.border}`,
        padding: "3px 9px 3px 7px",
        whiteSpace: "nowrap",
        // inset highlight top + soft-colored drop shadow — reads as "lifted"
        // pill rather than a flat chip
        boxShadow: `inset 0 1px 0 rgba(255,255,255,.7), 0 1px 3px ${tone.border}66`,
      }}
    >
      <RoleGlyph toneKey={toneKey} color={tone.color} />
      {label}
    </span>
  );
}

/* One glyph per role — sits inside the pill in the role's accent colour.
   Kept as 10-11px icons so the pill height doesn't grow. */
function RoleGlyph({
  toneKey,
  color,
}: {
  toneKey: keyof typeof TONES;
  color: string;
}) {
  if (toneKey === "coach") {
    // Whistle — universal coach signifier
    return (
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8.5 9a5.5 5.5 0 105.5 5.5V9H8.5z" />
        <path d="M14 11l7-2.5V6l-7 2.6" />
      </svg>
    );
  }
  if (toneKey === "manager") {
    // Clipboard — team manager
    return (
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="6" y="5" width="12" height="16" rx="2" />
        <path d="M9 3h6v4H9zM9 12h6M9 16h4" />
      </svg>
    );
  }
  if (toneKey === "director") {
    // Star badge — event director
    return (
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill={color}
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
      </svg>
    );
  }
  if (toneKey === "parent") {
    // Two figures — parent + child, a family silhouette
    return (
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="7" r="2.6" />
        <circle cx="16.5" cy="9" r="2" />
        <path d="M3 20c0-3 2.2-4.6 5-4.6s5 1.6 5 4.6" />
        <path d="M14 20c0-2.3 1.5-3.5 3-3.5s3 1.2 3 3.5" />
      </svg>
    );
  }
  // Attendee (generic) — single silhouette
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.2" />
      <path d="M4 20c0-3.6 3.6-5.6 8-5.6s8 2 8 5.6" />
    </svg>
  );
}

export function GuruBadge() {
  return (
    <span
      className="font-heading inline-flex shrink-0 items-center gap-1.5 rounded-full uppercase"
      style={{
        fontSize: 9.5,
        fontWeight: 800,
        letterSpacing: ".08em",
        color: "#fff",
        // saturated red gradient — Guru is the top tier, gets the strongest
        // visual weight of any badge on the review card
        background:
          "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
        border: "1px solid rgba(255,255,255,.28)",
        padding: "3px 9px 3px 7px",
        whiteSpace: "nowrap",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.25), 0 3px 8px -2px rgba(220,38,38,.4)",
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="var(--color-gold-bright)"
        stroke="var(--color-gold-bright)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L12 16.78l-5.2 2.72.99-5.78L3.58 9.62l5.82-.85L12 3.5z" />
      </svg>
      Guru
    </span>
  );
}
