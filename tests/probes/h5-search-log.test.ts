/**
 * H-5 probe — /api/search-log must never 500 on bad input, and must be
 * rate-limited at the app layer.
 *
 * The original bug: `NextResponse.json({...}, { status: 204 })` throws
 * (204 is a null-body status), and the catch re-executed the same
 * illegal construction — so any empty/malformed POST became an uncaught
 * 500. The route was also the only unauthenticated write endpoint with
 * no `rateLimit()` call, against the two-layer rule in CLAUDE.md.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { service } from "../harness";

vi.mock("@/lib/supabase/server", async () => {
  const { anon } = await import("../harness");
  return {
    createAnonServerClient: () => anon(),
  };
});

import { POST } from "@/app/api/search-log/route";

const marker = `h5-probe-${randomUUID().slice(0, 8)}`;
// Unique per-run client IP so the in-process rate bucket starts fresh.
const ip = (suffix: string) => `203.0.113.${suffix}`;
const runIpTag = randomUUID().slice(0, 6);

function post(body: string | null, forwardedFor: string): Promise<Response> {
  return POST(
    new Request("http://localhost/api/search-log", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": forwardedFor,
      },
      body,
    }),
  );
}

afterAll(async () => {
  await service().from("search_queries").delete().like("term", `${marker}%`);
});

describe("h5 · search-log handles bad input without a 500", () => {
  it("empty term resolves to a bodyless 204 (was: uncaught 500)", async () => {
    const res = await post(JSON.stringify({ term: "   " }), `${runIpTag}-a`);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("malformed JSON resolves to a bodyless 204 (was: uncaught 500)", async () => {
    const res = await post("this is not json", `${runIpTag}-b`);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("a valid term logs and returns ok", async () => {
    const res = await post(JSON.stringify({ term: marker }), `${runIpTag}-c`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const { data } = await service()
      .from("search_queries")
      .select("term")
      .eq("term", marker);
    expect(data?.length).toBe(1);
  });
});

describe("h5 · search-log is rate-limited at the app layer", () => {
  it("the 31st burst request from one IP gets a 429 with Retry-After", async () => {
    const attacker = ip("77") + `-${runIpTag}`;
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) {
      last = await post(JSON.stringify({ term: `${marker}-rl` }), attacker);
    }
    expect(last!.status).toBe(429);
    expect(last!.headers.get("Retry-After")).toMatch(/^\d+$/);
  });
});
