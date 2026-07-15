import "server-only";
import { createServerAuthClient } from "@/lib/supabase/server";

export type ClaimRequestRow = {
  id: string;
  tournament_id: string;
  event_id: string | null;
  requester_id: string;
  status: "pending" | "approved" | "declined";
  phone: string;
  links: string[];
  message: string | null;
  decline_reason: string | null;
  created_at: string;
  event: {
    id: string;
    title: string;
    logo_url: string | null;
    location_state_abbr: string | null;
  } | null;
  tournament: { id: string; title: string } | null;
  requester: {
    first_name: string | null;
    last_name: string | null;
    organization_title: string | null;
    profile_photo_url: string | null;
  } | null;
};

const CLAIM_COLUMNS =
  "id, tournament_id, event_id, requester_id, status, phone, links, message, decline_reason, created_at, event:events!claim_requests_event_id_fkey(id, title, logo_url, location_state_abbr), tournament:tournaments!claim_requests_tournament_id_fkey(id, title), requester:profiles!claim_requests_requester_id_fkey(first_name, last_name, organization_title, profile_photo_url)";

/** Whether the current user already has a pending claim on this
 * event's tournament. Drives the "Requested" pill on the CTA. */
export async function hasPendingClaim(
  userId: string,
  tournamentId: string,
): Promise<boolean> {
  const supabase = await createServerAuthClient();
  const { data } = await supabase
    .from("claim_requests")
    .select("id")
    .eq("requester_id", userId)
    .eq("tournament_id", tournamentId)
    .eq("status", "pending")
    .maybeSingle();
  return Boolean(data);
}

/** Admin: every claim request. Order newest-first. */
export async function listAllClaimRequests(): Promise<ClaimRequestRow[]> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("claim_requests")
    .select(CLAIM_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ClaimRequestRow[];
}

/** ED: only their own claim requests. */
export async function listMyClaimRequests(
  userId: string,
): Promise<ClaimRequestRow[]> {
  const supabase = await createServerAuthClient();
  const { data, error } = await supabase
    .from("claim_requests")
    .select(CLAIM_COLUMNS)
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ClaimRequestRow[];
}
