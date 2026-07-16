/**
 * S8.1 — verifies platform_counters bumps on tournament + event
 * insert (M1). The counter is monotonic — delete never decrements
 * per SCHEMA-DESIGN §8 — so we only assert the delta post-create.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createUser, purge, seedTournamentAndEvent, service } from "../harness";

const users: string[] = [];
afterAll(() => purge(users));

async function readCounter(
  key: "listed_tournaments_total" | "listed_events_total",
): Promise<number> {
  const { data } = await service()
    .from("platform_counters")
    .select("value")
    .eq("key", key)
    .single();
  return Number(data!.value ?? 0);
}

describe("Platform counters — S8.1 (M1)", () => {
  it("creating a tournament + event bumps both counters by exactly 1", async () => {
    const ed = await createUser({
      metadata: { user_type: "event_director", role_title: "event_director" },
      completeOnboarding: true,
      role: "event_director",
    });
    users.push(ed.id);

    const beforeT = await readCounter("listed_tournaments_total");
    const beforeE = await readCounter("listed_events_total");

    await seedTournamentAndEvent(ed.client);

    const afterT = await readCounter("listed_tournaments_total");
    const afterE = await readCounter("listed_events_total");

    expect(afterT).toBe(beforeT + 1);
    expect(afterE).toBe(beforeE + 1);
  });
});
