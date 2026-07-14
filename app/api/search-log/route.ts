import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Fire-and-forget search logging. The hero form POSTs the submitted term here;
 * it's appended to `search_queries` and later aggregated by
 * get_popular_searches() into the "Popular" chips. Always returns 200 so a
 * logging failure never affects the user's search.
 *
 * Per-IP rate limit: 30 writes / 5 min. The DB also enforces a global
 * burst cap (migration 20260714100007) so a distributed flood still
 * can't blow past ~1k inserts/min.
 */
export async function POST(req: Request) {
  const gate = rateLimit(`search-log:${clientKey(req.headers)}`, 30, 300);
  if (!gate.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  try {
    const body = (await req.json()) as { term?: unknown };
    const term = typeof body.term === "string" ? body.term.trim() : "";
    if (term.length < 2 || term.length > 60) {
      return NextResponse.json({ ok: false });
    }
    const sb = createServerClient();
    await sb.from("search_queries").insert({ term });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
