import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Browser Supabase client — use inside Client Components.
 * Reads/writes the auth session from cookies so it stays in sync with the
 * server client and middleware. Used for client-side auth calls (e.g. sign
 * out).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
