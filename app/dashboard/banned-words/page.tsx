import { requireSessionAndProfile } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { BannedWordsClient } from "./BannedWordsClient";

type BannedRow = { id: string; word: string; created_at: string };

/**
 * Admin-only CRUD over the banned-words list. Every review / comment
 * submit runs through this list on the server (see
 * lib/reviews/banned-words.ts). Adding a new word takes effect on the
 * next request — no cache to bust.
 */
export default async function BannedWordsPage() {
  const { profile } = await requireSessionAndProfile();
  if (profile.user_type !== "admin") redirect("/dashboard/events");

  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("banned_words")
    .select("id, word, created_at")
    .order("word", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[var(--font-heading)] text-3xl font-extrabold text-slate-900">
          Banned Words
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Reviews and comments containing any of these words are rejected at
          the API layer. Word-boundary matching is case-insensitive.
        </p>
      </div>
      <BannedWordsClient rows={(data ?? []) as BannedRow[]} />
    </div>
  );
}
