/**
 * Seed-account sign-in probe — the demo accounts created by
 * supabase/seed.sql's raw `auth.users` insert must actually
 * authenticate.
 *
 * This exists because every other test creates its users through the
 * Auth admin API (harness `createUser`), which fills in GoTrue's
 * internals for free — so a defect in the seed's raw insert is
 * invisible to the rest of the suite. It shipped once: the seed left
 * GoTrue's eight token columns as NULL, the Go scanner rejects NULL
 * for those non-null string columns, and every seeded account 500'd
 * ("Database error querying schema") on signInWithPassword while
 * accounts created through the normal signup path worked (SEED.1).
 *
 * One account per seeded role. The identities assertion matters too:
 * GoTrue pairs each user with an auth.identities row, which the admin
 * API creates and a raw insert must remember.
 */
import { describe, expect, it } from "vitest";
import { anon } from "../harness";

const DEMO_PASSWORD = "demo-pass-123";

const ACCOUNTS = [
  { label: "attendee", email: "coach-ashley@example.test" },
  { label: "event director", email: "dir-amber@example.test" },
  { label: "admin", email: "admin@example.test" },
] as const;

describe("seed.sql demo accounts can sign in", () => {
  for (const { label, email } of ACCOUNTS) {
    it(`${label} (${email}) gets a session via the password grant`, async () => {
      const client = anon();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: DEMO_PASSWORD,
      });

      expect(error).toBeNull();
      expect(data.session?.access_token).toBeTruthy();
      expect(data.user?.email).toBe(email);

      const providers = (data.user?.identities ?? []).map(
        (i) => i.provider,
      );
      expect(providers).toContain("email");

      await client.auth.signOut();
    });
  }
});
