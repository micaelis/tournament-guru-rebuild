"use server";

import { headers } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { sendSupportEmail } from "@/lib/email/support";

export type SupportState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  info?: string;
};

const SUPPORT_RECIPIENT =
  process.env.SUPPORT_EMAIL_TO ?? "support@tournamentguru.com";

/**
 * Support form submit. Writes to support_messages (RLS-gated) + fires
 * a SendGrid email to the operator's support inbox (stubbed to log
 * when SendGrid env is unset). Rate-limited at 3 submissions per
 * hour per IP.
 */
export async function submitSupportMessage(
  _prev: SupportState,
  formData: FormData,
): Promise<SupportState> {
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  const emailErr = validateEmail(email);
  if (emailErr) fieldErrors.email = emailErr;
  if (!name) fieldErrors.name = "Add your name.";
  if (!message) fieldErrors.message = "Describe your problem.";
  if (message.length > 2000) {
    fieldErrors.message = "Please keep the message under 2000 characters.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const hdrs = await headers();
  const rl = rateLimit(`support:${clientKey(hdrs)}`, 3, 60 * 60);
  if (!rl.ok) {
    return {
      error: `Too many messages. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.`,
    };
  }

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error: dbError } = await supabase.from("support_messages").insert({
    user_id: user?.id ?? null,
    name,
    email,
    message,
  });
  if (dbError) return { error: dbError.message };

  const send = await sendSupportEmail({
    to: SUPPORT_RECIPIENT,
    senderName: name,
    senderEmail: email,
    message,
  });
  if (!send.ok) {
    return {
      info: "Message received — email delivery is retrying. You'll hear back soon.",
    };
  }

  return {
    info: "Message sent — we'll follow up as soon as we can.",
  };
}
