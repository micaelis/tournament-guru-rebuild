import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Landing point for Supabase email links (confirmation + password reset +
 * email change). Exchanges the `code` for a session, then routes the user
 * by onboarding status and role — attendees go to /events, EDs/admins to
 * /dashboard.
 *
 * Email change (`next=/email-change`) is special: with secure email change
 * on, Supabase mails BOTH addresses and only the second click returns a
 * `code`. The first click lands here with just a "Confirmation link
 * accepted" message, an expired link with `error_*` params — every leg is
 * routed to the dedicated /email-change screen instead of leaking GoTrue's
 * raw message into a page URL.
 */
const EMAIL_CHANGE = "/email-change";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  if (!code) {
    if (next === EMAIL_CHANGE) {
      const failed =
        searchParams.has("error") ||
        searchParams.has("error_code") ||
        searchParams.has("error_description");
      return NextResponse.redirect(
        new URL(failed ? `${EMAIL_CHANGE}?stage=error` : `${EMAIL_CHANGE}?stage=partial`, origin),
      );
    }
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  // Collect Supabase's cookies onto this response, then copy them onto the
  // final redirect (Next requires cookies to travel with the response).
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

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    if (next === EMAIL_CHANGE) {
      // GoTrue applied the change BEFORE issuing the code — the exchange
      // only signs this browser in. A missing PKCE verifier just means
      // the link was opened outside the browser that requested the change
      // (phone mail app, other device); the screen's signed-out copy
      // covers that. Anything else is a genuinely bad/expired code.
      const dest =
        error.code === "pkce_code_verifier_not_found"
          ? EMAIL_CHANGE
          : `${EMAIL_CHANGE}?stage=error`;
      return NextResponse.redirect(new URL(dest, origin));
    }
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  let dest = next;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && next === "/") {
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
