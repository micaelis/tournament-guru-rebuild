"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { MAX_CSV_ROWS, parseCsvEmails } from "@/lib/promo/csv";

export type CsvSubmitState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  submittedId?: string;
};

/**
 * ED submits a CSV — parses the caller-provided text (spec caps at
 * 1000 rows), validates that the chosen event is one of their own
 * premium events, and writes a submitted_csvs row with raw_emails
 * populated. The browser uploads the original file to the private
 * promo-csv bucket and passes its path (S10.4); raw_emails is still the
 * inline payload the admin queue renders without a bucket read.
 */
export async function submitCsv(
  _prev: CsvSubmitState,
  formData: FormData,
): Promise<CsvSubmitState> {
  const eventId = String(formData.get("event_id") ?? "");
  const csvText = String(formData.get("csv_text") ?? "");
  const fileName = String(formData.get("file_name") ?? "coach-list.csv");

  if (!eventId) return { fieldErrors: { event_id: "Pick a premium event." } };
  if (!csvText.trim()) return { fieldErrors: { csv_text: "Upload a CSV file." } };

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
    return { error: "Only event directors can submit CSVs." };
  }

  // Confirm the event is owned by this ED and premium (spec: "the
  // premium/targeted ads event they would like the coaches to leave
  // verified reviews on").
  const { data: event } = await supabase
    .from("events")
    .select("id, is_premium, owner_id")
    .eq("id", eventId)
    .maybeSingle<{ id: string; is_premium: boolean; owner_id: string | null }>();
  if (!event) return { error: "Event not found." };
  if (event.owner_id !== user.id) {
    return { error: "That event isn't in your account." };
  }
  if (!event.is_premium) {
    return {
      error: "Only premium events can accept promo CSV submissions.",
    };
  }

  const parsed = parseCsvEmails(csvText);
  if (parsed.rows.length === 0) {
    return {
      fieldErrors: {
        csv_text:
          parsed.errors[0] ??
          "We couldn't find any valid emails in that file.",
      },
    };
  }
  if (parsed.rows.length > MAX_CSV_ROWS) {
    return {
      fieldErrors: {
        csv_text: `That file has ${parsed.rows.length} rows — the max is ${MAX_CSV_ROWS}.`,
      },
    };
  }

  const emails = parsed.rows.map((r) => r.email);

  // The browser uploads the file to the private promo-csv bucket and
  // passes back its object path. Accept it only if it sits under the
  // caller's own <uid>/ folder — storage RLS already enforces that at
  // upload time, and this re-checks the stored string. Absent (older
  // client), fall back to a synthetic marker; raw_emails is the payload
  // either way.
  const uploadedPath = String(formData.get("file_path") ?? "").trim();
  if (uploadedPath && !uploadedPath.startsWith(`${user.id}/`)) {
    return { error: "That upload path isn't yours." };
  }
  const filePath =
    uploadedPath || `pending://${user.id}/${Date.now()}-${fileName}`;

  const { data, error } = await supabase
    .from("submitted_csvs")
    .insert({
      ed_id: user.id,
      event_id: eventId,
      file_path: filePath,
      raw_emails: emails,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/dashboard/promo-codes");
  return { submittedId: data.id };
}

/**
 * Admin rejects a pending submission with a reason (spec: reason is
 * shown to both admin + ED). The `raw_emails` list is cleared to
 * match the "delete csv rows, keep the master entry" rule.
 */
export async function rejectSubmittedCsv(
  csvId: string,
  reason: string,
): Promise<CsvSubmitState> {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { fieldErrors: { reason: "Provide a rejection reason." } };
  }
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
  if (profile?.user_type !== "admin") {
    return { error: "Admins only." };
  }
  const { error } = await supabase
    .from("submitted_csvs")
    .update({
      status: "rejected",
      rejection_reason: trimmed,
      raw_emails: [],
    })
    .eq("id", csvId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/promo-codes");
  return {};
}

/** ED cancels a pending submission. Only allowed while status is still `pending`. */
export async function cancelSubmittedCsv(
  csvId: string,
): Promise<CsvSubmitState> {
  const supabase = await createServerAuthClient();
  const { data: existing } = await supabase
    .from("submitted_csvs")
    .select("status, ed_id")
    .eq("id", csvId)
    .maybeSingle<{ status: string; ed_id: string }>();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!existing || existing.ed_id !== user.id) {
    return { error: "Submission not found." };
  }
  if (existing.status !== "pending") {
    return { error: "Only pending submissions can be canceled." };
  }
  const { error } = await supabase
    .from("submitted_csvs")
    .delete()
    .eq("id", csvId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/promo-codes");
  return {};
}

/**
 * Mint a short-lived signed URL for a submission's original CSV in the
 * private promo-csv bucket. Two layers of the same guarantee: the row
 * read is RLS-scoped to owner/admin (p_csv_read), and createSignedUrl
 * requires SELECT on the object (p_storage_csv_read, owner/admin). Anon
 * and non-owners get nothing. Returns null for legacy rows whose
 * file_path is the synthetic marker (no bucket object exists).
 */
export async function getCsvSignedUrl(
  csvId: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data: row } = await supabase
    .from("submitted_csvs")
    .select("file_path")
    .eq("id", csvId)
    .maybeSingle<{ file_path: string | null }>();
  if (!row?.file_path) return { error: "Submission not found." };
  // Synthetic markers (older rows) point at no real object.
  if (!row.file_path.includes("/") || row.file_path.startsWith("pending://")) {
    return { error: "No uploaded file for this submission." };
  }

  const { data, error } = await supabase.storage
    .from("promo-csv")
    .createSignedUrl(row.file_path, 60);
  if (error || !data) return { error: error?.message ?? "Could not sign URL." };
  return { url: data.signedUrl };
}
