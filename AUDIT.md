# Tournament Guru — Audit Report (Phase 1)

Read-only audit of the codebase at `/Users/danielatarus/Desktop/tournament-guru/`.
Scope: `app/`, `lib/`, `proxy.ts`, `next.config.ts`, `supabase/migrations/*.sql`, `supabase/seed.sql`, `supabase/config.toml`, root config files.

**Stack**: Next.js 16.2.10, React 19.2.4, TypeScript 5, Tailwind 4, Supabase (`@supabase/ssr` 0.12, `supabase-js` 2.110), Leaflet 1.9. Node types 20.

**How to read this**: findings are sorted by severity, then category. Each has a file:line reference and a one-line failure scenario. Nothing has been changed yet — this is the ask-for-approval document. Nothing in Phase 2 will run until you sign off.

---

## 1 — Architecture overview

- **Routing**: Next.js App Router with three route groups
  - `app/(site)/…` — public marketing + discovery (home, events search, event detail, directors, about, host, contact, premium)
  - `app/(auth)/…` — login / signup / password reset
  - `app/(onboarding)/…` — post-signup wizard, single Server Action `finishOnboarding`
  - `app/dashboard/…` — signed-in user dashboard (account, events manager, reviews)
- **Middleware**: `proxy.ts` → `lib/supabase/proxy.ts` — refreshes the Supabase session on every request, gates `/onboarding` and `/dashboard` for logged-out users
- **Server data**: `lib/supabase/queries.ts` (~1600 LOC) — all read queries, some server-side mutations. Two clients: `createServerAuthClient` (auth-aware, cookie session) and `createServerClient` (anon, for public reads)
- **Mutations**:
  - `app/(auth)/actions.ts` — login / signup / reset / update-password / signOut
  - `app/(onboarding)/actions.ts` — `finishOnboarding`
  - `app/dashboard/account/actions.ts` — `updateAccount`
  - `app/components/contact-action.ts` — `submitContactRequest`
- **APIs**:
  - `app/api/events/search/route.ts` — GET, typeahead + paged
  - `app/api/search-log/route.ts` — POST, fire-and-forget popular-search log
  - `app/auth/callback/route.ts` — GET, email-link exchange
- **Database**: 18 migrations bootstrapping schema, RLS, triggers, RPCs, and seed data. Discovery RPCs live in migrations 000007 (`search_events_page`), 000011 (`get_event_review_counts`), 000012 (`get_popular_searches`), 000014 (`get_event_directors`), 000016 (states facet), 000017 (`get_director_profile`).
- **Client-heavy pages**: `EventsSearch` and its Leaflet map (`next/dynamic`, no SSR), the event detail `parts.tsx` (single 3006-line file), a few marketing bands.

**Dependency map**:

```
proxy.ts ──▶ lib/supabase/proxy.ts ──▶ @supabase/ssr
                                          │
app/(auth)/actions.ts ──▶ lib/supabase/server.ts (auth client)
app/(onboarding)/actions.ts ──▶ lib/supabase/server.ts (auth client)
app/dashboard/**/*.ts ──▶ lib/supabase/server.ts (auth client)
                                          ▲
                                          │
app/(site)/**/page.tsx ──▶ lib/supabase/queries.ts (anon + auth)
app/api/**/route.ts ──────▶ lib/supabase/queries.ts
                              │
                              ▼
                       Supabase RPCs (see migrations)
                              │
                              ▼
                       Postgres tables under RLS
```

---

## 2 — Critical findings (fix before doing anything else)

### C1 — Privilege escalation: any user can self-promote to `admin`
**`supabase/migrations/20240101000001_base_schema.sql:534`**

```sql
create policy "profiles: self update" on profiles for update using (auth.uid() = id);
```

No `WITH CHECK`, no column allow-list. An authenticated user runs
`update profiles set user_type='admin' where id=auth.uid()` and the `is_admin()` helper at line 511 then returns true for them. Once admin, RLS on `events`, `notifications`, `flagged_content`, `reports`, `contact_requests`, etc. is bypassed.

The same shape repeats on **`reviews` (line 560)** — an author can flip their own review's `published`, `guru_review`, `flagged` columns to any value. That alone lets any user brand themselves a "Guru" and unpublish real critical reviews they wrote.

**Failure**: signup + one API call ⇒ site admin.

### C2 — RLS not enabled on `cards` and `promo_codes`
**`supabase/migrations/20240101000001_base_schema.sql:138` (cards)** and **`:403` (promo_codes)**.

Both tables contain sensitive data — Stripe card ids / last4 / brand / expiry on `cards`, secret redemption codes on `promo_codes` — but `alter table … enable row level security` is never issued. Supabase's default grants to `anon`/`authenticated` on `public` tables vary by project age and setup; if any future GRANT touches these, every user reads every other user's payment info.

**Failure**: a single misapplied grant leaks every payment method and every promo code in one query.

### C3 — Anonymous read of `reviews.user_email`
**`supabase/migrations/20240101000001_base_schema.sql:305` (column) + `:555` (policy)**

`user_email` is a stored column on reviews and the public-read policy `using (published = true …)` grants anon `SELECT` on the whole row. `username_search` (a search key) is similarly exposed and enables user enumeration by display name.

**Failure**: `select user_email from reviews where published` scrapes every reviewer's email — direct PII leak, GDPR/CCPA-shaped.

### C4 — Stored XSS via unvalidated user URLs in `<a href>`
**`app/(site)/events/[id]/parts.tsx:1896` (sponsor.link)**, **`:1978`+ (event.registration_link / this_year_website / website)**.

Values from the DB are rendered as `<a href={sponsor.link}>` with no scheme check. A hostile director (or admin insert) can set `link` to `javascript:fetch('/api/...', ...)` or a `data:text/html;base64,...`. `rel="noreferrer"` does not neutralize `javascript:` URIs.

**Failure**: hostile event owner sets `website = "javascript:..."` — one click executes attacker JS in the page's origin, with access to the visitor's Supabase session cookies.

### C5 — `get_event_directors` leaks director emails to anonymous visitors
**`supabase/migrations/20240101000014_event_directors_directory.sql:25/43/96` + grant `:109`**

RPC granted to `anon`, returns `contact_email` in the projection. The About Us page displays it, but anyone can call the RPC directly with a paginated sweep and harvest every director's email.

**Failure**: `curl … /rpc/get_event_directors?p_limit=1000` scrapes every event-director inbox for outbound spam / phishing.

---

## 3 — High findings

### H1 — Contact-host modal is a *fake* submit that silently drops user messages
**`app/(site)/events/[id]/parts.tsx:2395-2404`**

The "Send message" form's `onSubmit` only `console.info`s the payload and flips a local `sent` state. Users see "Message queued" copy but nothing is delivered — no fetch, no server action, no DB row.

**Failure**: parent contacts director about lodging, closes browser thinking it's sent, director never sees it. This is a shipped user-facing lie that has to be either wired up or removed.

### H2 — RLS not enabled on several event-related and user-related tables
**`supabase/migrations/20240101000001_base_schema.sql`** — `event_ages` (`:239`), `event_genders` (`:246`), `event_fields` (`:255`), `event_features` (`:263`), `event_competition_levels` (`:271`), `event_age_groups` (`:283`), `sponsors` (`:435`), `event_profiles` (`:162`), `testimonials` (`:492`), `submitted_csvs` (`:395`), `recently_viewed` (`:274`), `profile_age_prefs` (`:118`).

No `enable row level security`. Same reasoning as C2 — depends on grants staying tight forever, which is fragile. In particular `event_age_groups.price` is the pricing surface for the event detail page; if writable, any user can rewrite tournament prices.

### H3 — No storage bucket policies
No `storage.buckets`/`storage.objects` policies exist in any migration. `profiles.profile_picture`, `profiles.org_logo`, `events.logo`, `events.photos[]`, `sponsors.logo`, `testimonials.photo`, `submitted_csvs.file_path` all reference stored files. Buckets are either public (leak) or unusable. Whatever the current state is, it isn't versioned.

### H4 — Migrated-account email enumeration via `needs_password_setup`
**`supabase/migrations/20240101000003_auth_setup.sql:65-85`**

RPC granted to `anon`. Returns `true` iff the email belongs to a migrated (pre-cutover) account. An attacker iterating a wordlist can enumerate every migrated user, then combine with the password-reset flow to hijack accounts that haven't set a password yet.

**Failure**: attacker discovers 2,834 migrated emails, resets password on each, drains data of any that don't notice.

### H5 — No rate limiting on public endpoints
- `app/api/search-log/route.ts:10-23` — anon POST inserts to `search_queries` with no per-IP throttle. Also: `20240101000012_search_logging.sql:24-26` grants insert to anon with only a 2–60 char length check. Attacker can flood the table and pin arbitrary strings on the "Popular" chips (which appear on every homepage load).
- `app/components/contact-action.ts:22-101` — `contact_requests` insert is `with check (true)` (base schema `:598` + grant `20240101000004_advertiser_grants_and_faq_seed.sql:15`). No CAPTCHA, no throttle, no length caps → spam / DoS surface.
- `app/api/events/search/route.ts` — anon GET, no throttle. Every call hits an RPC or a `.ilike` over three columns.

Mitigation options (in order of increasing rigor): Vercel Edge Rate Limit, Cloudflare Turnstile on forms, a `search_queries_rate_limits` table with a `before insert` trigger.

### H6 — Anonymous signup enabled + no MFA + weak password policy
- **`supabase/config.toml:37,40`** — `enable_signup = true` under `[auth]` and `[auth.email]`.
- **`app/(auth)/actions.ts:141`** — server-side password minimum is 8 characters, no complexity, no HIBP compromised-password check.
- **`supabase/config.toml:42`** — `enable_confirmations = false`. Fine for local dev, but the file has no "not for prod" banner; a lazy `supabase link` in a hurry lets unverified signups slip through.

Combined with C1, the shortest path from the open internet to `is_admin() = true` is: signup with any email → one PATCH on `/rest/v1/profiles?id=eq.<uid>` with `{"user_type": "admin"}`. Under 30 seconds.

### H7 — Duplicate-suppression in `getFeaturedEvents` may be a silent no-op
**`lib/supabase/queries.ts:236-238`**

```ts
if (existingIds.length > 0) {
  query.not("id", "in", `(${existingIds.join(",")})`);   // ← return value discarded
}
```

`supabase-js` builder methods return the modified builder; the caller has to reassign for the filter to apply. As written, the fallback fetch can re-return premium events that already made the shortlist, which then get shuffled together and the total can silently dupe rows. Reassign or chain fluently.

### H8 — `HeaderAuth` fetches the auth user on every navigation, with no error handling
**`app/components/HeaderAuth.tsx:23-35`**

`supabase.auth.getUser().then(...)` — no `.catch`, no `AbortController`. Root layout ⇒ runs on every page nav ⇒ every mount → unmount cycle can produce a "setState on unmounted component" warning, and network failures spam the console.

**Better shape**: derive the email server-side in the root layout and pass it as a prop (that's already the pattern in `dashboard/layout.tsx`).

### H9 — Missing security headers
**`next.config.ts`** — no CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, or `poweredByHeader: false`. Any of the CSS-in-JS `<style>` tags this app renders inline would need a CSP nonce; if we add strict CSP later we have to touch those styles too.

### H10 — `EventsSearch` fetch does not check `res.ok`, silently replaces results with error payloads
**`app/components/events/EventsSearch.tsx:105-114`**

```ts
const json = await res.json();
if (json.error) setError(json.error);
setResults((json.events ?? []) as EventRow[]);
```

A 500 with a JSON body sets both `error` and clears `results`; the UI shows an error banner over a blank grid. A 200 with `{error, events: [...]}` replaces the grid with whatever the server sent. Should `throw` on `!res.ok` before parsing.

### H11 — Several SECURITY DEFINER RPCs / views lack `SET search_path`
Migrations 000006 (`review_author_badges`, `event_host_logos`), 000011, 000012, 000013, 000014, 000017. PG15+ recommends every `SECURITY DEFINER` function set `search_path = public, pg_temp` explicitly; without it, a hostile session `search_path` can shadow function names during execution and steal privileges. Verified by the SQL agent; individual line numbers in Phase 2.

Related view leaks flagged by the same pass:
- `event_host_logos` (000006) matches any `user_type`, so an admin's `org_logo` is exposed alongside real directors'. Should scope to `event_director` only.
- `get_director_profile` (000017:31) has the same over-match against `admin` rows.

### H12 — Modals lack Escape / focus trap / body scroll lock
**`app/(site)/events/[id]/parts.tsx:461-526` (GalleryModal)**, **`:2318-2473` (ContactHostModal)**. No `keydown` for Escape, no `useEffect` restoring `document.body.style.overflow`, no initial focus, no focus trap. The correct pattern exists elsewhere in the codebase (`EventSearchOverlay.tsx:266-273`, `FilterDrawer.tsx:44-57`) — copy it.

---

## 4 — Medium findings

### M1 — Signup logs the user's email on any error
**`app/(auth)/actions.ts:157,169-176`** — `console.error("[signup] …", { email, … })` sends PII to whatever aggregator ingests server logs. Should log the Supabase error code / status but redact email (or hash it).

### M2 — `getStats` fetches every non-draft event row just to compute a distinct count
**`lib/supabase/queries.ts:855`** — the third leg of `Promise.all` runs `select event_profile_id from events where status != 'draft'` and then does a `new Set(...)` in JS. Should be a `select count(distinct event_profile_id) …` in an RPC. As the events table grows this becomes an unbounded transfer on every homepage render.

### M3 — `getFeaturedEvents` uses `Math.random()` on the server
**`lib/supabase/queries.ts:212-213`** — shuffles the eligible premium pool per-request. Killing this makes the page fully cacheable at the CDN. If the "different picks per load" behavior is required product, that has to be reconciled with caching intent explicitly. Not a bug, but a design tension worth naming.

### M4 — Anon client `createServerClient` name-collides with `@supabase/ssr` export of the same name
**`lib/supabase/server.ts:41`** — `createServerClient()` is our anon-client factory; `@supabase/ssr` exports its own `createServerClient` (already used at `:18` and in `proxy.ts:16`). One import path away from a subtle bug.

### M5 — `attachHostLogos` / `attachReviewCounts` mutate the input array in-place
**`lib/supabase/queries.ts:439-441` and `:160-164`**. They both take `events`, mutate its rows, then return the same reference. Callers relying on immutability would be surprised. Not a bug today; is a footgun.

### M6 — Fallback search path can't compute `attachReviewCounts`
**`lib/supabase/queries.ts:719-772`** — the degraded fallback used when `search_events_page` isn't deployed does not attach per-type review counts and does not include `attachReviewCounts`. So cards under fallback render only the overall count while cards under RPC show a coach/attendee split. Minor UI drift but confusing during migrations.

### M7 — Raw `<img>` tags everywhere; `next/image` unused
**`app/(site)/events/[id]/parts.tsx:327, 394, 514, 1856, 2207`**; **`app/dashboard/events/parts.tsx:829`**; **`app/dashboard/account/parts.tsx:247`**; **`app/(site)/directors/[id]/page.tsx:191`**; **`app/components/EventSearchOverlay.tsx:141`**. No `srcset`, no size hints, no format negotiation. `next/image` with `unoptimized: true` per-image plus a URL scheme check would net a11y and perf without needing a remote-host allow-list.

### M8 — TypeScript target is `ES2017`
**`tsconfig.json:3`**. React 19 + Next 16 target modern runtimes. Modern async iterators, `RegExp.hasIndices`, `Array.at`, etc. either get down-leveled or are missing type hints. Raise to `ES2022` at minimum.

### M9 — `SearchMap` is mounted twice when fullscreen
**`app/components/events/EventsSearch.tsx:27, 387, 427`**. Two Leaflet instances means duplicated OSM tile network fetch and duplicated marker rebuild. Portal the single node or unmount the side map when fullscreen is open.

### M10 — Sponsor / event website links open new tabs but `rel` and `href` still need cleanup
Even after fixing C4, callers should use `rel="noopener noreferrer"` and `target="_blank"` consistently. Some sites use only `rel="noreferrer"`.

### M11 — `us_states` has bad postal code
**`supabase/migrations/20240101000002_schema_additions.sql:146`** — `('KA','Kansas')`. The real USPS code is `KS` (already present at `:138`). No real event matches `KA`, so this is dead data — but if state ever gets written as "KA" (say by a form typo), it falsely appears in the facet list.

### M12 — `search_queries` popular-term selection picks first-sorted casing rather than the mode
**`supabase/migrations/20240101000012_search_logging.sql:41`** — `array_agg(btrim(term) order by 1)[1]`. A single "SOCCER" logged early anchors the display as all-caps even if 500 users typed "soccer". Use `mode() within group (order by btrim(term))`.

### M13 — Migration 000010 (`refresh_event_dates_for_demo`) is not re-run-safe
**`supabase/migrations/20240101000010_refresh_event_dates_for_demo.sql:21-45`** — reorders by `created_at desc, id` and rewrites dates + status. New events between runs shift buckets and prior state is clobbered. Fine for a one-time demo prep, dangerous if it runs against a populated prod.

### M14 — `enable_confirmations = false` in checked-in supabase config
**`supabase/config.toml:42`**. See H6 for full context — treated separately here because the fix is documentation + guardrail, not code.

### M15 — Dashboard client components ship the full row set for admins
**`app/dashboard/events/parts.tsx:59-90`** and analogous in `reviews/parts.tsx`. RLS gates the data (safe), but each nav ships every event row into the RSC payload. Move filtering to a server-driven page component or paginate as data grows.

### M16 — `AccountEditor` initial-value trap on notification switches
**`app/dashboard/account/parts.tsx:552-660, 569-570`**. `useState(emailDefault !== false)` seeds from prop once; a `router.refresh()` won't re-sync. Also — an unchecked checkbox posts *nothing* in FormData, so `formData.get(name) === "on"` (in `updateAccount:36`) correctly treats absence as false — verified. But the null-coerces-to-true UI default combined with a first save means every existing null-preference user gets opted in on their first ever save. Might be intentional; if not, this is a subtle mass-opt-in.

### M17 — `HeroSearch` passes untrimmed value to `go` after trimming for logging
**`app/components/HeroSearch.tsx:117-122`**. Behaviorally correct (`go` trims internally) but the mismatch invites a future bug where empty-space submissions log but don't navigate the same way.

---

## 5 — Low findings

- **L1** — `app/components/StatsBand.tsx` has no importers (dead code; grep confirms only build-cache references). Delete.
- **L2** — `HighlightSwipe` is defined twice: `app/(site)/page.tsx:19-49` and `app/components/HeroSearch.tsx:423-453`. Extract.
- **L3** — Dynamic `await import("./server")` used at `lib/supabase/queries.ts:307,377` even though the module is statically imported at line 1. Convert.
- **L4** — Non-null assertions on env vars — `process.env.NEXT_PUBLIC_SUPABASE_URL!` used in five places without validation. Centralize with a validated `getEnv()` helper.
- **L5** — Inline `<style>{...}</style>` blocks in `HeroSearch.tsx:136`, `EventsSearch.tsx:656-669`, `parts.tsx:92-96`. Move to `globals.css`.
- **L6** — `Header.tsx:106` restores `document.body.style.overflow = ""` rather than the previously captured value. Fine unless another component set it first.
- **L7** — `README.md` is create-next-app default. `CLAUDE.md` is just `@AGENTS.md`. No `.env.example` (only `.env.staging.example`).
- **L8** — `us_states` typo (M11) is the only bad row; adjacent data is clean.
- **L9** — `SearchMap.tsx:105-132` — `useEffect` deps array `[pinnedKey]` is missing `onActiveChange`, `pinned`, `mapRef`. Lint-disabled; captures could stale under future refactor.
- **L10** — `comments` policy `using (true)` (`20240101000001_base_schema.sql:566`) — flagged comments remain publicly readable until deleted. Moderation-workflow decision.
- **L11** — `profiles` has no unique constraint on `contact_email` and `needs_password_setup` does `limit 1` on `lower(email) = lower(p_email)`. Duplicate handling is undefined.
- **L12** — `RoleBadge`, `SponsoredBanner`, `ManifestoBand`, `card-bits` — worth an importer grep before Phase 2 to confirm they aren't stragglers.
- **L13** — Node engine not pinned in `package.json`. `engines: { node: ">=20.9.0" }` would prevent accidental Node 18 runs (which no longer support Next 16 features).
- **L14** — `.gitignore` correctly excludes `.env*`. No secrets found in tracked files. `.mcp.json` and `.agents/` are checked in — verify they don't contain project-secret metadata.
- **L15** — `stamp_premium_at` and `recalc_event_ratings` triggers lack `set search_path` (INVOKER, so low risk — see H11 for DEFINER cousins).
- **L16** — `refresh_event_dates_for_demo` (M13) and `seed_bubble_recent_reviews` (000015:32-37) depend on brittle ordering. Fine for one-shot demo, don't run in prod.
- **L17** — `event_requests` has no UPDATE policy (`20240101000001_base_schema.sql:585-591`) — either intentional (server-side workflow) or missing. Document.

---

## 6 — Documentation gaps

- **`README.md`** is unmodified create-next-app boilerplate. No "what is this app", no local-dev setup, no env vars documented, no architecture overview, no data-model summary.
- **`CLAUDE.md`** consists of `@AGENTS.md` and nothing else. AGENTS.md just says "read Next.js 16 docs". Both should contain project conventions, DB layout, RPC list, and known gotchas (fallback paths on missing migrations, RLS traps, etc.).
- **No `.env.example`** at the repo root. Only `.env.staging.example` exists and it's staging-focused; a plain-language "these are the two vars you need" file is missing.
- Several migrations have terse comments that are wrong or stale (e.g. `get_event_directors` comment says "no emails" but the projection includes `contact_email`). Update alongside code fixes.
- No `CHANGELOG.md`, no `CONTRIBUTING.md` — reasonable for a small team, mentioning only for completeness.

---

## 7 — Modernization / idiom notes (Next 16 + React 19)

- Every server action file follows the `_prev, formData → state` pattern correctly. Good.
- `HeaderAuth` (H8) is the clearest violation of "prefer RSC over client fetch" and should be moved to a server-derived prop.
- `HomePage` awaits `getStats` + `getPopularSearches` at the top level (`app/(site)/page.tsx:54-57`). If either is ever slow, this blocks the whole route; consider a `Suspense` boundary around the hero the same way `FeaturedEventsSection` is already gated.
- `EventDetail` (`app/(site)/events/[id]/parts.tsx`) is a 3,000-line client component. Split by section (Gallery / KeyFacts / Reviews / Location / Sponsors / OtherEvents) into their own files with clearer boundaries. It's the largest file in the tree and hard to review as one blob.
- `tsconfig.json` `target: "ES2017"` (M8), `moduleResolution: "bundler"` (good). Consider `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Formatter: **no Prettier config**, no `.editorconfig`. ESLint runs but only via `next lint`. Adding Prettier + `eslint-config-prettier` would make style consistent (many files have hand-tuned whitespace and 100-column-plus lines).

---

## 8 — Performance summary

| # | Where | Nature |
|---|---|---|
| P1 | `getStats` (`queries.ts:855`) | Fetches all non-draft events per homepage load just for a distinct-count |
| P2 | `getFeaturedEvents` (`queries.ts:213`) | `Math.random` shuffle blocks CDN caching |
| P3 | `HeaderAuth` (`HeaderAuth.tsx:23`) | Extra auth round-trip per navigation |
| P4 | `EventsSearch` fullscreen (`EventsSearch.tsx:427`) | Second Leaflet map instance duplicates tile fetches |
| P5 | `getFeaturedEvents` (`queries.ts:214-247`) | Sequential `attachHostLogos` → `attachReviewCounts`; could `Promise.all` (already run after the main query) |
| P6 | `EventCard` / gallery `<img>` (M7) | No responsive `srcset`, no format negotiation |
| P7 | Dashboard rows (M15) | Serialize full row set into RSC payload |
| P8 | `refresh_event_dates_for_demo` (M13) | Full table sort per run |
| P9 | Search `.or()` builds (`queries.ts:527-533, 733-738`) | `ilike '%…%'` on 4 columns with no trigram index for the fallback path |

None of these are on-fire; P1 and P4 have the shortest ROI.

---

## 9 — Dependencies

- `next 16.2.10` — current
- `react 19.2.4`, `react-dom 19.2.4` — current
- `@supabase/ssr 0.12.x`, `@supabase/supabase-js 2.110.x` — current
- `leaflet 1.9.4` + `@types/leaflet 1.9.21` — current
- `react-simple-star-rating 5.1.7` — small package, verify last publish + downloads before Phase 2

Actual vulnerability listing will be produced in Phase 4 (`npm audit`).

---

## 10 — Proposed Phase 2 order

Per the hard rules — no external-behavior changes without flagging, no destructive delete without asking.

1. **Security patches, most severe first**
   1. C1 — WITH CHECK on `profiles: self update` and `reviews: author update`, column-scoped
   2. C2 — enable RLS on `cards`, `promo_codes`, plus policies
   3. C3 — drop `user_email` from `reviews` public projection (view or column policy alternative)
   4. C4 — URL scheme allow-list for all rendered `<a href>` from DB
   5. C5 — remove `contact_email` from `get_event_directors` projection
   6. H2 — enable RLS + policies on the remaining unprotected tables
   7. H3 — write storage policies (needs your input on bucket names / intended visibility)
   8. H4 — rate-limit or neutralize `needs_password_setup` enumeration
   9. H5 — rate-limit `/api/search-log`, `submitContactRequest`, `/api/events/search` (Vercel Edge Rate Limit or table-based counter)
   10. H6 — stronger password rules; add banner + guardrail on `enable_confirmations=false`
   11. H9 — security headers in `next.config.ts`
   12. H11 — `SET search_path` on every SECURITY DEFINER

2. **Correctness bugs**
   1. H1 — decide whether to wire or remove the contact-host modal (needs your call)
   2. H7 — fix the `.not("id","in",…)` no-op
   3. H8, H10, H12 — client-side correctness passes
   4. M1 — redact email in signup error log

3. **Modernize**
   1. M8 — `tsconfig` target + strictness
   2. Prettier + `eslint-config-prettier`
   3. Consolidate the two Supabase client factories, kill the dynamic `await import` (L3)
   4. `next/image` migration (M7) — case by case
   5. M4 — rename our anon-client factory to avoid ssr collision

4. **Performance**
   1. P1 — `count(distinct event_profile_id)` RPC
   2. P4 — portal-single Leaflet
   3. P3 — server-derive header user

5. **Cleanup**
   1. L1 — delete `StatsBand.tsx` (confirm no dashboard uses it)
   2. L2 — extract `HighlightSwipe`
   3. L5 — move inline `<style>` blocks
   4. L11 — `us_states` typo fix
   5. Prettier pass, ESLint fixes
   6. README + CLAUDE.md rewrite (Phase 3)

**Items that need your explicit go-ahead before I touch them** (I'll flag but not do without asking):
- **H1** — is the contact-host modal supposed to write to `event_requests`? Or should the modal be removed until you build the flow? Wiring it changes external behavior.
- **H2 / M13** — RLS on `event_ages`, `event_genders`, etc. Adding policies could break admin flows I haven't seen. I'll propose policies and wait for review.
- **M3** — `Math.random` in `getFeaturedEvents`. Keep the "fresh 4 per load" behavior (no CDN cache) or move to a stable daily rotation (fully cacheable)? Product decision.
- **M12** — changing the popular-searches picker changes user-visible display casing.
- **H4** — mitigations for `needs_password_setup` may involve renaming/removing the RPC. That would ripple to `app/(auth)/actions.ts:111`.
- **M16** — mass opt-in on first save. Confirm the default intent.

---

## 11 — Reproduction / verification notes for Phase 2

- Preview server is blocked (per project memory — Supabase websocket idles the preview). Verification for this repo goes through `npx tsc --noEmit` and `next build`, not the browser.
- SQL migrations are numbered `20240101000001` … `20240101000018`. Any Phase 2 SQL work will be added as new migration files (never edit historical ones), tested locally with `supabase db reset` where possible.
- Rate-limit choices depend on the Vercel plan / whether Cloudflare fronts the domain — I'll ask before wiring.

---

**Waiting for approval before starting Phase 2.**
