"use server";

import { headers } from "next/headers";
import { createAnonServerClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Persist a "Contact host" submission from the public event page into
 * `contact_requests` with source='event_host_contact' and the event's
 * id + title snapshot. Rate-limited per-IP (5 / 10 min) on top of the
 * DB burst cap trigger.
 *
 * Anon-callable: no session required. The contact_requests table's
 * "contact: anyone submit" policy allows the insert.
 */

export type EventHostContactState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "message", string>>;
  values?: { name?: string; email?: string; message?: string };
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitEventHostContact(
  _prev: EventHostContactState,
  formData: FormData,
): Promise<EventHostContactState> {
  // Only event_id comes from the form; event_title is derived server-side
  // by looking up the event, so a tampered hidden field can't feed the
  // admin triage view an attacker-controlled string.
  const eventId = String(formData.get("event_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const values = { name, email, message };

  const fieldErrors: EventHostContactState["fieldErrors"] = {};
  if (!name) fieldErrors.name = "Please enter your name.";
  if (!email) fieldErrors.email = "Please enter your email.";
  else if (!EMAIL_RE.test(email))
    fieldErrors.email = "Please enter a valid email.";
  if (!message) fieldErrors.message = "Please write a message.";
  else if (message.length < 10)
    fieldErrors.message = "Message must be at least 10 characters.";
  else if (message.length > 4000)
    fieldErrors.message = "Message is too long (max 4000 characters).";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors,
      values,
    };
  }

  const h = await headers();
  const gate = rateLimit(`event-contact:${clientKey(h)}`, 5, 600);
  if (!gate.ok) {
    return {
      error: "Too many messages. Please try again in a few minutes.",
      values,
    };
  }

  try {
    const sb = createAnonServerClient();

    // Server-side event lookup — event_title in contact_requests is
    // whatever the DB says the title is right now. If the event id
    // doesn't resolve (deleted / bad uuid), event_title stays null and
    // the FK will pick it up on insert.
    let resolvedTitle: string | null = null;
    let resolvedEventId: string | null = null;
    if (eventId) {
      const { data: eventRow } = await sb
        .from("events")
        .select("id, title")
        .eq("id", eventId)
        .maybeSingle();
      if (eventRow) {
        resolvedEventId = eventRow.id as string;
        resolvedTitle = (eventRow.title as string) ?? null;
      }
    }

    const { error } = await sb.from("contact_requests").insert({
      full_name: name,
      email,
      additional_notes: message,
      source: "event_host_contact",
      event_id: resolvedEventId,
      event_title: resolvedTitle,
    });
    if (error) {
      console.error("[event_host_contact insert]", error);
      return {
        error: "We couldn't send your message just now. Please try again.",
        values,
      };
    }
    return { ok: true };
  } catch (e) {
    console.error("[event_host_contact insert] threw", e);
    return {
      error: "We couldn't send your message just now. Please try again.",
      values,
    };
  }
}
