# Testing — coverage map

What's tested, at which layer, and where it lives. Update this doc whenever you add or
materially change coverage — it's the index the next session reads before writing tests.

## Two layers

- **Vitest RLS/logic probes** (`tests/probes/*.test.ts`) — DB-level authorization + invariants
  against a real local Supabase (schema + seed built from zero). These are the security floor:
  a Gate-1-class regression flips one red. Harness: `tests/harness.ts` (anon + service-role
  clients).
- **Playwright E2E** (`e2e/*.spec.ts`) — real browser click-through of user journeys. The
  Playwright webServer does its own production build/serve against the same local Supabase and
  seeds users via the service role.

Both run in CI (`.github/workflows/ci.yml`) against a fresh DB on every push to `rebuild`/`main`.

## Running

```
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest run — the RLS/logic probes
npm run e2e           # playwright test — the E2E specs
```

⚠ Never run `preview_start` on this repo — the Supabase websocket keeps the preview from
idling and the pane stays blank. Verify via typecheck + build + `npm test` + `npm run e2e`.

## Layer 1 — RLS / logic probes (`tests/probes/`)

| Probe | Guards |
|---|---|
| `c1-signup-privilege-escalation` | Anon can't self-signup as admin; `handle_new_user` coerces `user_type` to a safe value. |
| `schema-drift` | Replays every `.from().select()` in `app/`+`lib/` against the live DB with `limit(0)`; fails on 42703/42P01 so a renamed or dropped column can't ship behind a swallowed error (S8.6). |
| `h0-search-error-surfacing` | A facet sub-query failure inside `searchEvents` rejects instead of collapsing into a successful "0 events" result; invalid filter input (unknown enum values, malformed dates, hostile `q`) is dropped/tolerated rather than becoming a query error (S8.8). Runs the real `searchEvents` via the `@/` + `server-only` vitest aliases. |
| `error-surfacing` | The sibling class (S8.9): content reads (director profile/events/reviews, ED review scoping, banned-words list) REJECT on a query failure instead of rendering a plausible empty state; `getEventDirectors` returns the designed `source:"unavailable"` marker; landing chrome degrades but always logs. Real PostgREST errors via a table-rewriting proxy. |
| `flag-orphans` | No delete path leaves orphaned `flagged_content` / `content_hidden` rows: the AFTER DELETE triggers (20260718000009) purge both tables on review/comment deletes, including FK-cascaded comments and child replies; plus a whole-table orphan sweep (S8.10). |
| `h8-password-validation` | The account `updatePassword` action enforces the full password policy server-side — a weak password returns a field error and provably never reaches auth (sign-in proof); `updateProfile` rejects a malformed `business_email` before writing (S8.11). |
| `h5-search-log` | `/api/search-log` returns handled bodyless 204s for empty/malformed input instead of an uncaught 500 (the NextResponse-204 construction bug), persists valid terms, and 429s the 31st burst request per IP via the app-layer `rateLimit()` (S8.12). |
| `c2-definer-guards` | Destructive / definer RPCs reject non-owner, non-admin callers; trigger-only helpers aren't callable via PostgREST. |
| `c3-apply-promo` | `apply_promo_to_review` validates the full chain (attacker case, wrong-email case, legit path). |
| `c4-promo-flow` | Flagship flow: CSV → promo issued → anon lands → coach signs up (matching email) → claim → publish review → guru badge set. |
| `h1-public-views` | Public reviewer/host identity reads go through DEFINER views; no PII (last_name, email, DOB) leaks on a direct table read. Also asserts the views are **read-only**: anon and authenticated-non-owner cannot INSERT/UPDATE/DELETE through any of the four `public_*` views, and no write reaches `profiles` (S8.5). |
| `h2-onboarding-step3` | `preferences_completed` drives the wizard; an ED skipping the optional step advances cleanly. |
| `event-tier-escalation` | ED cannot self-upgrade `is_premium` / `is_general_ad` (column grant + RPC guard); admin CAN via `admin_set_premium` / `admin_set_general_ad`. |
| `rls-writes` | Write authorization across roles (who may insert/update/delete which rows). |
| `claim-flow` | Claim approve/decline ownership transfer + sibling auto-decline. |
| `validation` | Server-side input validation is authoritative; draft allows null dates; end ≥ start CHECK enforced at DB. |
| `platform-counters` | Counter invariants (published-reviews total increments, never decrements on delete). |
| `reauth-delete` | Account deletion / anonymize-and-scrub behavior. |
| `review-eligibility` | Attendee CAN write reviews; ED/admin/blocked CANNOT (RLS). Guru/verified blocked on non-paid events; succeeds on paid. |

## Layer 2 — E2E journeys (`e2e/`)

| Spec | Covers |
|---|---|
| `auth` | Login, signup (type→role), password reset, variant screens. |
| `onboarding` | The 3-step (attendee) / 4-step (ED) wizard + guards. |
| `discovery` | Public browsing: landing, search, event detail, director pages. Includes the host-avatar shape/fit assertion (Avatar primitive, S8.13). |
| `dashboard` | Role-based dashboard shells render (incl. the ED/Admin owned-tournament render guard). |
| `reviews` | Review display + submission flow. |
| `promo` | Promo landing + claim. |
| `mutations` | Profile edit, admin banned-word add, reaching the Add Event form. |
| `account-partial-save` | Admin saves their name with location/gender/org fields unrendered; those columns survive. Inverse case: a rendered-but-emptied field still clears (S8.7). |
| `favorites` | Favoriting an event (add/remove). |
| `a11y` | Accessibility checks (labeled controls, keyboard reachability). |

## Tournament CRUD coverage matrix

_Filled by the Tournament CRUD test task. Each role×operation cell links to the covering
spec/probe once written._

| Operation | ED-owner | ED-non-owner | Admin | Attendee | Anon |
|---|---|---|---|---|---|
| Create | | | | | |
| Read / list | | | | | |
| Update / edit | | | | | |
| Delete | | | | | |

## Conventions for adding tests

- **Authorization + invariants → a probe** (`tests/probes/`); **UI journeys → an E2E spec**
  (`e2e/`). Don't drive a security assertion through the browser when a probe is cleaner.
- Seed fixtures via the service-role harness; reuse the `@example.test` demo pattern; clean up
  what you create.
- Give E2E controls stable, accessible selectors. If a control lacks an accessible name, fix
  the a11y (labeled button) rather than selecting positionally.
- If a test surfaces a real bug, fix the **root cause** and leave a regression guard — never
  weaken the test or the security to make it pass.
- Prove stability: run a new E2E spec repeatedly (`--repeat-each`) so it's not flaky or
  order-dependent before committing.
- **Update this doc** when coverage changes: add the row/entry and, for a new flow, its matrix.
