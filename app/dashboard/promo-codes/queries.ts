import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server";

export type SubmittedCsvRow = {
  id: string;
  ed_id: string;
  event_id: string;
  file_path: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  raw_emails: string[];
  created_at: string;
  ed: {
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
    organization_title: string | null;
  } | null;
  event: {
    id: string;
    title: string;
    logo_url: string | null;
    is_premium: boolean;
  } | null;
};

const CSV_COLUMNS =
  "id, ed_id, event_id, file_path, status, rejection_reason, raw_emails, created_at, ed:profiles!submitted_csvs_ed_id_fkey(first_name, last_name, profile_photo_url, organization_title), event:events!submitted_csvs_event_id_fkey(id, title, logo_url, is_premium)";

/**
 * List CSV submissions. Scope='own' returns the ED's own; scope='all'
 * returns everything (admin). Ordered newest-first.
 */
export async function listSubmittedCsvs({
  userId,
  scope,
}: {
  userId: string;
  scope: "own" | "all";
}): Promise<SubmittedCsvRow[]> {
  const supabase = await createServerAuthClient();
  const base = supabase.from("submitted_csvs").select(CSV_COLUMNS);
  const scoped = scope === "own" ? base.eq("ed_id", userId) : base;
  const { data, error } = await scoped.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SubmittedCsvRow[];
}

/** ED's own premium events — used by the SubmitCsvForm's event picker. */
export async function listMyPremiumEvents(userId: string): Promise<
  { id: string; title: string; is_premium: boolean }[]
> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, is_premium")
    .eq("owner_id", userId)
    .eq("is_premium", true)
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; title: string; is_premium: boolean }[];
}
