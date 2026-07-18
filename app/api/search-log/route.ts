import { NextResponse } from "next/server";
import { createAnonServerClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Best-effort search logging for the hero search box. Inserts the typed
 * term into `search_queries`. Fire-and-forget from the client, so any
 * failure just drops the log — the response body is never read.
 *
 * Gated at both layers per the public-write rule: per-IP burst cap
 * here, and the `before insert` rate-limit trigger on the table
 * (1000/min) as the DB backstop.
 */
export async function POST(request: Request) {
  const rl = rateLimit(`searchlog:${clientKey(request.headers)}`, 30, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  try {
    const { term } = (await request.json()) as { term?: unknown };
    if (typeof term !== "string" || !term.trim()) {
      // 204 requires a null body — NextResponse.json(..., {status: 204})
      // throws, and doing the same in the catch turned every malformed
      // POST into an uncaught 500.
      return new Response(null, { status: 204 });
    }
    const supabase = createAnonServerClient();
    await supabase.from("search_queries").insert({ term: term.trim().slice(0, 120) });
    return NextResponse.json({ ok: true });
  } catch {
    return new Response(null, { status: 204 });
  }
}
