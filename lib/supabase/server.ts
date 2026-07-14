import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Auth-aware server client — use in Server Components, Route Handlers, and
 * Server Actions that need the logged-in user. Reads/writes the session from
 * cookies via getAll/setAll (the interface @supabase/ssr expects on Next 16,
 * where cookies() is async).
 *
 * The setAll try/catch is required: setting cookies is a no-op (and throws) when
 * called from a Server Component render, but middleware refreshes the session
 * there, so it's safe to swallow.
 */
export async function createServerAuthClient() {
  const cookieStore = await cookies();

  return createSSRServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware writes it.
          }
        },
      },
    },
  );
}

/** Public anon client for unauthenticated reads (events, reviews, stats). */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: {
      fetch: (input, init) => {
        // 4-second timeout so the page doesn't hang on RLS-blocked queries
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        return fetch(input, { ...init, signal: controller.signal }).finally(
          () => clearTimeout(timeout)
        );
      },
    },
  });
}
