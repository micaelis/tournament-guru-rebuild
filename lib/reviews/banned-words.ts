import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server";
import { unwrapRows } from "@/lib/supabase/unwrap";

/**
 * Fetch the full banned-words list. The admin CRUDs this in
 * /dashboard/banned-words; every review + comment submit runs the
 * caller-supplied text through `matchesBannedWord` against this list.
 *
 * The list is small (dozens to low hundreds) and cache-friendly, so
 * we fetch it every call — no in-memory cache yet. Add one when the
 * list grows past ~500 entries or we see this on a hot path.
 *
 * unwrap: a query failure must throw — an empty list silently disables
 * the moderation filter for every submit until someone notices.
 */
export async function fetchBannedWords(): Promise<string[]> {
  const supabase = await createServerAuthClient();
  const rows = unwrapRows<{ word: string }>(
    await supabase.from("banned_words").select("word"),
    "fetchBannedWords",
  );
  return rows.map((r) => r.word);
}

/**
 * Word-boundary match — a banned "ass" hits the noun but not
 * "assemble" or "class". Case-insensitive; word chars only on either
 * side of the token. Returns every matching term so the UI can show
 * the user which words to remove (spec: "display those to the user
 * so they know what to amend").
 */
export function findBannedWords(text: string, list: string[]): string[] {
  if (!text || list.length === 0) return [];
  const hits: string[] = [];
  const lower = text.toLowerCase();
  for (const word of list) {
    const escaped = escapeRegex(word.toLowerCase());
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u");
    if (re.test(lower)) hits.push(word);
  }
  return Array.from(new Set(hits));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
