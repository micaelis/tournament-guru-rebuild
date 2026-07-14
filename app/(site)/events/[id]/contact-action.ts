"use server";

import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
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
  const eventId = String(formData.get("event_id") ?? "").trim();
  const eventTitle = String(formData.get("event_title") ?? "").trim() || null;
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
    const sb = createServerClient();
    const { error } = await sb.from("contact_requests").insert({
      full_name: name,
      email,
      additional_notes: message,
      source: "event_host_contact",
      event_id: eventId || null,
      event_title: eventTitle,
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
