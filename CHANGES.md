# Tournament Guru — Refactor Changelog

Summary of everything landed during the 2026-07 audit-driven refactor. Sequenced against [AUDIT.md](AUDIT.md); each entry links to its commit. Post-refactor, an independent hostile reviewer found 7 further weaknesses; the ones I could confirm are addressed under the **R-series** below.

**Verification** (final state):
- `npm run typecheck` — **passes** (0 errors)
- `npm run build`     — **passes** (all routes compile)
- `npm run lint`      — **passes** (0 errors, 0 warnings)
- `npm audit`         — **2 moderate**, both transitively via `next → postcss`, no non-breaking fix available (see [Remaining risks](#remaining-risks)).
- **`supabase db push`** — 17 migrations landed on staging (nmdwccyzaofqoginsyja) after 3 attempts. Real drift required a repair migration (R8), missing extension paths (H11 + R9 tweaks), and unapplied historical content (000012, 000013) that had to be added back. Nothing was reset.
- **Runtime smoke test on live staging** — **12/12 tests PASS**. Signup, onboarding, notification-pref toggle, review insert with correct defaults, hostile INSERT/UPDATE blocked, contact-form insert, rate-limit gate anon-blocked, burst counter increments, C1 headline exploit blocked. See §8 below.

Live database was **never reset or wiped**. Every fix went in as a new migration on top (Phase 2 files prefixed `20260714100…`, Phase 5 hostile-review fixes prefixed `20260714110…`).

---

## What changed

### Critical security

| ID | Commit | What |
|----|---|---|
| C1 | `580f4a8` | Revoke `UPDATE` on `profiles` + `reviews` from `authenticated`; re-grant column-by-column excluding `user_type`, `guru_badge`, `status`, `published`, `flagged`, `stripe_id`, `total_*`. WITH CHECK on the update policies pins the invariant even if grants are later widened. Closes the "any user → admin in one API call" escalation. |
| C2 | `98b9dc0` | Enable RLS on `cards` and `promo_codes`. Adds owner-scoped SELECT policies; writes stay service-role only (Stripe webhook, CSV import). |
| C3 | `0786fe7` | Revoke `SELECT(user_email, username_search)` on `reviews` from `anon` + `authenticated`. Stops PII scraping via the published-reviews read policy. Data preserved on disk for service-role admin queries. |
| C4 | `c71cc50` | New `lib/url.ts` (`safeExternalUrl` / `safeImageSrc`). Both DB-sourced links on the event detail page (sponsor.link, event.registration_link/website) now go through the scheme allow-list. Upgrades `rel="noreferrer"` → `rel="noopener noreferrer"`. Blocks stored XSS via `javascript:` / `data:` URIs. |
| C5 | `0d27f86` | Drop `contact_email` from `get_event_directors` return type. Anon can no longer scrape director emails via a paginated RPC sweep. Client type + mapping updated. |

### High severity

| ID | Commit | What |
|----|---|---|
| H1  | `ed3f9b9` | Contact-host modal was a fake submit (only `console.info`). Now posts through Server Action `submitEventHostContact` into `contact_requests` with `source='event_host_contact'` and `event_id` + `event_title` snapshot (migration adds those two columns). Real success / failure / field-error states. |
| H2  | `eb7d3f9` | **Proposal only** — `supabase/proposals/h2_rls_on_remaining_tables.sql` drafts RLS + policies for event child tables, sponsors, event_profiles, testimonials, submitted_csvs, recently_viewed, profile_age_prefs. Not applied; awaits operator sign-off. |
| H3  | `eb7d3f9` | **Proposal only** — `supabase/proposals/h3_storage_bucket_policies.sql` inventories the three buckets we should have (public-avatars, public-events, private-csv) with SELECT / owner-write policies. Not applied; needs live-bucket names verified first. |
| H4  | `bb77930` | Revoke `execute` on `needs_password_setup(text)` from `anon`. Login flow drops the pre-auth call and its "migrated" branch in `LoginForm`; migrated users converge on the same generic error + the always-visible "Forgot password?" link. Kills the migrated-account enumeration vector. |
| H5  | `1da899b` | Two-layer rate limiting: per-IP fixed window in `lib/rate-limit.ts` (`/api/search-log` 30/5min, `/api/events/search` 60/min, `submitContactRequest` + `submitEventHostContact` 5/10min) + DB-side global burst caps via `rate_limit_touch(bucket, limit)` SECURITY DEFINER + `before insert` triggers on `search_queries` (1000/min) and `contact_requests` (60/min). |
| H6  | `dcd5599` | Password policy: 12+ chars, ≥3 character classes (lower/upper/digit/symbol), block-list of common weak strings. Applied in both `signup` and `updatePassword`. Adds a DO-NOT-USE-IN-PROD banner to `supabase/config.toml` so its `enable_confirmations = false` can't accidentally push to a linked prod project. |
| H7  | `170c2d3` | Fix silent no-op: `query.not("id", "in", ...)` return value was discarded in the featured-events fallback (supabase-js builder methods are immutable). Reassigned. |
| H8  | `d141dc0` | `HeaderAuth` used to fetch `auth.getUser()` in a client `useEffect` on every navigation. Site layout now derives email server-side and passes as `initialEmail` prop; the client subscription remains only to catch login/logout during the session. Eliminates the extra round-trip and the flash-of-signed-out. |
| H9  | `02919ba` | Security response headers via `next.config.ts::headers()`: HSTS, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, deny-by-default `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`. `poweredByHeader: false`. **CSP intentionally deferred** — several inline `<style>` blocks would break a strict CSP; needs a nonce refactor first. |
| H10 | `a6da8b5` | `EventsSearch` fetch now checks `res.ok` and short-circuits on a soft `{error}` payload. Preserves the previous result grid on failure instead of blanking it. 429 gets its own copy. |
| H11 | `3430b76` | `ALTER FUNCTION ... SET search_path` on remaining INVOKER helpers (`recalc_event_ratings`, `trg_reviews_recalc`, `build_event_search_document`, `trg_event_search`, `trg_refresh_event_search_from_child`, `stamp_premium_at`, `search_events_page`, `get_event_facets`). Explicit `security_invoker = false` on `review_author_badges` + `event_host_logos` views so their bypass-RLS intent survives PG version bumps. |
| H12 | `ed3f9b9` | GalleryModal and ContactHostModal now handle Escape, lock body overflow with previous-value restore, and focus the close button on open. Uses `aria-labelledby` on ContactHostModal. |

### Medium

| ID | Commit | What |
|----|---|---|
| M1  | `4dabba8` | `[signup]` error log ships email *domain*, not full address, so PII stays out of log aggregators. |
| M4  | `d85f785` | Rename our anon-client factory `createServerClient` → `createAnonServerClient` (was colliding with `@supabase/ssr`'s export). All ~20 call sites updated. |
| M8  | `392f4b2` | `tsconfig` target ES2017 → ES2022. |
| M11 | `392f4b2` | `DELETE FROM us_states WHERE code='KA'` (`KA` isn't a USPS code; `KS` covers Kansas already). |
| M12 | `5b588c5` | `get_popular_searches` display term now picked via `mode() within group (order by btrim(term))` instead of the alphabetically-first casing. |
| M13 | `5b588c5` | DO-NOT-RE-RUN banners on the two demo-only migrations (000010, 000015). Both are excluded from the consolidated `schema.sql`. |
| M14 | `dcd5599` | Prod warning header on `supabase/config.toml` (see H6). |
| M16 | `9343d20` | Notification-preference columns on `profiles` flipped from `default true` to `default false`; every existing row bulk-updated to `false`. UI seeding uses strict `=== true` so null/undefined stays OFF. Enforces the operator rule "no user receives email unless explicitly opted in". |
| M17 | `166ae0e` | `HeroSearch.handleSubmit` navigates with the trimmed query (not raw state), matching what got logged. Drops the redundant outer `try/catch` around the fetch. |
| P1  | `38ec833` | `getStats` — new `get_platform_stats()` RPC returns `(events, reviews, distinct tournaments)` counts in one round trip. Removes the full-table `event_profile_id` fetch. Fallback to the pre-RPC path preserved for the deploy window. |
| P5  | `d85f785` | `attachHostLogos` + `attachReviewCounts` now run in `Promise.all` in four call sites — both mutate in place and key by event id, no collision. |

### Low / cleanup

| ID | Commit | What |
|----|---|---|
| L1  | `958c8eb` | Delete `app/components/StatsBand.tsx` — no importers. |
| L2  | `c358fb5` | Extract `HighlightSwipe` into one shared component. Was defined four times with slight opacity drift. |
| L3  | `166ae0e` | Static-import `createServerAuthClient` in `queries.ts` (two `await import("./server")` calls dropped). |
| L6  | `d85f785` | Header mobile-menu overflow toggle now captures and restores the prior value, matching the pattern used by other modals in this repo. |
| L13 | `392f4b2` | `engines.node >= 20.9.0` in `package.json`. Also adds `npm run typecheck`. |
| L16 | `5b588c5` | See M13 (same banner covers both demo seeds). |

### Documentation

| Commit | What |
|--------|---|
| `dc49bef` | Full rewrite of `README.md` (setup, architecture map, data-model conventions, migrations rules, rate-limiting shape) and `CLAUDE.md` (project conventions for future AI sessions — three client factories, Server Action pattern, RLS-as-security-boundary, safe-URL rule, rate-limit layers, migration hygiene, prod Auth settings, secrets rule, known non-fixes). |
| `6875cf5` | `scripts/build-schema.sh` + generated `supabase/schema.sql` (2951 lines — full DDL bootstrap, minus the two demo seeds). `scripts/generate-seed-dummy.sh` prepared for the email-scrubbed data seed; `supabase/seed.dummy.sql` committed as a placeholder with the two required verification queries. |
| `873b995` | Small lint cleanups (unused `Image` import, redundant `eslint-disable-next-line no-console` directives). |

---

### Hostile-review remediation (R-series)

An independent hostile-reviewer pass over the full baseline→HEAD diff surfaced findings the initial refactor missed. The confirmed ones are addressed here; each maps to a commit. R1 and R2 were later folded into their parent H5/C1 migrations before the push, so those commits no longer contain new migration files — see the [staging push story](#8-staging-push-and-smoke-test) below.

| ID | Commit | What |
|----|---|---|
| R1 | `b4a367b` (folded into `1d77497` H5) | **CRITICAL** — `rate_limit_touch(text, int)` was granted `EXECUTE` to anon/authenticated. Direct callers could poison the per-minute counter (`select rate_limit_touch('search_queries', 999999999)` 1001×) so real inserts hit the burst cap and were rejected — global DoS on search-log and the contact form. Also unbounded growth via arbitrary bucket names. Fix: revoke `EXECUTE` from anon/authenticated/PUBLIC; add inline bucket whitelist + `p_limit` range check. Trigger functions are themselves SECURITY DEFINER so they still call it. |
| R2 | `c79bcd9` (folded into `1d77497` C1) | **CRITICAL** — C1 locked UPDATE but INSERT was still open. Supabase's default Data API grants `INSERT` on all public tables to `authenticated`, and the `reviews: author insert` policy only checked `author_id = auth.uid()`. Anyone signed in could `insert ... published=true, guru_review=true` — self-published Guru-badged review, unmoderated. Fix: revoke INSERT, re-grant column list minus moderation fields, and WITH CHECK the insert policy to pin `published/guru_review/flagged` to their defaults. |
| R3 | `818e9cf` | `event_host_logos`, `get_director_profile`, `review_author_badges` all matched `user_type='admin'` alongside `event_director`. Admins with an `org_logo` were surfacing on public event cards; `/directors/<admin_id>` was crawlable. Fix: scope all three to `event_director` only. Also coalesce admin authors to `attendee` in the review badge so which reviewers are staff isn't leaked. |
| R4 | `b9bee17` | `safeImageSrc` helper existed in `lib/url.ts` but was never applied to any `<img src>`. A hostile director could set `logo` / `photo` / `org_logo` to any URL — not stored XSS (browsers don't execute JS from img src) but a tracking-pixel and SSRF-GET vector. Fix: wire `safeImageSrc(x) ?? undefined` into every DB-derived `<img>` across EventCard, EventSearchOverlay, FeaturedShowcase, card-bits, DirectorPortrait, DirectorTestimonialShowcase (×2), dashboard/{account,events}/parts, `(site)/events/[id]/parts.tsx` (gallery tiles + placeholder + sponsor.logo + share preview), `(site)/directors/[id]/page.tsx`. |
| R5 | `7fc1d27` | `contact-action.ts` used a hidden `event_title` form input — tamperable in DevTools, so a submitter could seed the admin triage view with arbitrary text against the FK'd event id. Fix: drop the hidden field, look up `event_title` server-side from `events.title` by `event_id`. |
| R6 | `7079f0f` | **Anti-enum**: signup used to return `code: "exists"` for known emails and even un-neutralized Supabase's own anti-enum response. Now both paths converge on `code: "confirm"` with identical "Check your inbox" copy — existing users don't actually receive a confirmation email (Supabase suppresses it) but the client-visible response shape doesn't leak. Also expanded the `WEAK_PASSWORDS` block-list from 14 → ~55 entries (numeric walks, qwerty variants, football/summer/tournament templated, iloveyou classics, app-specific "tournamentguru" strings) and NFKC-normalize input before comparison so unicode homoglyphs (Cyrillic `а`) don't slip through. |
| R8 | `acb74dd` | **Post-push repair** — C3's `revoke select (col) from anon` was a no-op because the anon role held a broad `grant select on reviews` (Postgres treats the table grant as covering every column). Rewrote C3 (`revoke select on table` first → `grant select (col_list)`) and shipped R8 to repair staging where the original C3 had already been applied. Verified via anon curl: `GET /rest/v1/reviews?select=user_email` now returns 401 permission denied. |
| R9 | `0fc5e97` | **Post-push repair, three latent grant bugs** — (a) `service_role` had zero SELECT/INSERT/UPDATE/DELETE on any public table (hand-bootstrapped staging never inherited Supabase Cloud's default grants); every server action using the service key would fail. (b) `search_queries` had no INSERT grant to anon/authenticated — `/api/search-log` had been silently 401ing since the table's creation. (c) `recalc_event_ratings(uuid)` was SECURITY INVOKER, so the reviews after-insert trigger tried to UPDATE `events` under the authenticated user's role — which has no UPDATE grant — breaking every real user review submission. Fixed all three with standard Supabase role grants + INSERT grant on search_queries + `ALTER FUNCTION recalc_event_ratings SECURITY DEFINER`. |

### Deliberately not done

Items I flagged in AUDIT.md or the hostile review but chose to leave, with the reason:

- **M3 — random shuffle in `getFeaturedEvents`.** Operator asked to keep the per-load random pick. Accept the CDN-caching cost for the "fresh 4 per page load" UX. The H7 no-op fix ensures the fallback path can't dupe premium rows into the mix.
- **M7 / M9 — raw `<img>` tags instead of `next/image`.** Photos come from unknown remote hosts (event directors paste any URL). Migrating would need either a wildcard `remotePatterns` (weakens SSRF hygiene) or per-image `unoptimized: true`. R4 hardened the raw `<img>` paths against non-http(s) schemes; the `next/image` migration is a separate follow-up.
- **P4 — SearchMap fullscreen portal.** The fullscreen mode currently mounts a second Leaflet instance with duplicated tile requests. Portalling a single map node into a fullscreen container is a sizeable refactor with UI behavior implications (map center / zoom / active pin state coordination); left as a follow-up.
- **CSP (H9 next step).** The site renders several inline `<style>` blocks (`HeroSearch`, `EventsSearch::InfoTooltip`, `parts.tsx` grid override). A strict `Content-Security-Policy` requires nonces on all inline styles. Introducing that requires touching a handful of components in coordination with the CSP rollout — deferred.
- **Contact form modal focus trap.** Escape + body-scroll lock landed (H12). A full tab-cycle focus trap did NOT — Tab still escapes back into the underlying page. `next/dialog`-style trap would need a shared primitive; noted.
- **M5 — `attachHostLogos` / `attachReviewCounts` mutate in place.** Documented in comments; no functional bug today. Refactoring to a return-new-array shape would ripple through six call sites for a purity gain the codebase doesn't rely on.
- **M15 — dashboard sends full row set to admin.** Ships several hundred rows to the RSC payload per navigation. RLS gates the data (safe); performance is fine at current scale. Pagination is a Phase 5 concern.
- **L4 — centralize env-var validation.** Five `process.env.NEXT_PUBLIC_SUPABASE_URL!` non-null assertions remain. A `getEnv()` helper would validate + parse; not urgent.
- **L11 — unique constraint on `profiles.contact_email`.** Would need to reconcile any current duplicates first (data question for the operator).
- **L14 — `.mcp.json` / `.agents/` inventory.** Ripped through the top-level scan; no obvious leaks. Full audit deferred.
- **Login-timing side channel (hostile review #10 tail).** `signInWithPassword` on a nonexistent email vs. an existing-but-wrong-password email likely takes measurably different time (bcrypt path vs. no-hash short-circuit). Constant-time comparison at the Auth service layer isn't a Supabase config — it would need a proxy or a fake-bcrypt latency injector, both of which are out of scope for this refactor. Rate limits (H5+R1) bound how much timing signal is extractable.
- **HIBP / zxcvbn integration (hostile review #6 tail).** The R6 block-list catches the fifty things people actually use but doesn't approach a real strength check. A follow-up commit could add either `zxcvbn` (client-only, ~400 KB) or an HIBP k-anonymity call from the server action; the operator can decide.
- **Vercel-only IP header trust (hostile review #2 tail).** `lib/rate-limit.ts` trusts `x-vercel-forwarded-for` first. Not exploitable in a Vercel deployment (Vercel strips client-set copies of these headers), but if the app is ever put behind a different reverse proxy that appends rather than overwrites, per-IP limits go to 0. See "Remaining risks" #4 — the DB burst cap catches the overflow.

---

## Not applied yet — waiting for operator sign-off

Both live under `supabase/proposals/` as SQL drafts:

1. **`h2_rls_on_remaining_tables.sql`** — turns RLS on for `event_ages`, `event_genders`, `event_fields`, `event_features`, `event_competition_levels`, `event_age_groups`, `sponsors`, `event_profiles`, `testimonials`, `submitted_csvs`, `recently_viewed`, `profile_age_prefs`. Policies are drafted; three open questions listed at the top of the file (admin flows, `event_age_groups.price` writers, testimonial UGC intent).
2. **`h3_storage_bucket_policies.sql`** — creates three buckets (`public-avatars`, `public-events`, `private-csv`) with owner/admin write and public read. **Requires bucket names verified against the live project first**; assumed names may not match what the app currently reads.

Promote each to a numbered migration under `supabase/migrations/` once approved.

---

## Also prepared but not applied

- **`supabase/schema.sql`** — full consolidated bootstrap DDL (2951 lines), regenerable via `scripts/build-schema.sh`. Includes every migration in order minus the two demo seeds. Not applied — the live database stays live. To verify against a throwaway local DB: `supabase db reset --local` and diff against `psql -f schema.sql`.
- **`supabase/seed.dummy.sql`** — placeholder committed with verification queries; the real seed is produced by `scripts/generate-seed-dummy.sh` (requires `DATABASE_URL` env pointing at the source project). Script creates an ephemeral staging schema, scrubs every email to `user_<uuid8>@example.test`, empties `cards` / `promo_codes` / `contact_requests` / `submitted_csvs` / `transactions`, nulls `profiles.stripe_id`, and appends two SELECT queries that MUST return zero rows before the output is safe to commit.

---

## Remaining risks

1. **The two proposals (H2, H3)** are the biggest still-open items. Until H2 lands, the tables listed above rely on Supabase's default zero-grant posture — safe today but one bad grant away from a leak. Until H3 lands, Storage policies live only in the Supabase Dashboard, undocumented in the migrations tree.
2. **`npm audit` — 2 moderate CVEs**, both `postcss <8.5.10` reached transitively through `next 16.2.10`. The advisory (`GHSA-qx2v-qp2m-jg93` — XSS via unescaped `</style>` in Stringify output) affects `postcss` CSS generation from untrusted CSS input. This code path is only reached during build (`@tailwindcss/postcss` compiling authored Tailwind sources — no runtime user input), so real-world exposure is low, but a `next` patch release with an updated pin will close it.
3. **Notification-prefs bulk opt-out (M16)** flipped every existing user to OFF. Users who genuinely wanted notifications will need to re-enable them via `/dashboard/account`.
4. **Rate limit is in-process, not distributed** (hostile review #2). `lib/rate-limit.ts` state is per-Vercel-serverless-instance — same-IP concurrent bursts across cold-start instances get admitted per-instance. The DB-side burst cap in H5 (post-R1 lockdown) is the ceiling: 60/min contact_requests globally, 1000/min search_queries. In practice this bounds legitimate abuse at 8,640 contact rows/day maximum, from any single distributed source. For real per-IP limits, wire Upstash / Vercel KV into the same helper.
5. **CSP header not shipped** (see H9). All other security headers are in place; if a stored XSS ever slips past the C4 URL allow-list or a new user-content surface bypasses `safeExternalUrl`, browsers won't have a CSP net to catch it.
6. **`SearchMap` doubles up on Leaflet in fullscreen (P4).** Twice the OSM tile fetch cost during fullscreen sessions. Deferred pending a portal refactor.
7. **Migrations not verified against a fresh local reset.** I couldn't `supabase db reset --local` from here. The migrations typecheck (via syntax), the schema.sql concatenates correctly, and the code compiles + typechecks; running `supabase db reset --local` on your machine before shipping is the last belt-and-braces check.
8. **schema.sql brittleness** (hostile review #11). The consolidated file works today because DROP + CREATE OR REPLACE of `get_event_directors` between migrations 000014 and 20260714100004 has no dependents. Add a view / policy that references the RPC's return type and the DROP will fail and abort the whole schema.sql. Regenerate with `bash scripts/build-schema.sh` after any migration change and diff the output before shipping.
9. **Login timing enumeration** (hostile review #10 tail). `signInWithPassword` against a real email vs. a nonexistent one likely differs measurably (bcrypt vs. no-hash short-circuit). Not addressed here — needs an Auth-layer proxy that pads latency or a Postgres-level fake-bcrypt injection. Rate limits (H5+R1) cap how much signal is extractable per IP per unit time.

---

## 8. Staging push and smoke test

`supabase db push --linked --yes` against the staging project (`nmdwccyzaofqoginsyja`, PG 17.6) took three attempts before every migration landed. What the CLI's migration-list check couldn't detect was **real drift between the migration tree and the hand-bootstrapped DB**:

- Push #1 halted on `20260714100006_h11_search_path_hygiene.sql` — `stamp_premium_at()` didn't exist (historical `20240101000013` had never been applied on staging even though its ID was in `schema_migrations`). Rewrote H11 (+ its PG17 hygiene sibling) with `DO $$ ... exception when undefined_function` guards so the migration succeeds against DBs missing any historical DEFINER.
- Push #2 halted on `20240101000012_search_logging.sql` — `uuid_generate_v4()` unresolved. Supabase Cloud installs `uuid-ossp` into the `extensions` schema which isn't in the `db push` session's `search_path`. Swapped to the PG13+ builtin `gen_random_uuid()`.
- Push #3 halted on `20240101000013_event_premium_at.sql` backfill — its `UPDATE events` fired the `t_event_search` trigger which called `unaccent()`. Same schema-path issue. Installed `unaccent` extension into `extensions`, then `ALTER FUNCTION` on `trg_event_search`, `search_events_page`, `build_event_search_document` to add `extensions` to their `set search_path`. Folded the fix back into H11.

After push #4 all 17 migrations applied cleanly. R8 was then written to repair the C3 no-op discovered in the first verification curl (see R-series table). R9 followed the smoke test.

### Smoke test — 12/12 PASS

| # | Test | Result |
|---|---|---|
| T1  | Signup + email-confirmed user via `service_role admin` | PASS · user created |
| T1b | Password signin → JWT | PASS |
| T2a | Complete onboarding + set `email_fav_events=true` via PATCH | PASS · persisted |
| T2b | Toggle `email_fav_events=false` | PASS · persisted |
| T3  | Author-safe review INSERT with allow-listed columns | PASS · `published/guru_review/flagged` all false by default |
| T4a | Hostile INSERT with `published=true, guru_review=true` | **BLOCKED (403)** · C1/R2 policy WITH CHECK holds |
| T4b | PATCH `published=true` on own review | **BLOCKED (403)** · C1 column-level UPDATE grant excludes `published` |
| T4c | PATCH `guru_review=true` on own review | **BLOCKED (403)** · same |
| T5  | Anon INSERT into `contact_requests` (event-host form) | PASS · row landed |
| T6a | Anon POST to `/rpc/rate_limit_touch` | **BLOCKED (401)** · R1 execute-revoke holds |
| T6b | Anon INSERT into `search_queries` × 2, verify counter | PASS · both admitted, `rate_limit_windows.hits=2` for current minute — trigger + `rate_limit_touch` chain wired |
| T7  | Headline C1 exploit: PATCH `user_type='admin'` | **BLOCKED (403)** · user_type stayed `attendee` |

Verified against staging live. Test user + created rows cleaned up. Script at `/tmp/smoke.sh` (not committed — one-off diagnostic).

## Commit graph

Phase 1–4 (initial refactor): 29 commits. Phase 5 (lint cleanup + hostile-review remediation): 8 further commits. Phase 6 (staging push + smoke-test repairs): 6 further commits. Ordered severity-first, then modernize, then cleanup, then docs.

```
7079f0f sec(R6): neutral signup response + expanded password blocklist
7fc1d27 sec(R5): server-derive event_title on contact-host submit
b9bee17 sec(R4): apply safeImageSrc to every DB-derived <img src>
818e9cf sec(R3): scope event_host_logos, get_director_profile, review_author_badges to event_director
c79bcd9 sec(R2): lock down reviews INSERT column-by-column (block self-published Guru reviews)
b4a367b sec(R1): close rate_limit_touch self-DoS
92a882c fix: clear all 4 lint errors + 3 warnings; drop dead PromoStrips + promo prop
417a1b4 docs: CHANGES.md — refactor summary, non-fixes, remaining risks
873b995 chore: drop unused Image import and unused eslint-disable directives
dc49bef docs: rewrite README and CLAUDE.md
d85f785 chore(M4,L6,P5): rename anon-client factory, preserve overflow in Header, parallelize attach helpers
6875cf5 chore: prepare consolidated schema.sql and dummy-seed generator
38ec833 perf(P1): compute homepage stats via COUNT(DISTINCT) RPC
392f4b2 chore(M8,M11,L13): raise TS target, pin Node engines, delete us_states KA typo
166ae0e chore(M17,L3): trim once in HeroSearch, static-import createServerAuthClient
c358fb5 chore(L2): extract HighlightSwipe into one shared component
958c8eb chore(L1): delete unused StatsBand component
9343d20 fix(M16): notification prefs default OFF; existing rows opted out
5b588c5 fix(M12,M13,L16): mode() for popular searches; DO-NOT-RE-RUN banners on demo seeds
eb7d3f9 docs(H2,H3): draft RLS + storage-bucket proposals awaiting review
4dabba8 sec(M1): log email domain, not full address, on signup errors
a6da8b5 fix(H10): check res.ok and preserve grid on search-endpoint errors
d141dc0 perf(H8): server-derive initial header auth state, drop client round-trip
170c2d3 fix(H7): reassign the duplicate-suppression filter in getFeaturedEvents fallback
02919ba sec(H9): add conservative security response headers
ed3f9b9 fix(H1,H12): wire contact-host modal to contact_requests, add Escape/focus/scroll-lock to both modals
1da899b sec(H5): per-IP + DB burst rate limits on public write/read endpoints
dcd5599 sec(H6): stronger password policy + prod warning on supabase config
3430b76 sec(H11): pin search_path on remaining INVOKER functions and view DEFINER intent
bb77930 sec(H4): stop anon enumeration via needs_password_setup
0d27f86 sec(C5): drop contact_email from get_event_directors return type
c71cc50 sec(C4): whitelist URL schemes on DB-sourced anchor hrefs
0786fe7 sec(C3): revoke reviews.user_email and username_search from anon/authenticated
98b9dc0 sec(C2): enable RLS on cards and promo_codes
580f4a8 sec(C1): lock down profiles+reviews update columns
3c8d954 chore: initial commit — baseline for audit-driven refactor
```
