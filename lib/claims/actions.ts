"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { safeExternalUrl } from "@/lib/url";

export type ClaimState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  claimId?: string;
};

/**
 * Submit a claim request for an event. Even though claim_requests is
 * tournament-level (per SCHEMA-DESIGN §7), the ED clicks Claim on a
 * specific event; we record which event they clicked and derive the
 * tournament so the admin panel can group by tournament.
 */
export async function submitClaimRequest(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const eventId = String(formData.get("event_id") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const linksRaw = String(formData.get("links") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  const links = linksRaw
    .split(/[\n,]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fieldErrors: Record<string, string> = {};
  if (!phone) fieldErrors.phone = "Add a phone number the admin can reach you at.";
  if (links.length === 0) {
    fieldErrors.links = "Add at least one link that shows your connection.";
  } else if (links.some((l) => safeExternalUrl(l) === null)) {
    fieldErrors.links = "One of those links doesn't look valid.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle<{ user_type: "attendee" | "event_director" | "admin" }>();
  if (profile?.user_type !== "event_director") {
    return { error: "Only event directors can claim events." };
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, tournament_id, owner_id")
    .eq("id", eventId)
    .maybeSingle<{ id: string; tournament_id: string; owner_id: string | null }>();
  if (!event) return { error: "Event not found." };
  if (event.owner_id) {
    return { error: "This event is already claimed." };
  }

  const { data, error } = await supabase
    .from("claim_requests")
    .insert({
      tournament_id: event.tournament_id,
      event_id: eventId,
      requester_id: user.id,
      phone,
      links,
      message: message || null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "You already have a pending claim on this tournament. Wait for the admin to review it.",
      };
    }
    return { error: error.message };
  }

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard/claim-requests");
  return { claimId: data.id };
}

/**
 * Admin approves the claim via the SECURITY DEFINER RPC. The RPC
 * flips ownership across the tournament + its events + auto-declines
 * sibling pending claims — all atomic.
 */
export async function approveClaimRequest(
  claimId: string,
): Promise<ClaimState> {
  const supabase = await createServerAuthClient();
  const { error } = await supabase.rpc("approve_claim_request", {
    target_claim: claimId,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/claim-requests");
  revalidatePath("/dashboard/events");
  return {};
}

/**
 * Admin declines the claim with a reason. Reason is displayed on
 * both admin + ED dashboards.
 */
export async function declineClaimRequest(
  claimId: string,
  reason: string,
): Promise<ClaimState> {
  if (!reason.trim())
    return { fieldErrors: { reason: "Reason is required." } };
  const supabase = await createServerAuthClient();
  const { error } = await supabase.rpc("decline_claim_request", {
    target_claim: claimId,
    reason,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/claim-requests");
  return {};
}
