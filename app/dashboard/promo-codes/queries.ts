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

export type PromoCoachRow = {
  id: string;
  submitted_csv_id: string;
  event_id: string;
  email: string;
  pretty_code: string;
  url_token: string | null;
  user_id: string | null;
  status: "staged" | "sent" | "active" | "applied" | "void";
  applied_at: string | null;
  created_at: string;
  event: {
    id: string;
    title: string;
    logo_url: string | null;
  } | null;
  submitted_csv: {
    id: string;
    ed_id: string;
  } | null;
  coach: {
    first_name: string | null;
    last_name: string | null;
    profile_photo_url: string | null;
  } | null;
};

/**
 * List promo codes with joined event + submitting ED + linked coach
 * for the ED/Admin tables. Optional scope by ED filters via the join
 * on submitted_csvs.ed_id — that lets the ED see only promos they
 * initiated without leaking cross-ED codes.
 */
export async function listPromoCodes({
  scope,
  edId,
  userId,
}: {
  scope: "own_ed" | "all" | "mine";
  edId?: string;
  userId?: string;
}): Promise<PromoCoachRow[]> {
  const supabase = await createServerAuthClient();
  const base = supabase
    .from("promo_codes")
    .select(
      "id, submitted_csv_id, event_id, email, pretty_code, url_token, user_id, status, applied_at, created_at, event:events!promo_codes_event_id_fkey(id, title, logo_url), submitted_csv:submitted_csvs!promo_codes_submitted_csv_id_fkey(id, ed_id), coach:profiles!promo_codes_user_id_fkey(first_name, last_name, profile_photo_url)",
    );
  let scoped = base;
  if (scope === "own_ed" && edId) {
    // Filter through the joined submitted_csv relationship.
    const { data: myCsvs } = await supabase
      .from("submitted_csvs")
      .select("id")
      .eq("ed_id", edId);
    const ids = ((myCsvs ?? []) as { id: string }[]).map((r) => r.id);
    if (ids.length === 0) return [];
    scoped = base.in("submitted_csv_id", ids);
  } else if (scope === "mine" && userId) {
    scoped = base.eq("user_id", userId);
  }
  const { data, error } = await scoped.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as PromoCoachRow[];
  return rows.filter((r) => r.status !== "void" && r.status !== "staged");
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
