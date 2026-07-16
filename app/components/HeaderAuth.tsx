"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/app/(auth)/actions";
import { HeaderPill } from "./HeaderPill";

/**
 * Right-hand header slot that reflects auth state: a "Sign in" pill when logged
 * out, or the user's initial + "Log out" when signed in.
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
      <span
        className="inline-flex items-center justify-center rounded-full font-bold text-white"
        title={email}
        style={{
          width: 32,
          height: 32,
          fontSize: 13,
          background:
            "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-dark) 100%)",
        }}
      >
        {initial}
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-gray-50"
          style={{
            borderColor: "var(--color-border)",
            color: "var(--color-dark)",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          Log out
        </button>
      </form>
    </div>
  );
}
