import { NextResponse } from "next/server";
import { createAnonServerClient } from "@/lib/supabase/server";

/**
 * Best-effort search logging for the hero search box. Inserts the typed
 * term into `search_queries` (a `before insert` trigger rate-limits the
 * table at 1000/min, per the spec). Fire-and-forget from the client, so
 * any failure just drops the log — the response body is never read.
 */
export async function POST(request: Request) {
  try {
    const { term } = (await request.json()) as { term?: unknown };
    if (typeof term !== "string" || !term.trim()) {
      return NextResponse.json({ ok: false }, { status: 204 });
    }
    const supabase = createAnonServerClient();
    await supabase.from("search_queries").insert({ term: term.trim().slice(0, 120) });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 204 });
  }
}
