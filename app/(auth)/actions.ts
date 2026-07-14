"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerAuthClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  /** Non-error outcomes the UI switches on: "confirm" | "exists" | "reset-sent" | "password-updated" */
  code?: string;
  ok?: boolean;
  /** Echo the submitted email so success screens can show it. */
  email?: string;
};

/** Absolute site origin for email confirmation / reset redirect links. */
async function siteUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Only allow relative in-app redirect targets (block open redirects). */
function safeNext(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string") return null;
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return null;
}

/** Lightweight email shape check — good enough to catch obvious typos early. */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Minimum password requirements. Kept explicit so both signup and the
 * post-recovery updatePassword flow share the same rule set. If we ever
 * add a compromised-password check (HIBP k-anonymity API), plug it in
 * here too.
 */
const WEAK_PASSWORDS = new Set([
  "password", "password1", "password12", "password123",
  "12345678", "123456789", "1234567890",
  "qwerty123", "abc12345", "letmein123", "welcome123",
  "iloveyou1", "tournament", "guru12345",
]);

function validatePassword(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }
  if (password.length > 200) {
    return "Password must be under 200 characters.";
  }
  // Character-class diversity: require at least three of {lower, upper, digit, symbol}.
  const classes =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  if (classes < 3) {
    return "Password must include at least three of: lowercase, uppercase, digit, symbol.";
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return "That password is too common. Pick something less predictable.";
  }
  return null;
}

const NETWORK_MESSAGE =
  "Something went wrong on our end. Please try again in a moment.";

// The linked "Log in instead" is rendered by the signup form when code="exists".
const EXISTS_MESSAGE = "An account with this email already exists.";

/** True for transient fetch/connectivity failures (as opposed to bad input). */
function isNetworkError(error: {
  status?: number;
  name?: string;
  message?: string;
}): boolean {
  return (
    error.status === 0 ||
    error.status === undefined ||
    error.name === "AuthRetryableFetchError" ||
    /fetch failed|network|timeout|econn/i.test(error.message ?? "")
  );
}

/** Where to send a freshly-authenticated user: onboarding if not finished. */
async function destinationAfterAuth(
  supabase: Awaited<ReturnType<typeof createServerAuthClient>>,
  next: string | null,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.onboarding_complete) return "/onboarding";
  }
  return next ?? "/";
}

// ── Log in ────────────────────────────────────────────────────────────────
export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createServerAuthClient();

  let signInError: Awaited<
    ReturnType<typeof supabase.auth.signInWithPassword>
  >["error"];
  try {
    ({ error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    }));
  } catch {
    return { error: NETWORK_MESSAGE };
  }

  if (signInError) {
    if (isNetworkError(signInError)) {
      return { error: NETWORK_MESSAGE };
    }
    // Uniform response prevents account enumeration. Pre-migration
    // (Bubble) accounts and typo'd passwords receive the same message;
    // the "reset your password" copy in the login form covers both.
    return { error: "Incorrect email or password." };
  }

  const dest = await destinationAfterAuth(supabase, next);
  redirect(dest);
}

// ── Sign up ───────────────────────────────────────────────────────────────
export async function signup(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!isValidEmail(email)) {
    return { error: "Please enter a valid email address." };
  }
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const supabase = await createServerAuthClient();

  let data: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"];
  let error: Awaited<ReturnType<typeof supabase.auth.signUp>>["error"];
  const redirectUrl = `${await siteUrl()}/auth/callback?next=/onboarding`;
  try {
    ({ data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl },
    }));
  } catch (thrown) {
    console.error("[signup] threw before returning a Supabase error", {
      email,
      redirectUrl,
      thrown,
    });
    return { error: NETWORK_MESSAGE };
  }

  if (error) {
    // Always log the real Supabase error — the generic NETWORK_MESSAGE has
    // been masking things like "URL … is not a valid redirect URL" (Supabase
    // Auth "Redirect URLs" allow-list) or provider-config rejections.
    console.error("[signup] Supabase returned an error", {
      email,
      redirectUrl,
      code: error.code,
      status: error.status,
      name: error.name,
      message: error.message,
    });

    if (isNetworkError(error)) {
      return { error: NETWORK_MESSAGE };
    }
    if (/already|registered|exists/i.test(error.message)) {
      return { code: "exists", error: EXISTS_MESSAGE };
    }
    if (/invalid.*email|email.*invalid/i.test(error.message)) {
      return { error: "Please enter a valid email address." };
    }
    if (/at least|weak|password|characters/i.test(error.message)) {
      return { error: "Password must be at least 8 characters." };
    }
    if (/redirect.*url|url.*redirect|not.*allowed/i.test(error.message)) {
      return {
        error:
          `Sign-up rejected — the redirect URL isn't approved in Supabase Auth. Add "${redirectUrl}" to Authentication → URL Configuration → Redirect URLs.`,
      };
    }
    // Surface the raw Supabase message so we stop hiding useful information
    // behind "Something went wrong on our end."
    return {
      error: `Sign-up failed: ${error.message || "unknown error"}`,
    };
  }

  // With email confirmation on and an existing email, Supabase returns a user
  // with no identities and no session (anti-enumeration). Treat as "exists".
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { code: "exists", error: EXISTS_MESSAGE };
  }

  // Session present → confirmation is off, they're logged in → onboarding.
  if (data.session) {
    redirect(next ?? "/onboarding");
  }

  // Otherwise a confirmation email was sent.
  return { code: "confirm", ok: true, email };
}

// ── Request a password reset email ─────────────────────────────────────────
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!isValidEmail(email)) {
    return { error: "Please enter a valid email address." };
  }

  const supabase = await createServerAuthClient();
  try {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteUrl()}/auth/callback?next=/reset/update`,
    });
  } catch {
    // Swallow — we always return the same neutral success either way.
  }

  // Always neutral — never reveal whether an account exists.
  return { code: "reset-sent", ok: true, email };
}

// ── Set a new password (from the recovery link) ────────────────────────────
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirm) {
    return { error: "Passwords don’t match." };
  }

  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "Your reset link has expired. Request a new one and try again.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Couldn’t update your password. Please try again." };
  }

  const dest = await destinationAfterAuth(supabase, null);
  redirect(dest);
}

// ── Sign out ────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  const supabase = await createServerAuthClient();
  await supabase.auth.signOut();
  redirect("/");
}
