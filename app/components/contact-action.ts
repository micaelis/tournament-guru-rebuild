"use server";

import { createServerClient } from "@/lib/supabase/server";
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

  // ── Insert ──
  const row = {
    full_name: values.full_name,
    email: values.email,
    phone: values.phone || null,
    company_name: values.company_name || null,
    website: values.website || null,
    additional_notes: values.additional_notes || null,
    source,
  };

  try {
    const sb = createServerClient();
    let { error } = await sb.from("contact_requests").insert(row);

    // Deploy-order safety: if the `source` column isn't there yet (migration
    // 20240101000005 not applied), retry without it so the form still works.
    // Postgres reports 42703; PostgREST reports PGRST204 from its schema cache.
    const missingSourceColumn =
      !!error &&
      /source/i.test(error.message) &&
      (error.code === "42703" ||
        error.code === "PGRST204" ||
        /does not exist|schema cache/i.test(error.message));
    if (missingSourceColumn) {
      console.warn(
        "[contact_requests] `source` column missing — apply migration 20240101000005_contact_source. Saving without source.",
      );
      const { source: _omit, ...withoutSource } = row;
      ({ error } = await sb.from("contact_requests").insert(withoutSource));
    }

    if (error) {
      console.error("[contact_requests insert]", error);
      return {
        error:
          "We couldn't submit your message just now. Please try again in a moment.",
        values,
      };
    }

    return { ok: true };
  } catch (e) {
    console.error("[contact_requests insert] threw", e);
    return {
      error:
        "We couldn't submit your message just now. Please try again in a moment.",
      values,
    };
  }
}
