"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/app/(auth)/actions";
import { HeaderPill, headerPillLook } from "./HeaderPill";

/**
 * Right-hand header slot that reflects auth state: a "Sign in" pill when logged
 * out, or the user's initial + "Log out" when signed in. The initial avatar
 * links to /dashboard, which roots each role to its landing tab — the
 * header's one entry point into the signed-in area.
 *
 * The initial value is derived server-side in the site layout and passed as
 * `initialEmail`, so there is no client-side auth round-trip on first render
 * and no flash of the wrong control. The client-side `onAuthStateChange`
 * subscription only keeps the header in sync after login/logout during the
 * current session.
 *
 * Logout uses the server action `signOut` (see `(auth)/actions.ts`) rather than
 * the browser client's `supabase.auth.signOut()` — the server action clears
 * the httpOnly session cookies on the response reliably, so a subsequent
 * signup on a different email starts from a truly clean session instead of
 * leaking the previous user's server-side context.
 */
export function HeaderAuth({ initialEmail }: { initialEmail: string | null }) {
  const [email, setEmail] = useState<string | null>(initialEmail);

  useEffect(() => {
    const supabase = createClient();
    // Read the current session once on mount: a navigation served right
    // after a server-action login can carry a header rendered before the
    // session cookie landed, so don't rely on the change subscription
    // alone. Only ever *adds* the email here — clearing stays with the
    // explicit SIGNED_OUT event below, so a client that can't read the
    // cookie can never blank a server-verified session.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!email) {
    return <HeaderPill href="/login">Sign in</HeaderPill>;
  }

  const initial = email.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3">
      <Link
        href={"/dashboard" as Route}
        aria-label="Your dashboard"
        title={`Your dashboard (${email})`}
        className="inline-flex items-center justify-center rounded-full font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
        style={{
          width: 32,
          height: 32,
          fontSize: 13,
          background:
            "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
        }}
      >
        {initial}
      </Link>
      <form action={signOutAction}>
        <LogOutButton />
      </form>
    </div>
  );
}

/** Same outline-pill look as the auth-header "Browse events" CTA. */
function LogOutButton() {
  const look = headerPillLook("outline", "sm");
  return (
    <button
      type="submit"
      className={`cursor-pointer ${look.className}`}
      style={look.style}
    >
      Log out
    </button>
  );
}
