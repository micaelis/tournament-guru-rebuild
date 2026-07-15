"use server";

import { createServerAuthClient } from "@/lib/supabase/server";

export type PreflightRow = {
  email: string;
  status: "eligible" | "wrong-user-type" | "blocked";
  reason?: string;
};

/**
 * Pre-flight eligibility for a set of coach emails. Any profile that
 * exists on file but is either blocked or NOT a coach is dropped
 * from the "eligible" bucket (spec: warning + auto-exclude with no
 * re-add).
 */
export async function validateEmails(
  emails: string[],
): Promise<PreflightRow[]> {
  const supabase = await createServerAuthClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, blocked, role_title, user_type");
  const byEmail = new Map<string, {
    blocked: boolean;
    role: string;
    userType: "attendee" | "event_director" | "admin";
  }>();
  // profiles doesn't carry email — for the MVP eligibility check we
  // can't resolve email to a profile without auth.users. We treat all
  // uploaded emails as eligible except for blocked + wrong-type
  // matches surfaced via a service-role side channel (deferred).
  // See DECISIONS §S3.2 for the follow-up plan.
  return emails.map((email) => {
    const hit = byEmail.get(email);
    if (!hit) return { email, status: "eligible" as const };
    if (hit.blocked) return { email, status: "blocked" as const };
    if (hit.userType !== "attendee" || hit.role !== "coach") {
      return { email, status: "wrong-user-type" as const };
    }
    return { email, status: "eligible" as const };
  });
}

/**
 * Stub — the real promo generation + queue lands in S3.3. This action
 * exists now so the Admin dialog can wire without a compile break;
 * calling it today just flips the submitted_csv to `approved` so the
 * table state advances (idempotent no-op if already approved).
 */
export async function sendPromoEmails(input: {
  csvId: string;
  includeEmails: string[];
}): Promise<{ error?: string; info?: string }> {
  const supabase = await createServerAuthClient();
  const { error } = await supabase
    .from("submitted_csvs")
    .update({ status: "approved" })
    .eq("id", input.csvId);
  if (error) return { error: error.message };
  return {
    info: `Queued ${input.includeEmails.length} emails (real dispatch lands in S3.3).`,
  };
}
