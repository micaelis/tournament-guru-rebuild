"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase/server";
import { generatePrettyCode, generatePromoToken } from "@/lib/promo/codes";
import { sendPromoEmailsInBatches } from "@/lib/promo/email";

export type PreflightRow = {
  email: string;
  status: "eligible" | "wrong-user-type" | "blocked";
  reason?: string;
};

/**
 * Pre-flight eligibility. We can't resolve email → profile without
 * auth.users.email (RLS blocks anon reads of that column). Until the
 * follow-up wires a service-role check (see DECISIONS §S3.2), every
 * uploaded email is treated as eligible. The email dispatch itself
 * re-runs the check against blocked flags at the promo insert layer
 * so a blocked user can't slip through.
 */
export async function validateEmails(
  emails: string[],
): Promise<PreflightRow[]> {
  return emails.map((email) => ({ email, status: "eligible" as const }));
}

/**
 * Generate promo codes for the eligible emails, then dispatch the
 * review invitation via SendGrid (log-stub when env vars unset).
 * Idempotent per (email, event_id) — the unique index
 * `promo_one_active_per_email_event` prevents duplicate active promos
 * when the admin Resends. Rejected + already-void rows never block
 * the reinsert path.
 */
export async function sendPromoEmails(input: {
  csvId: string;
  includeEmails: string[];
}): Promise<{ error?: string; info?: string }> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
  if (profile?.user_type !== "admin") {
    return { error: "Only admins can send promo emails." };
  }

  const { data: csv } = await supabase
    .from("submitted_csvs")
    .select("id, event_id, ed_id, raw_emails")
    .eq("id", input.csvId)
    .maybeSingle<{
      id: string;
      event_id: string;
      ed_id: string;
      raw_emails: string[];
    }>();
  if (!csv) return { error: "Submission not found." };
  const { data: event } = await supabase
    .from("events")
    .select("id, title")
    .eq("id", csv.event_id)
    .maybeSingle<{ id: string; title: string }>();
  if (!event) return { error: "Event no longer available." };

  const requested = new Set(input.includeEmails);
  const chosen = csv.raw_emails.filter((e) => requested.has(e));

  // Fetch existing non-void promos so Resend voids them + issues new
  // ones — spec: "In case the coach has received multiple promos for
  // the same event, the system should mark them all as Used when
  // applied to a review." The `apply_promo_to_review` RPC handles the
  // void-on-apply case; for Resend we don't touch already-applied
  // rows.
  const { data: existing } = await supabase
    .from("promo_codes")
    .select("id, email, status")
    .in("email", chosen)
    .eq("event_id", csv.event_id)
    .neq("status", "applied");
  const priorByEmail = new Map<string, { id: string; status: string }[]>();
  for (const row of (existing ?? []) as {
    id: string;
    email: string;
    status: string;
  }[]) {
    const list = priorByEmail.get(row.email) ?? [];
    list.push({ id: row.id, status: row.status });
    priorByEmail.set(row.email, list);
  }

  // Void any prior non-applied, non-void promos before we insert new
  // ones — keeps the unique partial index happy.
  const toVoid = Array.from(priorByEmail.values())
    .flat()
    .filter((r) => r.status !== "void")
    .map((r) => r.id);
  if (toVoid.length) {
    await supabase
      .from("promo_codes")
      .update({ status: "void" })
      .in("id", toVoid);
  }

  const inserts = chosen.map((email) => ({
    submitted_csv_id: csv.id,
    event_id: csv.event_id,
    email,
    pretty_code: generatePrettyCode(),
    url_token: generatePromoToken(),
    status: "sent" as const,
  }));

  if (inserts.length === 0) {
    return { error: "No emails to send." };
  }

  const { data: created, error } = await supabase
    .from("promo_codes")
    .insert(inserts)
    .select("id, email, url_token");
  if (error) return { error: error.message };

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const sendResult = await sendPromoEmailsInBatches(
    (created ?? []).map((c: { email: string; url_token: string }) => ({
      to: c.email,
      templateData: {
        event_title: event.title,
        link_url: `${origin}/promo/${c.url_token}`,
      },
    })),
  );

  await supabase
    .from("submitted_csvs")
    .update({ status: "approved" })
    .eq("id", csv.id);

  revalidatePath("/dashboard/promo-codes");

  const failedNote =
    sendResult.failed > 0 ? ` · ${sendResult.failed} failures logged.` : "";
  return {
    info: `Queued ${sendResult.sent} email${sendResult.sent === 1 ? "" : "s"}.${failedNote}`,
  };
}
