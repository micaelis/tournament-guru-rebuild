import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Landing point for email confirmation and password recovery links.
 * Exchanges the `code` for a session, then routes the user: unfinished
 * profiles go to onboarding, everyone else to `next` (or home).
 *
 * (Social sign-in was removed — no live user has ever used it — so this
 * route no longer receives OAuth callbacks, only email-based ones.)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  // Collect any cookies Supabase sets during the exchange onto this response,
  // then copy them onto the final redirect.
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
    return NextResponse.redirect(new URL("/login?error=callback", origin));
  }

  // Route by onboarding status — a fresh signup lands here right after
  // confirming their email and won't have finished it yet.
  let dest = next;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && next === "/") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.onboarding_complete) dest = "/onboarding";
  }

  const redirect = NextResponse.redirect(new URL(dest, origin));
  cookieResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}
