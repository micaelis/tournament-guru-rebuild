"use server";

import { headers } from "next/headers";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  CONTACT_REQUIRED,
  type ContactField,
  type ContactSource,
  type ContactState,
} from "./contact-config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const REQUIRED_MSG: Record<ContactField, string> = {
  full_name: "Please enter your full name.",
  email: "Please enter your email address.",
  phone: "Please enter a phone number.",
  company_name: "Please enter your company name.",
  website: "Please enter your website.",
  additional_notes: "Please enter a message.",
};

export async function submitContactRequest(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();

  const source: ContactSource = "general";

  // Per-IP rate limit: 5 submissions / 10 min. DB trigger (migration
  // 20260714100007) enforces a global burst cap as second line.
  const h = await headers();
  const gate = rateLimit(`contact:${clientKey(h)}`, 5, 600);
  if (!gate.ok) {
    return {
      error: "Too many submissions. Please try again in a few minutes.",
    };
  }

  const values: Record<ContactField, string> = {
    full_name: get("full_name"),
    email: get("email"),
    phone: get("phone"),
    company_name: get("company_name"),
    website: get("website"),
    additional_notes: get("additional_notes"),
  };

  // ── Validate required fields (per source) ──
  const fieldErrors: Partial<Record<ContactField, string>> = {};
  for (const f of CONTACT_REQUIRED[source]) {
    if (!values[f]) fieldErrors[f] = REQUIRED_MSG[f];
  }
  if (values.email && !EMAIL_RE.test(values.email)) {
    fieldErrors.email = "Please enter a valid email address.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields.", fieldErrors, values };
  }

  // ── Confirm (no persistence) ──
  // The old `contact_requests` table was dropped in the rebuild, and
  // `support_messages` only accepts authenticated inserts (RLS:
  // auth.uid() is not null) — this is a PUBLIC form, so it can't write
  // there without a backend/RLS change. Per the demo scope we keep the
  // full validated form + success card but do not persist; wiring a
  // durable anon contact sink (SECURITY DEFINER RPC or a dedicated
  // public table) is a backend follow-up.
  void source;
  return { ok: true };
}
