import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Handles Supabase email-template links that carry a token_hash directly
 * (e.g. {{ .SiteURL }}/auth/confirm?token_hash=xxx&type=email).
 * Verifies the OTP, establishes a session, then routes by onboarding status
 * — same destination logic as /auth/callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  let cookieResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookieResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let dest = "/onboarding";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, user_type")
      .eq("id", user.id)
      .maybeSingle();
    dest = profile?.onboarding_completed
      ? profile.user_type === "attendee"
        ? "/events"
        : "/dashboard/events"
      : "/onboarding";
  }

  const redirect = NextResponse.redirect(new URL(dest, origin));
  cookieResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}
