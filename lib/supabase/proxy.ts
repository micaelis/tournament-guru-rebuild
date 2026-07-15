import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that require an authenticated, non-blocked session. */
const PROTECTED_PREFIXES = ["/onboarding", "/dashboard"];

/**
 * Refreshes the Supabase auth session on every request (rotating tokens
 * are written back onto the response), then enforces two hard gates:
 *
 * 1. Unauthenticated hits on protected routes redirect to /login with
 *    `?next=` so the post-login handler can send them where they wanted.
 * 2. Blocked accounts on any route are signed out and bounced to
 *    /login?error=blocked. Login page shows a modal for the blocked
 *    state; the spec calls out that the popup must fire immediately.
 *
 * Public pages stay open to everyone — logged-out and "skip signup"
 * visitors included.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() also refreshes the token; do it before any other logic.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    // Blocked check runs on every authenticated request. It's one extra
    // SELECT but hits the row via primary key + RLS-bypass column read
    // is cheap; the alternative (checking only on protected paths) lets
    // a blocked user browse the public site while signed in.
    const { data: profile } = await supabase
      .from("profiles")
      .select("blocked")
      .eq("id", user.id)
      .maybeSingle<{ blocked: boolean }>();

    if (profile?.blocked) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "blocked");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
