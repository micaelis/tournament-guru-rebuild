import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Fire-and-forget search logging. The hero form POSTs the submitted term here;
 * it's appended to `search_queries` and later aggregated by
 * get_popular_searches() into the "Popular" chips. Always returns 200 so a
 * logging failure never affects the user's search.
 */
export async function POST(req: Request) {
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
