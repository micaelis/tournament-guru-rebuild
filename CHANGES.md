# Tournament Guru — Refactor Changelog

Summary of everything landed during the 2026-07 audit-driven refactor. Sequenced against [AUDIT.md](AUDIT.md); each entry links to its commit.

**Verification** (final state):
- `npm run typecheck` — **passes** (0 errors)
- `npm run build`     — **passes** (all routes compile)
- `npm run lint`      — 4 errors + 4 warnings, all **pre-existing** setState-in-effect patterns (Header, EventSearchOverlay) and unused-var warnings I chose not to touch — see [Deliberately not done](#deliberately-not-done) below.
- `npm audit`         — **2 moderate**, both transitively via `next → postcss`, no non-breaking fix available (see [Remaining risks](#remaining-risks)).

Live database was **never reset or wiped**. Every fix went in as a new migration on top (files prefixed `20260714…`).

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

## Deliberately not done

Items I flagged in AUDIT.md but chose to leave, with the reason:

- **M3 — random shuffle in `getFeaturedEvents`.** Operator asked to keep the per-load random pick. Accept the CDN-caching cost for the "fresh 4 per page load" UX. The H7 no-op fix ensures the fallback path can't dupe premium rows into the mix.
- **M7 / M9 — raw `<img>` tags instead of `next/image`.** Photos come from unknown remote hosts (event directors paste any URL). Migrating would need either a wildcard `remotePatterns` (weakens SSRF hygiene) or per-image `unoptimized: true`. Flagged for a follow-up conversation with the operator on preferred image sourcing policy.
- **P4 — SearchMap fullscreen portal.** The fullscreen mode currently mounts a second Leaflet instance with duplicated tile requests. Portalling a single map node into a fullscreen container is a sizeable refactor with UI behavior implications (map center / zoom / active pin state coordination); left as a follow-up.
- **CSP (H9 next step).** The site renders several inline `<style>` blocks (`HeroSearch`, `EventsSearch::InfoTooltip`, `parts.tsx` grid override). A strict `Content-Security-Policy` requires nonces on all inline styles. Introducing that requires touching a handful of components in coordination with the CSP rollout — deferred.
- **Contact form modal focus trap.** Escape + body-scroll lock landed (H12). A full tab-cycle focus trap did NOT — Tab still escapes back into the underlying page. `next/dialog`-style trap would need a shared primitive; noted.
- **M5 — `attachHostLogos` / `attachReviewCounts` mutate in place.** Documented in comments; no functional bug today. Refactoring to a return-new-array shape would ripple through six call sites for a purity gain the codebase doesn't rely on.
- **M15 — dashboard sends full row set to admin.** Ships several hundred rows to the RSC payload per navigation. RLS gates the data (safe); performance is fine at current scale. Pagination is a Phase 5 concern.
- **L4 — centralize env-var validation.** Five `process.env.NEXT_PUBLIC_SUPABASE_URL!` non-null assertions remain. A `getEnv()` helper would validate + parse; not urgent.
- **L11 — unique constraint on `profiles.contact_email`.** Would need to reconcile any current duplicates first (data question for the operator).
- **L14 — `.mcp.json` / `.agents/` inventory.** Ripped through the top-level scan; no obvious leaks. Full audit deferred.
- **Pre-existing lint errors** — 4 `react-hooks/set-state-in-effect` errors and 4 unused-var warnings, all in code I didn't rewrite (`Header.tsx`, `EventSearchOverlay.tsx`, `ContactForm.tsx`, `EventsSearch.tsx`, and one dead-branch destructuring in the existing `contact-action.ts` deploy-order safety path). Fixing them requires the kind of `useEffect` rewrites that need behavioral verification I can't fully do without a preview.

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
4. **Rate limit is in-process, not distributed.** `lib/rate-limit.ts` state is per-Vercel-serverless-instance. A distributed attack across IPs will still eat DB write cycles; the DB-side burst cap (H5) is the ceiling. Move to Upstash / Vercel KV for true distributed limits.
5. **CSP header not shipped** (see H9). All other security headers are in place; if a stored XSS ever slips past the C4 URL allow-list or a new user-content surface bypasses `safeExternalUrl`, browsers won't have a CSP net to catch it.
6. **`SearchMap` doubles up on Leaflet in fullscreen (P4).** Twice the OSM tile fetch cost during fullscreen sessions. Deferred pending a portal refactor.
7. **Migrations not verified against a fresh local reset.** I couldn't `supabase db reset --local` from here. The migrations typecheck (via syntax), the schema.sql concatenates correctly, and the code compiles + typechecks; running `supabase db reset --local` on your machine before shipping is the last belt-and-braces check.

---

## Commit graph

29 commits. Ordered severity-first, then modernize, then cleanup, then docs.

```
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
