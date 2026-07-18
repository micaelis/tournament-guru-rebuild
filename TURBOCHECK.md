# Turbo Check — Tournament Guru rebuild

**Commit audited:** `5f4a460` (branch `rebuild`, = `origin/rebuild`)
**Scope:** whole-repo reliability / dead-code / consistency audit after the
2026-07-18 autonomous batch — 7 new `20260718*` migrations, review-eligibility
RLS, host business-contact fields, the FAQ system rewrite, dead-page removals,
and the table-grants fix.

**Baseline (verified at this commit):** `npm run typecheck` clean · `npm run
lint` 0 errors / 4 warnings · `npm run build` clean · `npm test` 75/75 ·
`npm run e2e` 51/51 · `supabase db reset` clean from zero.

**The baseline being green is the headline finding.** Two Critical defects —
one an unauthenticated RLS bypass, one a user-facing page that has been broken
since the FAQ commit — are invisible to every check in that list. Section
[H-1](#h-1) explains why the toolchain structurally cannot see them.

---

## Scorecard

| Dimension | Grade | Post-fix | One-line justification |
|---|---|---|---|
| Architectural coherence   | **B**  | **B**  | Unchanged — the `queries.ts` layer is still half-adopted and the DB boundary still untyped (the schema-drift probe covers the symptom, not the cause). |
| Systemic-fix discipline   | **D+** | **C**  | The three Criticals were each fixed at the root with a mutation-verified tripwire, and two same-class siblings went with them — but the other unfixed siblings (H-0, H-4, H-9) are still open. |
| Dead code & references    | **B**  | **B**  | Untouched by this round. |
| Runtime verification      | **C−** | **B−** | The write side of the security floor is now exercised (18 new view-write probes), plus 134 schema-drift checks and 2 e2e partial-save guards: 126 → 280 tests. `lib/url.ts`, `lib/rate-limit.ts` and `proxy.ts` remain unexercised. |
| Professional consistency  | **B−** | **B−** | Unchanged — `eslint.config.mjs` still has no `rules` block; nothing mechanically enforces client-factory or URL-sanitizer conventions. |

**Post-fix status of the three Criticals** — each verified by replaying
the original runtime exploit against a DB rebuilt from zero, not by a
green suite:

| ID | Commit | Verification |
|---|---|---|
| C-1 | `9da8c9a` | anon `PATCH`/`DELETE` on `public_directors` → `42501 permission denied` (was HTTP 204 + write landed). Base table intact, 10 profiles. |
| C-2 | `adfdd61` | Support FAQ query → HTTP 200, 5 rows. The old column list still reproduces `42703`. |
| C-3 | `e54140c` | Admin "save name" e2e keeps `Kansas City, MO` / `female` / `Platform Ops`; reverting the fix fails it with `Received: null`. |

Every tripwire was mutation-tested — the vulnerability or bug was
deliberately reintroduced and the new test observed to fail, then the fix
restored and the test observed to pass. That check exists because this
audit found a probe (H-3) that passed vacuously; a test that has never
been seen to fail proves nothing.

No dimension earns an A. The DB-side security floor is well built and the prior
audit's remediation was real — but the fix *discipline* in this batch is the
weak point, and it is what produced all three Criticals. The recurring shape:
a real bug is found, the instance in front of the author is fixed, and the
siblings — often in the same file, sometimes in the same function — are not.

---

## Findings

### Critical

<a name="c-1"></a>
**[C-1] Anonymous users can modify and delete event-director profiles — full RLS bypass.**
`supabase/migrations/20260718000005_fix_default_table_grants.sql:25`

- **Pattern class:** a blanket `GRANT ALL ON ALL <object type>` silently
  reversing deliberate narrow grants. **This is the same class as the function-grant
  regression fixed in `5f4a460`** — that fix removed the `FUNCTIONS` half and left
  the `TABLES` half, which is where the live hole is. The fix was itself a local patch.
- **Mechanism:** in Postgres, `ALL TABLES` **includes views**. `public_directors`
  and `public_event_owners` are single-table, auto-updatable views
  (`pg_relation_is_updatable` = 28), declared `security_invoker = false`, owned by
  `postgres` (which has `rolbypassrls`). Views carry no RLS of their own, so the
  table-level grant *is* the only access control on them. The baseline granted
  `select` only (`20260716000001_baseline.sql:1011`); this migration widened it to
  INSERT/UPDATE/DELETE for both `anon` and `authenticated`.
- **Failure scenario:** anyone holding the public anon key — which ships in every
  browser bundle by design — can rewrite or delete any event director's profile.
- **Proven, remotely, via the public REST API:**
  ```
  PATCH /rest/v1/public_directors?id=eq.<uuid>   apikey: <anon>
    → HTTP 204
  profiles.organization_title = REMOTE-ANON-WRITE-PROOF   ← landed in the base table
  ```
  And destructively (transactional, rolled back):
  ```
  SET LOCAL ROLE anon; DELETE FROM public_directors WHERE id=...;
    → DELETE 1 · profiles 10 → 9 · that director's 4 events left with owner_id NULL
  ```
- **Blast radius:** writable columns are `first_name`, `last_name`,
  `organization_title`, `org_description`, `org_logo_url`, `profile_photo_url`,
  and the `business_phone` / `business_email` / `business_website` fields added by
  this same batch — so an attacker can redirect a director's public contact details
  to a phishing address. DELETE cascades through `user_teams`, `favorites`,
  `claim_requests`, `submitted_csvs` and nulls `events.owner_id` /
  `tournaments.owner_id`. An authenticated attendee can equally modify another
  user's row this way.
- **Bounded:** neither view exposes `user_type`, `role_title`, or `blocked`, so
  there is **no privilege-escalation path**. INSERT is incidentally blocked by a
  not-null constraint. Only `event_director` rows are reachable. All 35 base
  tables have RLS enabled with ≥1 policy, so the blanket grant is backstopped
  everywhere *except* the views.
- **Status:** `000005` is in `origin/rebuild`. It becomes live in any environment
  that runs these migrations.
- **Fix location:** a new migration revoking INSERT/UPDATE/DELETE on all four
  `public_*` views from `anon, authenticated`, and narrowing `000005`'s grant to
  `relkind='r'` instead of `ALL TABLES`. Tripwire: extend
  `tests/probes/h1-public-views.test.ts` — which today asserts only SELECT
  behavior — with anon/authenticated **write**-denial assertions on all four views.

<a name="c-2"></a>
**[C-2] `/dashboard/support` queries two columns that no longer exist; the failure is swallowed.**
`app/dashboard/support/page.tsx:15`

- **Pattern class:** a Supabase query error discarded via `const { data } =`, so a
  failed query is indistinguishable from an empty result. **This is precisely the class
  commit `a7d954b` fixed for `searchEvents`** — the fix did not generalize.
- `20260718000007_faq_tables.sql:10,13` renamed `body`→`content` and dropped
  `audience`. This page still selects both.
- **Proven at runtime:**
  ```
  GET /rest/v1/faqs?select=id,title,body,audience
    → {"code":"42703","message":"column faqs.body does not exist"}
  ```
- **Failure scenario:** every attendee and every ED (`nav-items.ts:21,32`) sees a
  permanently empty "Frequently Asked" list reading *"We'll add answers here
  soon"* — which looks intentional, not broken. Live since `f694f4a`.
- Three factors hid it: the error is never destructured; line 22 casts with
  `as unknown as`, so `tsc` cannot see the mismatch; and the empty state is
  indistinguishable from success.
- Secondary: this query also lacks the `status='published'` / `is_visible=true`
  filter its three siblings have, so a naive column rename would have leaked drafts.
- **Fix location:** the page is arguably redundant now — `/dashboard/faq`
  (added by the same batch) sits directly above it in the same nav section and
  does this job properly. Recommend deleting the FAQ block from Support rather
  than porting the query. See M-3.

<a name="c-3"></a>
**[C-3] Saving the Account profile as an admin silently destroys their location and gender data.**
`app/dashboard/account/actions.ts:36-77` · `app/dashboard/account/AccountClient.tsx:193`

- **Pattern class:** the *inverse* of the C-2/F class — a Server Action reads fields
  **unconditionally** that the client renders **conditionally**, so an absent input
  becomes `"" → || null → NULL` and overwrites real data. Same family as the
  `fec083a` support-form fix ("field plumbed in UI but never persisted"), one
  direction over.
- `AccountClient.tsx:193` wraps `LocationAutocomplete`, the `user_gender` radios,
  **and** `organization_title` in `{!isAdmin && (…)}` — all inside the single
  profile `<form>` (lines 159–301). `updateProfile` reads all of them plus
  `...parseGeoFields(formData)`, which returns all-nulls when its hidden geo
  inputs weren't rendered (`lib/geo.ts:38`).
- **Failure scenario:** an admin corrects a typo in their last name and presses
  Save. `location_formatted`, all 7 `location_*` geo columns, and `user_gender`
  are silently set to NULL. No error, no warning — the action returns
  *"Profile updated."*
- **Proven against real seed data** (transactional, rolled back):
  ```
  BEFORE  loc=Kansas City, MO   gender=female
  AFTER   loc=NULL              gender=NULL
  ```
- Second instance, same class, currently inert: `updateNotificationPrefs`
  (`:242-267`) force-writes all 10 `NOTIF_FIELDS`, but `AccountClient.tsx:688`
  renders the two ED-only rows conditionally — an attendee saving prefs writes 4
  ED preferences to `false`.
- **Fix location:** build the update object from keys actually present in the
  FormData, or render the omitted fields as hidden inputs carrying their current
  values. Root-cause fix is a shared `parseForm(schema, formData)` so the field
  contract is one declaration rather than two stringly-typed copies.

### High

<a name="h-0"></a>
**[H-0] The `a7d954b` search fix is unreachable for the failure it was written to catch.**
`lib/events/search.ts:104,114,121,128,146` vs the guard at `:218`

- `searchEvents` runs **six** queries. The commit hardened the last one. The five
  facet subqueries above it use bare `const { data }`.
- **The failure routes around the guard:** a facet error → `data = null` →
  `dedupe(null)` → `[]` → `idSets` gets an empty set → `matchingIds = []` →
  `:200 query.eq("id", ZERO_UUID)` → the final query **succeeds** with 0 rows and
  `error === null` → the `throw` at `:218` never fires.
- **Failure scenario:** an RLS change or column rename on `event_age_groups` /
  `event_surfaces` / `event_competition_levels` makes every filtered search
  silently report "0 events found" — the exact bug class the fix was written to
  eliminate, still live in the same function.
- **Fix location:** a checked unwrapper in `lib/supabase/` used by all six, not a
  `throw` on the sixth.

<a name="h-1"></a>
**[H-1] The DB boundary is untyped, so schema drift is structurally invisible to `tsc`.**
Root cause of C-2; the reason the green baseline proves less than it appears to.

- No generated Supabase types exist anywhere in the repo — every `.from("table")`
  takes a plain string and every `.select("cols")` is an unchecked string literal.
- Compounded by **81** `as unknown as` / `as {` casts at the DB boundary.
- **Scale of the error-swallowing class: 155 query sites; 59 check `error`, 96 do
  not; 1 was fixed.** The worst concentrations are public read paths that fail
  open: `lib/directors/queries.ts` (**10 of 10** ignore it),
  `lib/events/search.ts` (6 of 7 — see H-0), `app/(site)/events/[id]/page.tsx`
  (3 of 3), and both new FAQ pages. `getDirectorProfile:26` is the most
  user-visible: a failure there makes a live director 404, and takes the entire
  host ContactPanel — this batch's own feature — silently off every event page.
- **Not instances (verified):** ~20 `const { data: profile }` reads that precede an
  authz check **fail closed** — an error yields no profile, which denies or
  redirects. Correct as written.
- I wrote a throwaway checker that parses every `.from().select()` pair and
  validates each column against the live schema. Repo-wide it found exactly the
  C-2 columns — so *stale-column* drift is currently 1 instance, but nothing
  prevents the next one.
- **Fix location:** `supabase gen types typescript` wired into a script + CI, plus
  a checked `unwrap()` helper and a lint rule banning bare `const { data } =` on
  Supabase calls. Either alone would have caught C-2 at commit time.

**[H-2] `/faq` is an orphan route — the FAQ feature shipped invisible.**
`app/components/Footer.tsx` · `app/(site)/faq/page.tsx`

- A **sequencing artifact between two commits in this batch**: `37f9d90` correctly
  removed the footer `/faq` link (the page was a ComingSoon stub at the time),
  then `f694f4a` rebuilt `/faq` as a real DB-backed page and never restored it.
- Zero links to `/faq` exist in app code. Its only repo reference is
  `e2e/discovery.spec.ts:46` — a test asserting a page no user can reach.
- `/directors` is orphaned the same way (Medium; its `[id]` detail route is
  well-linked, only the index is unreachable).

**[H-3] `tests/probes/c2-definer-guards.test.ts:196` contains a vacuous assertion — in the probe added last commit.**

- `trg_contact_requests_rate_limit` is in the `REVOKED_FUNCTIONS` list but was
  dropped in `20260716000014` (`pg_proc` count = 0). The `denied` regex accepts
  `/does not exist|could not find/`, so that entry can never fail regardless of grants.
- The header comment says "All 17"; only 16 exist.
- The regex cannot distinguish "EXECUTE revoked" from "function absent" or "name
  typo'd" — so the guard would not notice a function being renamed out from under it.
- The underlying property does hold: `has_function_privilege` is `false` for
  **anon and authenticated** on all 16 real functions (verified directly).
- **Fix location:** assert against `has_function_privilege` / `pg_proc` presence
  rather than inferring denial from an error string.

**[H-4] Orphaned flag rows — `6123664` covered 1 of 6 delete paths.**
`lib/reviews/actions.ts:244,466` · `app/dashboard/flagged/actions.ts:81`

- **Pattern class:** `flagged_content` and `content_hidden` are polymorphic
  (`content_type` + `content_id`), so no FK and no cascade is possible — app code
  *must* clean up. **6 delete paths; 1 partially fixed, 5 unfixed.**
- `lib/reviews/actions.ts:244` `deleteReview` — a reviewer hard-deleting their own
  review cleans **nothing**: not the review's flags, not its cascade-deleted
  comments' flags, not `content_hidden`. Strictly worse than the admin path that
  *was* fixed, and reachable by any end user.
- `lib/reviews/actions.ts:466` `deleteComment` — no cleanup, and child replies
  cascade via `parent_comment_id` with their flags left behind.
- `app/dashboard/flagged/actions.ts:81` — **the fixed function's own other branch.**
  The `contentType === 'review'` path recurses to comments; the `'comment'` path
  doesn't recurse to child replies. The fix reasoned one level down and stopped,
  in the same function, in the same commit.
- Also unfixed: `lib/reviews/actions.ts:422` (owner-reply replacement), and
  `content_hidden` is never cleaned by any content-delete path.
- **Why it matters concretely:** `app/dashboard/flagged/page.tsx:26` lists
  `flagged_content`, then joins to reviews/comments by `content_id`. An orphaned
  flag returns from the first query, matches nothing in the second, and is
  therefore **never rendered and never dismissable** — a permanent invisible row
  no admin action can clear.
- Verified clean by contrast: **every one of the 52 FKs has an explicit delete
  action; none are `NO ACTION`.** `faq_audiences` and `event_milestones` both
  cascade correctly. The orphan risk is confined to the two polymorphic tables.
- **Fix location: the DB, not the app.** Either give these tables real nullable
  `review_id`/`comment_id` FKs with cascades, or add `after delete` triggers on
  `reviews` and `comments`. Patching per-call-site is exactly how this ended up
  covering 1 of 6.

**[H-9] Four `useActionState` forms don't reset on success — including one holding a plaintext password.**

- **Pattern class:** a one-shot create/send form that leaves inputs populated
  after success, inviting silent double-submits. `dbe61b1` fixed SignupForm.
  **24 forms; 1 fixed, 4 unfixed.**
- `app/dashboard/account/AccountClient.tsx:361-368` — after a successful password
  change, **the new plaintext password remains in the DOM input and in React
  state** (captured by `useSubmittedValues`). The signup commit's own message
  cites "clearing controlled state (password)"; this sibling was missed.
- `app/dashboard/support/SupportForm.tsx:55` — and fix `fec083a` in this same
  batch is what made this form actually *send*, so the message now delivers **and**
  sits in the textarea inviting a resend.
- `app/dashboard/banned-words/BannedWordsClient.tsx:63` — re-submitting hits the
  unique constraint and surfaces a raw DB error string.
- `app/components/reviews/CommentForm.tsx:83` — top-level box never clears.
- **The fix shipped a mechanism and wired it nowhere:** `useSubmittedValues.ts:31`
  gained a `reset()` in that commit with **zero callers** — SignupForm used the
  `key=` remount idiom instead. Dead export.
- Correct reference idioms already exist: `FaqsClient.tsx:62,78` (`formEpoch` +
  `key=`) and `SubmitCsvForm.tsx:31`.

**[H-5] `/api/search-log` throws on its own error path, and skips the app-layer rate limit.**
`app/api/search-log/route.ts:14,20`

- `NextResponse.json({ok:false}, {status:204})` — 204 is a null-body status.
  Verified empirically against this repo's `next`:
  `TypeError: Response constructor: Invalid response status code 204`.
- Line 14 throws → the `catch` at 19 re-executes the *same* illegal construction →
  uncaught → 500. Any empty/malformed `term` POST 500s.
- No user impact (the sole caller fire-and-forgets with `.catch(() => {})`), but it
  is pure log pollution masking real errors.
- Separately: this is the only unauthenticated **write** endpoint with no
  `rateLimit()` call, against CLAUDE.md's explicit "gate it at both layers" rule.
  The other three public write paths all call it.

**[H-6] A full-text-search pipeline is maintained on every write and queried by nothing.**

- `events.search_document` + `search_vector`, two GIN indexes,
  `build_event_search_document()`, and trigger `t_events_search` all recompute on
  every event insert/update.
- Repo-wide grep for `search_vector|search_document|textSearch|plfts|websearch`
  across `app/ lib/ tests/ e2e/`: **zero hits.** Actual search is `ILIKE`
  (`lib/events/search.ts:188`).
- Pure write amplification plus index bloat on the hottest table.

**[H-7] `rate_limit_prune()` has no caller — `rate_limit_windows` grows unbounded.**

- Defined at `baseline.sql:710`. Its only other references are the RG1 revoke and
  the c2 test asserting it is *not* callable. No `.rpc()` caller, no trigger; `pg_cron`
  is not installed.
- Since `rate_limit_touch` writes a row per (bucket, minute) on every public
  search, the table accumulates forever in production.

**[H-8] Account settings accepts passwords the rest of the app rejects.**
`app/dashboard/account/actions.ts:104`

- `lib/validation.ts:8` `validatePassword` = 8 chars + uppercase + digit. Signup
  and reset both use it (`app/(auth)/actions.ts:79,164`).
- `updatePassword` checks only `password.length < 8` server-side — while
  `AccountClient.tsx:364` shows the *strict* rule client-side.
- Violates the project's own stated rule ("the server is authoritative") and
  CLAUDE.md's requirement that the prod Supabase minimum match `validatePassword`.
- Part of a broader class: 8 Server Actions write user input with no or
  materially incomplete server-side revalidation — notably `updateTeams`
  (`account/actions.ts:213`) has zero enum checks while its onboarding twin
  validates all three enums, and `business_email` is stored with no `validateEmail`.

### Medium

- **[M-1] Two commits in this batch shipped with no doc updates, against the
  "documentation is a first-class deliverable" convention.** `37f9d90` deleted
  three public routes; `5f4a460` (the security fix) recorded no DECISIONS entry
  despite the convention naming "audit finding or bug fix" explicitly. *This one is
  mine, from the immediately preceding turn.*
- **[M-2] `DECISIONS.md` S8.2 is now stale.** It describes `000005` as it was
  before `5f4a460` trimmed it. Per "keep OLD docs true", it needs a superseding note.
- **[M-3] Two competing FAQ surfaces sit adjacent in the same nav section.**
  `/dashboard/faq` (new) and `/dashboard/support`'s FAQ block (broken, C-2) are
  `nav-items.ts:20-21` and `:31-32`. The rewrite added the new surface without
  retiring the old one.
- **[M-4] `faq_audiences` writes are unchecked, with a data-loss shape.**
  `app/dashboard/faqs/actions.ts:71` deletes all audience rows, `:96` re-inserts —
  neither checked. A failed insert leaves the FAQ with zero audiences (invisible
  everywhere) while the action returns success.
- **[M-5] RLS-filtered writes report success.** Verified: a non-owner,
  non-admin `UPDATE events` returns `UPDATE 0` **with no error**. Security holds;
  the action doesn't. 4 actions affected (`cancelEvent`, `updateTournament`,
  `deleteReview`, `deleteComment`). Fix: assert row count via `.select()`.
- **[M-6] `000005` re-revoked UPDATE on `profiles` but not INSERT**, so
  `authenticated` holds column INSERT including `user_type` / `role_title` /
  `blocked`. Not exploitable — `profiles` has no INSERT policy — but it is
  defense-in-depth drift in the exact fields CLAUDE.md says to omit.
- **[M-7] `role_title` update grant silently dropped.** `20260716000002:18`
  granted it with an explicit rationale; `000005`'s re-grant list omits it,
  making `trg_lock_profile_role`'s onboarding mechanism unreachable from the client.
  No code writes it today — needs a decision either way.
- **[M-8] `anon` holds INSERT/UPDATE/DELETE on all 35 tables** (also `000005:25`).
  Safe today only because every table has RLS with a policy; any future table
  shipped without one becomes an anon write target. Note `anon` is now *broader*
  than `authenticated` on profiles/reviews/events — an inversion showing the
  re-apply block only considered `authenticated`.
- **[M-9] Docs contradict themselves about the FAQ system.**
  `SPECIFICATION.md:494-496` says FAQ is "hidden this sprint"; `:1140` says it is
  live. `SCHEMA-DESIGN.md:337,351` still describe the dropped `faq_audience` enum
  while `:35,250` describe the new child table. `SMOKE-TESTS.md:264-265` was not
  touched at all.
- **[M-10] Docs describe dropped tables as live.** `contact_requests` and
  `regions` (dropped in `20260716000014`) still appear present-tense in
  `SCHEMA-DESIGN.md:248,254`, `SPECIFICATION.md`, `SMOKE-TESTS.md:313`, **and
  `CLAUDE.md:147-149`** — the file marked "read first, every session" documents a
  rate-limit trigger that no longer exists.
- **[M-11] `docs/TESTING.md` has no row for any flow this batch added** — FAQ,
  business contact fields, milestones — despite the convention requiring the
  matrix be updated.
- **[M-12] Cross-suite test data pollution.** One `npm test` run leaves ~22
  orphaned events + tournaments (`purge()` deletes the auth user, but
  `owner_id` is `ON DELETE SET NULL`). `e2e/helpers/db.ts` already compensates
  with `%Probe%` title filters — the E2E suite is written around the unit suite's litter.
- **[M-13] `package.json:6` `engines.node: ">=20.9.0"`** contradicts README,
  DEPLOYMENT, and CI, which all require Node 22+ and state Node 20 throws at runtime.
- **[M-14] `DEPLOYMENT.md` omits `NEXT_PUBLIC_GOOGLE_MAPS_KEY`** from its env
  table — following the runbook end-to-end yields a deploy where Places
  autocomplete silently degrades and events get no coordinates.
- **[M-15] New FAQ RLS policies inline an admin subquery** instead of the
  `is_admin()` helper every other policy uses (~30 call sites). Currently correct,
  but `faq_audiences` has both `id` and `user_type` columns and the subquery
  references them unqualified — a future refactor of its FROM clause would
  silently lock admins out.
- **[M-16] `business_phone` / `business_email` skip `safeExternalUrl`**
  (`app/(site)/events/[id]/parts.tsx:2167,2177`) while `business_website` three
  lines below uses it. Not exploitable — the scheme is a hardcoded prefix and JSX
  escapes attributes — but it is a convention gap on values stored with no validation.
- **[M-17] `HostAvatar` flips container shape based on data presence.**
  `app/(site)/events/[id]/parts.tsx:2337-2351` (added by this batch's `7bf533b`)
  renders a **rounded-xl square** when a logo exists and falls back to
  `<Avatar size={48} />` — a **circle** — when it doesn't. It bypasses `Avatar`'s
  `src` prop entirely, which already handles this correctly. *This corrects my
  own initial read:* the two `Avatar` primitives genuinely do enforce
  `h-full w-full object-cover` internally, so the other 27 image sites inherit it
  — but this one call site opts out. `object-contain` for a logo is defensible;
  the shape-flip is not.
- **[M-18] Two `Avatar` components and two star components coexist.**
  `app/components/ui/Avatar.tsx` already had `src` + `object-cover` **before**
  `db70ba9` added the same capability to `app/components/Avatar.tsx`; they diverge
  in palette and a11y attributes, and `STYLE-GUIDE.md` documents "Avatar" as one
  component. Likewise `ui/StarRating.tsx:103` guards `value <= 0` → `"—"` while
  `components/Stars.tsx:45` renders a bare `0.0`. The live consequence:
  `app/(site)/directors/[id]/parts.tsx:304` renders **"0.0" beside five grey
  stars** for a review with a null overall rating.
- **[M-19] Empty-rating copy has five different spellings across cards** —
  "No reviews yet" (×4), "No ratings yet", "First coach or attendee review lands
  here.", `"—" / 5` (the exact shape `63e6088` removed from EventCard as
  misleading, still live at `directors/[id]/parts.tsx:239`), and nothing at all
  (`dashboard/favorites/page.tsx:87`).
- **[M-20] The public `/contact` form collects and validates six fields, then
  persists nothing.** `app/components/contact-action.ts:41-72` returns
  `{ ok: true }` with no DB write and no email, and the UI shows "Message sent!".
  This is **deliberate and documented** at `:63-71` (the `contact_requests` table
  was dropped) — but `fec083a` in this same batch built `lib/email/support.ts`,
  precisely the sink this form needs, and didn't wire it. The root-cause fix is
  now a few lines of reuse. Flagged because a user believing they contacted the
  business is a real outcome, not a cosmetic one.
- **[M-21] A failure/emptiness discriminator was designed and never wired.**
  `app/components/types.ts:142` declares `source: "rpc" | "unavailable"` and
  `app/(site)/about/page.tsx:535` branches on it to say "temporarily unavailable"
  instead of "no directors yet" — but `lib/directors/queries.ts:164,223`
  **hardcode `source: "rpc"` on every path**. The "unavailable" branch is
  unreachable and the union member is dead. This is the intersection of H-1 and
  E: the codebase designed the exact mechanism for telling failure from emptiness,
  and never connected it — which is why the error-swallowing class is invisible in
  production.

### Low

- **[L-1] `20260718000003_end_date_not_null.sql` is a 9-line comment-only no-op**
  whose filename asserts the opposite of both its content and the live schema
  (`end_date` is nullable). Verified coherent with the app: drafts pass null,
  publish requires dates. Naming rot only.
- **[L-2] `app/components/card-bits.tsx`: 7 of 9 exports dead**, and 5 of them are
  re-implemented verbatim by the files that should import them (`capitalize` ×4,
  `IconPin` ×3). A "shared primitives" module nobody shares from.
- **[L-3] `FaqsClient.tsx:38-48` duplicates `lib/enums.ts:14-24` and has already
  drifted** (`"Parent / Spectator"` vs `"Parent/Spectator"`). This is the newest
  code in the repo — the pattern is actively spreading.
- **[L-4] Unreachable guards.** `faqs/actions.ts:81,95` both test
  `if (audiences.length)` after line 59 already returned when it is 0.
- **[L-5] The parked claim-approve chain is dead past the button.**
  `ClaimRequestsTable.tsx:117,121-138` — `onApprove` never fires, so `approving`
  is permanently null, so the ConfirmDialog is permanently closed and
  `approveClaimRequest` is unreachable. The parking decision is documented
  (RG1.C3); this is rot layered on top of it.
- **[L-6] `event_milestones` has no public read path.** The ED-facing editor added
  in `18aee41` writes them; the public event page builds its own milestone array
  locally (`parts.tsx:946-980`) and never queries the table. `20260716000014:16-18`
  justifies keeping the table by claiming a public read path exists. It does not.
- **[L-7] `lib/url.ts` and `lib/rate-limit.ts` have zero tests** despite being the
  stated XSS and abuse defenses. Both hold under probe (all 9 hostile schemes →
  `null`), but nothing locks that in.
- **[L-8] Seed `sort_order` values collide** (`fa001`=0, `fa003`=0, `fa004`=0), and
  both FAQ pages order only by `sort_order` — display order is non-deterministic.
- **[L-9] Stale counts in prose.** `README.md:110` says 15 migrations (22);
  `README.md:118` / `DEPLOYMENT.md:189` say 45 probes (75) — and DEPLOYMENT turns
  that number into a verification gate. `DECISIONS.md:660` cites a file that
  doesn't exist.
- **[L-10] Dead odds and ends.** devDependency `tsx` (no invocation);
  `scripts/seed-demo.js` (untracked, zero references, and crashes on a missing
  import); 5 `create-next-app` scaffold SVGs in `public/`; ~10 over-exported
  internal helpers; dead props on `EmptyState`, `MetricStrip`, `ConfirmDialog`,
  `StarRating`.

---

## Verified clean (so it isn't re-audited)

- **All 7 findings from the previous Turbo Check are closed.** README/DEPLOYMENT
  rewritten (H-DOC-1), orphan primitives deleted (M-DEAD-1), `regions` +
  `contact_requests` dropped (M-DEAD-3), `promo_status.'staged'` now reachable via
  the column default (L-ENUM-1), `last_name` trimmed from the self-join (L-WIRE-1),
  AND→OR fixed in `20260716000015` (L-SQL-1). M-DEAD-2 (`event_milestones` had no
  writer) was closed by this batch's `18aee41` — see L-6 for the remaining half.
- **The `Avatar` primitives are correct.** `ui/Avatar.tsx:44` and `Avatar.tsx:34`
  both enforce `h-full w-full object-cover`, so 27 of 28 image sites inherit
  correct behavior. Of the 8 tags lacking `object-fit`, all are correct as-is (a
  QR code that must not crop, an inline SVG logo, rectangular logo panels where
  `object-contain` is right, and an `<Image fill>` that sets `objectFit` via
  `style`). The one opt-out is M-17. *This is a correction to my initial
  assessment, which credited the fix as fully systemic.*
- **Zero dangling route references** from the page deletions — no code, nav,
  test, or doc points at `/coaches`, `/press`, or `/careers`. All 33 internal
  hrefs resolve.
- **`schema.sql` has zero drift** from the migration tree (regenerated to scratch
  and diffed; 2652 lines byte-identical).
- **All 17 RG1 function revocations hold** for `anon` *and* `authenticated` —
  `5f4a460`'s omission of the function grant was correct and stuck.
- **No client-side role check lacks server enforcement.** All 7 admin pages gate
  server-side; destructive paths route through `is_admin()`-guarded DEFINER RPCs.
- **All 46 FKs have explicit delete actions; all 35 tables have RLS + ≥1 policy.**
- **CLAUDE.md's 42-path layout map is 100% accurate.** No `is_sponsored`,
  `full_name`, `contact_email`, `profile_picture`, or `customer_type` leftovers in
  app code.
- **Zero `dangerouslySetInnerHTML` in the repo**; FAQ content renders as plain text.
- `seed.sql` matches the final schema; `supabase db reset` works from zero.
- `lib/rate-limit.ts` is honest about its own threat model (in-process, burst-only,
  DB as second line) — not a finding, though see L-7.

---

## Verification ledger

| Subsystem | Class | Evidence / probe that would upgrade it |
|---|---|---|
| Review-eligibility RLS (`000004`) | **Proven** | `tests/probes/review-eligibility.test.ts` |
| Column grants: profiles, reviews | **Proven** | `tests/probes/rls-writes.test.ts` (5) |
| Column grants: events tier | **Proven** | `tests/probes/event-tier-escalation.test.ts` (5) |
| RG1 revocations vs `authenticated` | **Proven** | `c2-definer-guards.test.ts` — but see H-3 |
| RG1 revocations vs `anon` | **Proven (probe only)** | `has_function_privilege` = false ×16. No repo test — will rot. |
| Public-view **SELECT** PII | **Proven** | `h1-public-views.test.ts` |
| Public-view **WRITE** | **Disproven** | Probe G / REST PATCH → C-1. *This is the gap that let C-1 ship green.* |
| FAQ RLS read gating | **Proven (probe only)** | anon sees published+visible only. No repo test. |
| FAQ non-admin write denial | **Proven (probe only)** | INSERT → 42501. No repo test. |
| DB rate-limit trigger | **Proven (probe only)** | `[22023] rate limit exceeded`, 0 rows persisted |
| `lib/url.ts` scheme allow-list | **Proven (probe only)** | 9 hostile schemes → `null`. No repo test (L-7). |
| Promo flow, claims, onboarding, auth, moderation | **Proven** | `c3`/`c4`, `claim-flow`, `e2e/onboarding|auth|mutations` |
| `lib/rate-limit.ts` app layer | **Static-only** | Unit test: 2 calls at limit 1 → second `ok:false`; 5100 keys → eviction behavior |
| `proxy.ts` blocked-user bounce | **Assumed** | E2E: set `blocked=true`, hit `/dashboard`, assert `/login?error=blocked` + session cleared |
| `app/auth/callback/route.ts` | **Assumed** | E2E: admin-API magic link → callback → assert session cookie |
| `event_milestones` RLS | **Static-only** | Non-owner ED insert/update on another's event → expect denial |
| `faq_audiences` targeting logic | **Assumed** | Probe: coach vs ED sees correct subset; `role_title=null` wildcard |
| Business contact write path (`000006`) | **Static-only** | Probe: user A writes `business_email` on user B → expect denial |
| `000005` table-grants fix | **Assumed → regressed** | C-1 |
| CSV export route | **Static-only** | Non-admin GET → assert 403 |
| Per-action FormData validation | **Mixed** | `validation.test.ts` covers pure helpers only; see H-8 |

---

## Proposed fix plan

Ordered by severity; each commit atomic, each pairing the fix with its tripwire.

1. **C-1 — close the RLS bypass.** New migration revoking
   INSERT/UPDATE/DELETE on all four `public_*` views from `anon, authenticated`;
   narrow `000005`'s blanket grant to `relkind='r'`. **Tripwire in the same
   commit:** anon + authenticated write-denial assertions on all four views in
   `h1-public-views.test.ts`. ⚠ Changes external behavior (removes access that
   should never have existed). Ship this first and alone.
2. **C-3 — stop the profile-save data loss.** Build the update object from keys
   present in the FormData (or emit hidden inputs carrying current values). Same
   commit: the `updateNotificationPrefs` sibling. **Tripwire:** a probe that saves
   an admin profile with only name fields and asserts `location_formatted` /
   `user_gender` survive.
3. **C-2 — fix `/dashboard/support`.** Recommend deleting the FAQ block (M-3:
   `/dashboard/faq` supersedes it) rather than porting the query. Same commit:
   restore the `/faq` footer link (H-2).
4. **H-1 / H-0 — the tripwire that makes C-2 and H-0 impossible again.** Wire
   `supabase gen types typescript` into a script + CI; add a checked `unwrap()`
   in `lib/supabase/` and route the 96 unchecked sites through it, starting with
   `lib/directors/queries.ts` (10/10) and the 5 facet queries in
   `lib/events/search.ts`; add a lint rule for bare `const { data } =`.
   **Highest-leverage item in this list** — it closes H-0, prevents the next C-2,
   and makes M-21's discriminator meaningful.
5. **H-4 — clean flags at the DB layer.** `after delete` triggers on `reviews`
   and `comments` purging both polymorphic tables, rather than patching the 5
   remaining call sites. Probe: no orphan `flagged_content` survives any delete path.
6. **H-3 — de-vacuum the c2 probe.** Assert on `has_function_privilege` /
   `pg_proc` presence; drop the dropped function; fix the "17" comment.
7. **H-9 / H-8 / H-5 — correctness batch.** Fold reset-on-success into a shared
   `useResettableAction` (and delete or use `useSubmittedValues.reset`), starting
   with the password field; make `updatePassword` call `validatePassword`; add
   `validateEmail` to `business_email`; return a bare `new Response(null,
   {status:204})`; add `rateLimit()` to `/api/search-log`.
8. **Docs reconciliation (M-1, M-2, M-9, M-10, M-11).** One commit: supersede
   S8.2, add DECISIONS entries for `5f4a460` and for this audit, fix the
   SPECIFICATION / SCHEMA-DESIGN / SMOKE-TESTS contradictions, correct CLAUDE.md's
   rate-limit paragraph, add the missing TESTING.md rows.
9. **H-6 / H-7 / M-20 — decide and act.** Either wire FTS into search or drop the
   columns, trigger, and indexes; either schedule `rate_limit_prune()` or drop it;
   either wire `/contact` to `lib/email/support.ts` or stop telling users their
   message was sent.
10. **Consolidation (M-18, M-19, L-2, L-3).** One `Avatar`, one star component,
    one empty-rating copy, one `capitalize`/`IconPin`. Three of the seven audited
    fixes trace back to duplicated primitives that drifted; this is where a
    tripwire could live.
11. **Medium/Low cleanup**, batched by cluster (`engines.node`, seed `sort_order`,
    stale counts, `000003` rename, dead exports).

Items 1–3 are release blockers. Item 4 is what prevents the next one.

---

## Status

The three Criticals are **fixed** (`9da8c9a`, `adfdd61`, `e54140c`) — see the
post-fix table above. Everything else in this report is **still open** and
awaiting approval; nothing below Critical has been changed.

Next by leverage, unchanged from the plan above: **H-0** (the search fix is
still unreachable — 5 facet queries route failures around its guard), **H-1**
(generated Supabase types; the schema-drift probe covers the symptom, not the
untyped boundary), **H-4** (5 of 6 flag-orphan delete paths), and **H-9**
(4 forms that don't reset, one holding a plaintext password).
