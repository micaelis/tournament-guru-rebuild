"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { validateEmail, validatePassword } from "@/lib/validation";
import { rolesFor, type UserTypeValue } from "@/lib/enums";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  info?: string;
};

/** login: email + password → session cookie. Blocked users are logged
 * out on the spot and shown the blocked-account message. */
export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  const fieldErrors: Record<string, string> = {};
  const emailErr = validateEmail(email);
  if (emailErr) fieldErrors.email = emailErr;
  if (!password) fieldErrors.password = "Password is required.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createServerAuthClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return { error: "Email or password is incorrect." };
  }

  // Blocked check — do this even before returning to the client so the
  // blocked user never even sees a landing page.
  const { data: profile } = await supabase
    .from("profiles")
    .select("blocked, onboarding_completed, user_type")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile?.blocked) {
    await supabase.auth.signOut();
    return { error: "blocked" };
  }

  const dest =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : profile?.onboarding_completed
        ? profile.user_type === "attendee"
          ? "/events"
          : "/dashboard/events"
        : "/onboarding";
  redirect(dest);
}

/** signup: email + password + chosen role. Writes user_type + role_title
 * into auth metadata so the handle_new_user trigger picks them up. */
export async function signupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const userType = String(formData.get("user_type") ?? "") as UserTypeValue;
  const roleTitle = String(formData.get("role_title") ?? "");

  const fieldErrors: Record<string, string> = {};
  const emailErr = validateEmail(email);
  if (emailErr) fieldErrors.email = emailErr;
  const pwErr = validatePassword(password);
  if (pwErr) fieldErrors.password = pwErr;
  if (userType !== "attendee" && userType !== "event_director") {
    fieldErrors.user_type = "Pick which side you're on to continue.";
  }
  const validRoles = new Set(
    rolesFor(userType as UserTypeValue).map((r) => r.value as string),
  );
  if (!validRoles.has(roleTitle)) {
    fieldErrors.role_title = "Pick a role to continue.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createServerAuthClient();
  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        user_type: userType,
        role_title: roleTitle,
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  // Local dev has email confirmation off (see supabase/config.toml), so
  // signUp returns a session and the client can go straight to onboarding.
  // Prod has confirmations on — the user sees a "check your email"
  // message instead.
  if (data.session) redirect("/onboarding");
  return { info: "Check your email to confirm your account." };
}

/** password reset: generic anti-enumeration message. Rate-limited at
 * the app layer (1/30s per IP) — the spec calls out the timer + server
 * cap explicitly. */
export async function requestResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const emailErr = validateEmail(email);
  if (emailErr) return { fieldErrors: { email: emailErr } };

  const hdrs = await headers();
  const rl = rateLimit(`reset:${clientKey(hdrs)}`, 1, 30);
  if (!rl.ok) {
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSec}s.`,
    };
  }

  const supabase = await createServerAuthClient();
  const origin =
    hdrs.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  // Fire-and-generic: we call resetPasswordForEmail regardless of whether
  // the address is on file, so the response is identical either way. This
  // is the anti-enumeration behaviour called out in SCHEMA-DESIGN §11.4.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset/update`,
  });

  return {
    info: "If an account exists for that email, we've sent reset instructions.",
  };
}

/** update password after clicking the email link. The user is signed
 * in via the callback exchange by the time they hit this action. */
export async function updatePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const pwErr = validatePassword(password);
  if (pwErr) return { fieldErrors: { password: pwErr } };

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/login?reset=success");
}

/** sign out — used by the auth-shared header widget and the blocked
 * modal's dismiss button. */
export async function signOutAction() {
  const supabase = await createServerAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
