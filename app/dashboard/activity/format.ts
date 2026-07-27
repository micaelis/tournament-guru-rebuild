/**
 * Pure display helpers for the Activity timeline: title de-suffixing,
 * demographic chips, day bucketing, and the rail's time labels.
 */

export type Bucket = "today" | "yesterday" | "earlier";

/** "Spring Kickoff Cup — U12 Girls" → "Spring Kickoff Cup". Strips a
 *  trailing division marker (age bracket / gender / "Division") that the
 *  chips below the title now carry; any other dash suffix is part of the
 *  event's actual name and stays. */
export function deSuffixTitle(title: string): string {
  const m = /^(.+)\s+[—–-]\s+(.+)$/.exec(title.trim());
  if (!m) return title;
  return /\b(U\d{1,2}|Boys|Girls|Coed|Division)\b/i.test(m[2]) ? m[1] : title;
}

/** U-age index: "U9" → 9 so U9 sorts before U10. */
function ageIndex(v: string): number {
  const m = /^u(\d+)$/i.exec(v);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

/** Age-group + gender chip labels from an event's age-group rows —
 *  ["U10–U14", "Coed"]. Mirrors the search cards' collapse rules:
 *  multi-age → range, `both` or mixed genders → "Coed". */
export function demographicChips(
  groups: { age: string | null; team_gender: string | null }[] | null,
): string[] {
  const ages = Array.from(
    new Set(
      (groups ?? []).flatMap((g) => (g.age ? [g.age.toUpperCase()] : [])),
    ),
  ).sort((a, b) => ageIndex(a) - ageIndex(b));
  const ageLabel =
    ages.length > 1 ? `${ages[0]}–${ages[ages.length - 1]}` : ages[0] ?? null;

  const genders = new Set(
    (groups ?? []).flatMap((g) => (g.team_gender ? [g.team_gender] : [])),
  );
  const genderLabel =
    genders.size === 0
      ? null
      : genders.size > 1 || genders.has("both")
        ? "Coed"
        : genders.has("boys")
          ? "Boys"
          : "Girls";

  return [ageLabel, genderLabel].filter((c): c is string => c !== null);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function bucketOf(viewed: Date, now: Date): Bucket {
  const diff = startOfDay(now) - startOfDay(viewed);
  if (diff <= 0) return "today";
  if (diff <= 86_400_000) return "yesterday";
  return "earlier";
}

export const fmtDay = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** "2 hours ago" / "Yesterday" / "3 days ago" for the rail label. */
export function relativeLabel(viewed: Date, now: Date, bucket: Bucket): string {
  if (bucket === "yesterday") return "Yesterday";
  if (bucket === "earlier") {
    const days = Math.max(
      2,
      Math.round((startOfDay(now) - startOfDay(viewed)) / 86_400_000),
    );
    return `${days} days ago`;
  }
  const mins = Math.max(
    0,
    Math.floor((now.getTime() - viewed.getTime()) / 60_000),
  );
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}

/** The exact-time line under the relative label ("2:47 PM", or
 *  "Jul 24 · 5:18 PM" once the date isn't obvious from the checkpoint). */
export function exactLabel(viewed: Date, bucket: Bucket): string {
  return bucket === "earlier"
    ? `${fmtDate(viewed)} · ${fmtTime(viewed)}`
    : fmtTime(viewed);
}

/** Collapsed time line shown inside the card on small screens. */
export function mobileLabel(viewed: Date, now: Date, bucket: Bucket): string {
  if (bucket === "earlier")
    return `Viewed ${fmtDate(viewed)} · ${fmtTime(viewed)}`;
  if (bucket === "yesterday") return `Viewed yesterday · ${fmtTime(viewed)}`;
  const rel = relativeLabel(viewed, now, bucket);
  return `Viewed ${rel === "Just now" ? "just now" : rel} · ${fmtTime(viewed)}`;
}

/** Event-dates chip: "Jul 30 – Aug 1", or "Ended Jul 19" for past events. */
export function datesChip(
  start: string | null,
  end: string | null,
  now: Date,
): { label: string; ended: boolean } | null {
  if (!start) return null;
  const s = new Date(start);
  if (isNaN(s.getTime())) return null;
  const e = end ? new Date(end) : s;
  const last = isNaN(e.getTime()) ? s : e;
  if (last.getTime() < startOfDay(now)) {
    return { label: `Ended ${fmtDate(last)}`, ended: true };
  }
  if (s.getTime() === last.getTime())
    return { label: fmtDate(s), ended: false };
  const sameMonth =
    s.getMonth() === last.getMonth() && s.getFullYear() === last.getFullYear();
  return {
    label: sameMonth
      ? `${fmtDate(s)} – ${last.getDate()}`
      : `${fmtDate(s)} – ${fmtDate(last)}`,
    ended: false,
  };
}
