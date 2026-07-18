# DECISIONS

Non-obvious calls made during the rebuild, in slice order. Each entry says
what was chosen, why, and (when it matters) what the alternative would look
like. Add-only; don't rewrite past entries when a later slice supersedes
them — add a new one that references the older by heading.

---

## Slice 0 — Foundation

### S0.1 · Old data model wiped, plumbing kept verbatim
The rebuild targets the from-scratch schema in `tg scoping/schema.sql`. The
old migrations tree, old query helpers (`lib/supabase/queries.ts`,
`lib/data/*`), and every page under `app/(auth|onboarding|site|dashboard)`
referenced dead columns (`full_name`, `contact_email`, `profile_picture`,
`onboarding_complete`, etc.). Preserving them would have required patching
each in place; deleting was cheaper and keeps the branch coherent.

Kept verbatim: `lib/supabase/{server,client,proxy}.ts`,
`lib/rate-limit.ts`, `lib/url.ts`, `next.config.ts`, `app/globals.css`
(trimmed later in step 3), the `app/auth/callback/` email-link exchange
(column name patched: `onboarding_complete` → `onboarding_completed`).

Rewritten: `lib/supabase/session.ts` (new `SessionProfile` type +
`postOnboardingDestination` helper), `CLAUDE.md` (fresh conventions for
the new schema), `supabase/README.md`, `scripts/build-schema.sh`
(removed the demo-seed skip list — no demo seeds this build).

Middleware entry: Next 16 renamed the middleware convention to `proxy.ts`
at the repo root, which the old build already had (thin shim into
`updateSession` from `lib/supabase/proxy.ts` — the Supabase helper).
Keeping the file names as they are; the split (root proxy.ts = Next 16
convention, lib/supabase/proxy.ts = Supabase session helper) is legible
enough with a doc comment.

### S0.2 · No autonomy config file this session
BUILD-PLAN Part 1.2 describes a `.claude/settings.json` autonomy config.
The user's session-level instructions already cover the same autonomy
directive, and my current permission mode approves the tools I need. Not
writing that file — the operator can add it separately for future
sessions if they want to durably codify it.

### S0.3 · Password minimum lowered to 8 chars
The new Auth spec (`tg scoping/Auth & Onboarding.rtf`, signup section)
says *"8 characters minimum, at least 1 uppercase, at least 1 number"*.
The old app enforced 12. The spec is authoritative for the rebuild — the
`validatePassword` helper uses 8/1/1. If the client later wants 12 back,
change the constant in one place.

### S0.4 · Schema semantic fixes

One inline patch to the baseline itself (bootstrap-blocker), plus four
follow-on migrations that layer semantic fixes on top. Each fix migration
has its own timestamped file so the intent is legible in the tree.

**Inline in `20260716000001_baseline.sql` (pre-boot bootstrap fix):**

0. `apply_promo_to_review` search_path adds `extensions`. Baseline set
   only `public, pg_temp`, but the function DECLAREs `v_email citext`
   and citext lives in the `extensions` schema. Postgres validates
   plpgsql DECLARE types at function creation, so the baseline failed
   at that statement. Fixed inline because the migration can't succeed
   otherwise. All other functions that touch citext-typed columns work
   fine because they never DECLARE a citext local.

**Follow-on migrations:**

1. **`dob` and `role_title` added to profiles UPDATE allow-list**
   (`20260716000002`). Onboarding needs to write both. Baseline omitted
   them from the column grant, which would have surfaced as an opaque
   "permission denied for column" error during onboarding.
2. **Role/type lock trigger** (same migration). Spec: role adjustable
   during onboarding, locked after. Column grant lets the client write
   `role_title` (and, defensively, `user_type`); a BEFORE UPDATE trigger
   raises `errcode=42501` if either column changes once
   `onboarding_completed=true`. Baseline had neither the grant nor the
   trigger.
3. **`p_comments_read` tightened** (`20260716000003`). Baseline let any
   caller read comments on a *draft* review as long as the comment
   itself wasn't personally hidden. Now requires the parent review to
   be visible (published / authored by caller / admin) AND the comment
   not personally hidden. Admin still sees everything.
4. **`handle_new_user` picks a role default that matches the incoming
   `user_type`** (`20260716000004`). Baseline hard-coded
   `role_title='coach'`, which conflicts with `role_matches_type` when
   the metadata carries `user_type='event_director'`. Fixed to `coach`
   for attendee, `event_director` for ED, `coach` (neutral placeholder)
   for admin — admin's check-constraint accepts any role_title anyway,
   and admin roles never appear in the UI.

### S0.5 · Location field — Places-backed (was: text-only)
RESOLVED: Google Places autocomplete is wired (July 2026) via
`app/components/LocationAutocomplete.tsx` + `lib/maps/loader.ts`, gated on
`NEXT_PUBLIC_GOOGLE_MAPS_KEY` (note: final env var name differs from the
`_API_KEY` guess below). Onboarding step 2, the account profile, and the
ED event form all write lat/lng/place_id/city/state/zip through it; hidden
inputs carry the payload so Server Actions stay plain (`lib/geo.ts
parseGeoFields`). Without the key every location input degrades to the
original plain text input that writes only `location_formatted` —
coordinates in the DB only ever come from a picked suggestion.
`scripts/geocode-events.mjs` backfills events that predate the wiring.

### S0.6 · Component library colocated under `app/components/ui/`
Not a top-level package. Same-app import paths, less indirection. If
consumers grow beyond this repo we can extract later.

### S0.7 · `StatusPill` accepts a semantic `tone` prop
Rather than one pill component per family (event / promo / CSV / review
status), a single `StatusPill` with a `tone` prop covers all of them.
The tones map to specific bg+fg pairs from the tgredesign palette (5
event states + neutral / positive / warning / danger reuse). This keeps
the primitive count small while still giving every family its own
distinct look.

### S0.8 · Attendees have a dashboard shell too
The RTF specs only list ED + Admin sidebars, but the account/reviews/
favorites/activity RTFs all describe attendee-side dashboards. The
shell in this slice supports all three roles with role-specific nav
items. Attendee post-onboarding still redirects to `/events` (per spec);
they reach `/dashboard/*` via the header avatar menu.

### S0.9 · Hidden ED nav items this sprint
`ED Dashboard pages.rtf` says *"Hide Transactions, Add-on Pricing and
Notifications, FAQ in this sprint."* Those routes exist as stubs
(returning 404 today) but are not linked in the sidebar. Support IS
shown (not in the hide list).

---

## Slice 1 — Events

### S1.1 · Admin edits tournaments only when unclaimed
Spec: *"the option to edit the tournament/add an event is possible
for the admin only if the tournament/event was added by the admin
and has not yet been claimed by an ED."* The page-level
`canManageTournament` returns false when `owner_id !== null` (i.e. an
ED has claimed it). Editing an EVENT is always allowed for admins
per the spec addendum. EDs manage their own only.

### S1.2 · Uploads = URL fields (bucket flow deferred)
Logo, sponsor logo, event images, org logo, and event video are all
URL inputs for Slice 1. Wiring the Supabase private/public buckets +
signed-upload flow doesn't gate the ED/Admin CRUD story, and the
scoping deferral matches Slice 0's location-input punt (see §S0.5).
Track under the same "storage cutover" follow-up.

### S1.3 · Child collections use replace-all persistence
saveEvent deletes every row in each child collection (age groups,
sponsors, competition levels, surfaces, features, images) and
re-inserts what the client sent. Two motivations:
- The form owns the collection as a single array in useState — the
  server never has to reconcile per-row diffs, and stale IDs can't
  slip in from a lagging client.
- Every child insert flows through server-side validation once,
  regardless of whether the row is "new" or "existing" from the
  client's POV. The DB check-constraints backstop enum values.

The cost is an extra DELETE per collection per save. With
6 collections capped at low tens of rows each, this is a rounding
error and worth the simpler mental model.

### S1.4 · Premium is a flag flip, no Stripe
Spec: *"in this sprint, we are not building the payments/Stripe piece,
because only the client will be managing events for a little while on
launch."* upgradeEvent sets `is_premium = true`; the new
stamp_premium_at trigger (migration 20260716000005) fills premium_at
on the false → true transition. Reverting an event to non-premium is
never surfaced in the UI — the client can do it via SQL if needed.

### S1.5 · Admin search + sort by owner runs in-app
The admin scope of `listTournaments` fetches all rows, joins owner
first_name/last_name in a second query, and filters + sorts in JS.
Alternative: Postgrest embedded-resource order + a computed
full-name view. In-app is simpler and admin volume is low; if the
tournaments table grows past a few thousand rows this becomes the
right thing to migrate to a materialized view + a proper GIN index.

### S1.6 · CSV export = current view + admin-only
Spec: *"the exported list must match what the admin sees on the
screen."* The CSV route reads `?q=` and `?sort=` from the request
URL and runs the exact same listTournaments + listEventsForTournaments
pair the page runs. The `description` column is intentionally left
blank in the export because it isn't part of the compact list
projection; widening the list projection just for the CSV would make
every page fetch heavier. If the client wants description in the
export, the CSV path can fetch it in batches on demand.

### S1.7 · QR generation is on-demand, not cached
Spec says the button changes from "Generate QR Image" to "Open QR
Image" if one exists. We render "QR" always and generate on click.
Rationale: the QR encodes a stable URL, so caching gains nothing
(the URL doesn't change and QR generation is a few ms + a couple KB
buffer). Caching would add storage bucket + cleanup work with zero
correctness benefit.

---

## Slice 2 — Reviews & engagement

### S2.1 · Rich-text review body deferred to plain text
Spec mentions inline formatting (bold, italic, strike, underline,
list, link, emojis). Shipping a real rich-text editor (TipTap /
ProseMirror) + a server-side sanitizer allow-list is a sizable
addition and would gate everything else in Slice 2. Plain-text body
covers the review MVP; the sanitizer stays in the plan for a
follow-up alongside the deferred private-storage upload flow.

### S2.2 · Banned-word matching mirrors on client + server
`findBannedWords` exists in two files — `lib/reviews/banned-words.ts`
(server, with `server-only`) and `lib/reviews/client-check.ts`
(client, plain). Same regex logic, same result. Server side is
authoritative on submit; client side gives real-time feedback while
typing without an extra round-trip per keystroke. When the list is
edited, the fresh copy fetches on the next server call — no cache
to invalidate.

### S2.3 · Replace-all owner reply (no separate edit-reply branch)
Spec allows an ED to delete and add a new reply. The action treats a
new-reply insert as delete-then-insert: it wipes any prior
`is_owner_reply=true` row on the review before inserting the new one,
so an "edit" is a re-post from the ED's perspective, and the code
path is one write instead of two.

### S2.4 · CSV export happens client-side
Dashboard bulk export builds the CSV in-browser and downloads via a
Blob. Selection state is client-owned already (the checkboxes live
in useState), so streaming the whole row set through a server route
would double-fetch. Cap is 30 rows per page (spec) — well under any
memory concern.

### S2.5 · Attendee state filter uses review snapshots
The list projection for the attendee's "My Reviews" doesn't join the
current event row (would blow up the query for detached rows). The
state filter reads from `snapshot_event_location`'s trailing 2 chars,
which are stamped when the event is deleted. Live events don't have
the snapshot set — those rows currently pass the filter. If the
client wants a strict state filter on live events too, the follow-up
is a second query that pulls `events.location_state_abbr` in a batch
and merges it into the row set.

### S2.6 · platform_counters.published_reviews_total never decrements
Spec: "even if the published review was deleted, the system should
still count it towards the total nr of published reviews alongside
other app metrics like listed tournaments and listed events." The
baseline trigger only increments; delete leaves the counter alone.
Same rule already applies to events + tournaments per SCHEMA-DESIGN
§8.

### S2.7 · Reviewer-details popup deferred
Spec calls for a two-column popup (Verified Coach vs Attendee stats)
when clicking a username on the dashboard. That's a separate query
+ layout; the review table renders the reviewer identity inline and
that covers the "who wrote this" use case. Follow-up when time
frees up.

### S2.8 · Location state on events for dashboard state filter
`ReviewsTable`'s state filter uses `event.location_state_abbr`
directly (already selected in the joined projection). Simpler than
mapping through the state seed table.

---

## Slice 3 — Promo system

### S3.1 · CSV bucket upload deferred, email list stored inline
The private storage bucket + signed upload/download URL flow is a
follow-up (paired with the Slice 0 org-logo defer + Slice 1 image
uploads under one "storage cutover" task). Meanwhile, migration
20260716000007 adds `submitted_csvs.raw_emails jsonb` — the parsed
email list stores inline so the admin queue can render + preview +
regenerate the CSV without a bucket read. Max 1000 rows per file
per spec keeps the JSONB well under any practical size.

### S3.2 · Eligibility pre-flight is a pass-through until service-role
Spec: emails that hit an existing account with `user_type != coach`
should show a "This email is already in use…" warning + auto-
exclude. Doing that check requires a lookup against auth.users.email
which the anon+authenticated clients can't read (RLS-protected).
Full check needs SUPABASE_SERVICE_ROLE_KEY plumbed through a
server-only client. Deferred; the send action still voids prior
non-applied promos + inserts fresh rows so no correctness issues.

### S3.3 · In-process batches instead of a real queue
Spec calls for Inngest / Trigger.dev / QStash. For the launch phase
(the client running events on-behalf for a while) the total email
volume is low tens per submission. Batches of 5 with a 100ms
throttle keep the whole dispatch inside one server-action call, and
SendGrid handles the load fine. Follow-up: wire a real queue when
CSV submissions get past a few hundred rows per day.

### S3.4 · Promo landing routes through the standard signup, not a mini-wizard
Spec describes a bespoke 3-step onboarding on the promo landing
(email/name/organization → location/gender/dob → team info). That
duplicates the /onboarding wizard we already have. We routed the
promo landing through /signup with email pre-filled +
type=attendee+role=coach preselected, then /onboarding, then the
review form. Same fields collected, same validation, no new UI
surface. The follow-up to consolidate the auth variants (spec calls
this out) can compare the three properly with this variant already
built on top of the standard flow — one less thing to unify.

### S3.5 · Promos filtered to sent/active/applied
The Coaches list drops staged + void rows so the table only shows
actionable promos. Staged is a transient state (spec keeps it for
Bubble backfills) and void rows are historical. Attendee list uses
the same filter — displays only rows meant for them today.

---

## Slice 4 — Claim system

### S4.1 · Approve/decline via SECURITY DEFINER RPCs
Ownership transfer touches four tables (claim_requests +
tournaments + events + other pending claim_requests) in one
logical operation. Doing it via `.update()` calls across the
supabase-js client couldn't be atomic — a partial write could
leave the tournament transferred but the events untouched. The
RPCs run everything inside one transaction, gate on is_admin() at
entry, and use `set search_path = public, pg_temp` so a malicious
extension can't hijack the resolution.

### S4.2 · Linky separator = newline-or-comma
Spec asks for links[] but doesn't fix a UX shape. A single
textarea (one link per line, comma also accepted) is simpler than
per-row "+ Add link" plumbing at Slice 4 scale. Every entry runs
through `safeExternalUrl` before insert.

### S4.3 · Claim CTA lookup piggybacks the initial page fetch
The public event page already queries the row; adding
`tournament_id` + `owner_id` to that projection removes a second
round-trip for the "Requested" pill lookup. `hasPendingClaim`
runs only when signed-in ED + unclaimed event, so most page loads
skip it entirely.

### S4.4 · Auto-decline reason is canonical text
Sibling pending claims auto-declined at approval time carry
`decline_reason = 'Another claim on this tournament was approved.'`
Baked into the RPC so the reason stays consistent across all
sibling declines and the audit trail on the ED dashboard reads
cleanly.

---

## Slice 5 — Public discovery

### S5.1 · Popular searches pad with baked-in defaults
Fresh installs have zero rows in `search_queries`, so
`get_popular_searches` returns empty. The landing page fills the
gap by appending three "approved default" chips (Youth Soccer, U12
Girls, Kansas City — placeholder terms that make the hero look
alive on day one). Once real queries accumulate the DB set takes
over and the defaults drop out.

### S5.2 · Map + distance-from-me deferred
The full search-events surface in the spec includes a sticky map
+ distance filter. Neither is on the critical-path for MVP and
they carry their own dependency graph (Leaflet, geocoding,
distance math against user's saved location). Deferred to a
follow-up alongside the Google Places autocomplete from Slice 0.

### S5.3 · Child-table filters intersect via id sets
Surface / level / age filters resolve to a set of matching
event_ids each, then intersect. Cheaper than four self-joins in a
single query and keeps each sub-query using its own index
(event_age_groups(age), event_surfaces(surface), etc.).

### S5.4 · Directors read public view, not table
Both /directors surfaces query the `public_directors` view that
the baseline defines with security_invoker=false. Guarantees email
+ DOB never come through even if a future edit widens the select
list. Owner-side dashboard queries still read the full profiles
row via RLS.

---

## Slice 6 — Account & activity

### S6.1 · Soft-delete via anonymize + scrub, auth.users stays
Spec: "delete their data, including reviews and comments." The
schema's `anonymize_account` already nulls author identity on
reviews + comments but keeps the content. `scrub_profile_identity`
extends that to the profile row (nulls everything, sets
blocked=true so the proxy signs the user out on the next request).
Hard-deleting the auth.users row requires a service-role client;
that's a follow-up. For MVP the "Former member" cards land as
soon as the RPC finishes.

### S6.2 · Recent-view cap enforced by trigger
`trim_recently_viewed` fires after every insert and keeps the
per-user set at 50 rows. Simpler than a scheduled cleanup + means
we can never fetch more than 50 by construction.

### S6.3 · Support form uses the same SendGrid helper as promos
No separate template ID — the support message reuses
`sendPromoEmail` with the operator's inbox as the recipient. When
env vars aren't set the log-stub still writes to
support_messages so the inbox on the admin side (deferred surface)
can pick it up. Real routing to a distinct SendGrid template is a
one-liner follow-up.

---

## Slice 7 — Admin content ops

### S7.1 · Delete-flagged-review cascades child comments via FK
Spec: delete the review + its comments + flag records. The
schema's ON DELETE CASCADE from reviews to comments handles
comment removal automatically; the action only has to delete
flagged_content rows first (so the reviews-recalc trigger picks
up the aggregate change on the parent event) and then delete the
review row. No new triggers, no bespoke fan-out.

### S7.2 · Admin block + delete route through SECURITY DEFINER RPCs
The `blocked` column is deliberately out of the client UPDATE
allow-list, so the admin flip needs a wrapper. admin_set_blocked
+ admin_delete_user gate on is_admin() at entry; delete_user
delegates to delete_ed_account / soft_delete_attendee (Slice 6
rpcs) so the same soft-delete rules apply whether the user
initiates it or an admin does.

### S7.3 · FAQ CRUD backed by native <details>
FAQ list uses native <details> for expand/collapse rather than a
custom accordion. Fewer moving parts, better keyboard support out
of the box, and it matches the audience-facing display on the
Support page.

---

## Review Gate 1 remediation

### RG1.C1 · handle_new_user coerces the type; admin is never a self-signup
Migration 20260716000011 rewrites the trigger: whatever
`raw_user_meta_data.user_type` the client sends, we resolve to
`event_director` iff exact match, otherwise `attendee`. `admin` is
NEVER accepted. Role_title is then coerced back into the type's
valid set (mismatched combos land on the safe default per type).
Probe `c1-signup-privilege-escalation.test.ts` fires
`signUp({data:{user_type:'admin'}})` via the anon key and asserts
the resulting profile is attendee.

### RG1.C2 · Pattern-class definer guards + REVOKE sweep
Same migration:
- Destructive callables (delete_event, delete_tournament,
  scrub_profile_identity, anonymize_account, soft_delete_attendee,
  delete_ed_account) all get an `is_admin() OR ownership` check at
  entry — a normal user hitting them gets 42501.
- Trigger-only + recalc helpers have EXECUTE revoked from
  `public / anon / authenticated` so PostgREST can't call them at
  all: handle_new_user, touch_updated_at, all trg_*, stamp_premium_at,
  recalc_event_ratings, recalc_tournament_ratings, review_overall,
  rate_limit_prune, trg_lock_profile_role, trim_recently_viewed.
Probes in `c2-definer-guards.test.ts` verify each entry point
rejects a non-owner authenticated caller.

### RG1.C3 · apply_promo_to_review validates the whole chain
Function now checks: caller signed in, review exists, review not
already-guru, caller = review.author_id, promo exists, promo not
applied/void, promo.event_id = review.event_id, promo.email =
auth.users.email OR promo.user_id = auth.uid(). Sibling promos
still auto-void. Probes in `c3-apply-promo.test.ts` cover the
attacker case + the wrong-email case + the legit path.

### RG1.C4 (+M2) · Definer promo landing RPCs with email binding
Migration 20260716000012 introduces:
- `promo_landing_info(p_token)` — anon-callable, returns just event
  + email so the anon signup can pre-fill the target email. Safe:
  the caller already has the token from their inbox.
- `claim_promo(p_token)` — authenticated-only, verifies
  auth.users.email = promo.email before flipping 'sent'→'active',
  attaching user_id, and inserting a `landed` funnel event.
Both grant EXECUTE to the appropriate role. The `/promo/[token]`
page routes through these instead of touching `promo_codes`
directly. Full flagship flow probe in `c4-promo-flow.test.ts`:
CSV → promo issued → anon lands → coach signs up with matching
email → claim_promo → publishes review → apply_promo_to_review →
guru_review = true.

### RG1.H1 · Public reviewer/host reads go through DEFINER views
Same migration widens `review_author_public` to include
organization_title and adds two new views:
- `public_comment_authors` (comment_id, first_name, org, org_logo,
  photo, user_type, is_owner_reply)
- `public_event_owners` (id, first_name, org, description, logo,
  photo)
`listReviewsForEvent` + `listCommentsForReview` now fetch the base
row set from the RLS-gated tables, then attach identity via a
batched `.in()` against the view. Public event page's host sidebar
also switched to `public_event_owners`. `h1-public-views.test.ts`
asserts anon can read `first_name`+`organization_title` from the
view but gets no rows on a direct `profiles` read, and that
`last_name` is not exposed by the view.

### RG1.H2 · preferences_completed drives the wizard, not distance_pref
Same migration adds a `profiles.preferences_completed boolean`
column + grants UPDATE on it to authenticated. `saveStep3` sets it
true regardless of whether the user filled the optional fields;
`step3Done()` in the page now reads that flag. ED skipping the
distance / team pickers advances cleanly to step 4.
`h2-onboarding-step3.test.ts` covers the flip via the client
UPDATE grant.

### RG1.Tests · vitest wired to `npm test`
`tests/harness.ts` sets up anon + service_role clients pointed at
the local Supabase stack. Probe files (one per critical + high +
one per flow area) all pass on the current tree. `npm test` runs
the whole suite in ~11 s. Regressions caught: any of the RG1
issues would flip one of the probes red on the next PR.

### Backlog · event_milestones editor
The public event page reads `event_milestones` for the "Key dates"
section, but the Add/Edit Event form doesn't yet include a
milestones editor — the section always renders empty in production.
Turbo-check M-DEAD-2 flagged this; for now the render is gated on
`milestones.length > 0` so an empty section doesn't ship, and
wiring the editor stays on the backlog (spec calls for two
auto-created milestones — Early-Bird Ends + Registration Deadline
— plus manual entries per SCHEMA-DESIGN §3).

### RG1.Lint · 4 errors fixed
- `app/(auth)/layout.tsx` — apostrophe → `&apos;`.
- `app/(auth)/reset/RequestResetForm.tsx` — reworked cooldown to a
  Date.now()-based expiry with an interval-driven `now`. The one
  cross-effect setState carries a linter disable comment + an
  inline note explaining why (external form-action signal, not
  derived state).
- `app/dashboard/account/page.tsx` — `any` casts replaced with
  exported `AccountProfile` + `AccountTeam` types.

### S5.1 · KeyDatesCard gated on `event.premium`
The Key Dates & Deadlines card on the event-detail page now renders
only when `event.premium` is true. The spec already designates Key
Dates as "featured only" (§5.3, §3.2); this aligns the code with
that rule. Previously the card rendered for all events but showed
empty because no milestones editor exists yet for free-tier events
(see Backlog · event_milestones editor above). Gating it avoids
an empty card rendering for non-premium listings.

### S5.2 · E2E regression sweep — 1 app bug, 4 stale tests
Five E2E specs failed on the clean tree. Root-caused each:

1. **APP BUG — EventForm `canPublish` always false for new events.**
   `canPublish` read `defaults.base.title` (the empty initial prop)
   instead of the live input value. The Publish button stayed
   `disabled` permanently. Fixed by tracking the title with state.

2. **STALE — onboarding tests expected direct redirect to /events
   or /dashboard/events.** The app now routes through an
   `/onboarding/success` interstitial (intentional UX). Tests
   updated to click through the success page CTA.

3. **STALE — dashboard attendee-bounce expected /dashboard/events.**
   Attendees cascade: /dashboard/users → /dashboard/events →
   /events (the events dashboard redirects attendees to public
   search). Test updated to expect /events.

4. **STALE — reviews ED-bounce expected `?msg=attendees-only`.**
   The redirect now uses `?flash=info:Only attendees can write
   reviews` (the URL-driven toast system). The flash param is
   consumed and stripped by the client. Test updated to assert
   the toast message text instead of the URL param.

---

### S6.1 · Three-tier model — Premium / General Ads / Standard

**What:** `is_sponsored` renamed to `is_general_ad` (migration
20260718000001). The two paid tiers are Premium (`is_premium`, public
label "Featured") and General Ads (`is_general_ad`, public label
**"Spotlight"**). Everything else is a standard listing (not a tier).
The old `SponsoredBanner` component was removed.

**Why:** the client confirmed that the old "sponsored" concept IS
General Ads — one flag, one concept, no second boolean. The rename
aligns the DB with the agreed naming. "Spotlight" was chosen as the
public label (per call with Tanya) because the old "Recommended for you"
placeholder was misleading.

**Placements built:**
- Search page: Spotlight horizontal-scroll section between Featured and
  Event Listings (hidden if empty, soonest → latest).
- Attendee dashboard: permanent sticky right column (270 px, max 3
  events, shuffled each page load).
- Admin dashboard: General Ads on/off toggle on the event detail page.
  EDs cannot toggle — admin-only while paywall is off.

**Alternative:** keep `is_sponsored` and add a separate `is_general_ad`.
Rejected — the client confirmed they are the same concept, and carrying
two booleans would create contradictory state.

### S6.2 · Event tier column grants — admin-only at the DB boundary

`is_premium`, `is_general_ad`, and `premium_at` on `events` were writable
by any event owner via the RLS `p_events_write` policy (which checks
`owner_id = auth.uid() OR is_admin()`). The server actions hid the
controls from non-admins, but a motivated ED could call `.update()`
directly and self-promote their event.

**Fix (migration `20260718000002`):** revoke blanket UPDATE/INSERT on
`events` from `authenticated`; re-grant on all columns except the tier
flags and denormalized aggregates (same pattern as profiles/reviews
column grants in the baseline). Two SECURITY DEFINER RPCs
(`admin_set_premium`, `admin_set_general_ad`) with `is_admin()` entry
checks are the only write path. Server actions now call the RPCs
instead of `.update()`.

**Probes:** `event-tier-escalation.test.ts` — 5 cases (ED direct
UPDATE denied × 2, ED RPC denied × 2, admin RPC succeeds × 1).

**Alternative:** application-level `is_admin()` check in the server
action. Rejected — RLS is the security boundary per CLAUDE.md; client
checks are UX only. Column grants enforce at the DB so even a direct
PostgREST call can't bypass.

### S6.3 · Spotlight column filter corrected — end_date > now − 25 days

The initial build filtered the Spotlight column on `lifecycle = 'active'`
AND `start_date >= today`. The correct rule (decoded from the Bubble
spec, item A1) is: `is_general_ad = true` AND lifecycle is NOT draft or
canceled AND `end_date > now − 25 days`. This shows events that ended
up to 25 days ago, ongoing events, and upcoming events — broader than
"future only" so recently-concluded events stay visible briefly.

Card fields updated: date range (start – end), city + state code
(instead of full location_formatted), and a favourite heart button.

### S6.4 · start_date / end_date stay nullable — publish enforces

Dates are nullable for drafts (a draft requires only a title) and
required at publish via server-side validation. The Spotlight filter
already excludes drafts, so every published event reaching the filter
has an `end_date` — no DB NOT NULL constraint is needed. The existing
`end_after_start` CHECK constraint passes when either date is null,
which is correct for drafts.

**Alternative:** NOT NULL on both columns. Rejected — drafts don't
require dates, and forcing them would break the "a draft needs only a
title" rule.

### RG1.C3 · Claim approve parked

The `approve_claim_request` RPC exists and is tested (claim-flow
probes), but the feature isn't ready for production use — the admin
workflow still needs manual verification steps before ownership
transfer. The Approve button is visibly disabled and the server action
short-circuits with an error message. Decline remains functional so
admins can still reject bad claims.

**Alternative:** leave Approve live. Rejected — premature ownership
transfer in production could reassign events to the wrong ED with no
undo path.

### S8.1 · Review eligibility model — attendee-only writes + paid-only guru

**What:** reviews INSERT policy tightened to attendee-type, non-blocked
users only. EDs and admins are denied at the RLS boundary, not just
the UI. The `apply_promo_to_review` RPC now rejects promo applications
on non-paid events (requires `is_premium` or `is_general_ad`).

**Why:** the scope doc (SCOPE-review-eligibility.md) defines reviews as
an attendee activity; EDs interact via replies on their own events,
admins via moderation (edit/delete). The paid-event guru gate prevents
verified badges from appearing on free listings (the promo model only
makes sense for paid tiers).

**Alternative:** allow EDs/admins to write reviews (old behavior). Rejected
— conflates the reviewer and platform-operator roles. An ED reviewing
events (including competitors') is a conflict of interest the platform
should prevent at the DB, not rely on UI to hide.

### S8.2 · Default table grants fix for `supabase db reset`

**What:** migration 20260718000005 sets `ALTER DEFAULT PRIVILEGES FOR ROLE
postgres` to match the `supabase_admin` defaults, then retroactively
grants on all existing tables + re-applies column-level restrictions
(profiles, reviews, events).

**Why:** `supabase db reset` runs migrations as the `postgres` role, whose
default privileges only grant DELETE/TRUNCATE/TRIGGER/REFERENCES — not
SELECT/INSERT/UPDATE. Tables created during reset lacked basic access
for `authenticated` and `service_role`, breaking all RLS-gated reads and
writes. Also fixed: `dob` and `preferences_completed` added to the
profiles UPDATE column grant (both are written by the authenticated
client during onboarding).

**Alternative:** run migrations as `supabase_admin`. Not possible with the
local CLI's `db reset` command.

### S8.3 · Business contact fields for EDs

**What:** Added `business_phone`, `business_email`, `business_website`
columns to `profiles`. Exposed through the `public_directors` definer
view (security_invoker = false) so the auth email is never leaked. The
event detail ContactPanel renders them when populated; EDs set them in
Account → Profile.

**Why:** The spec calls for phone/email/website in the host sidebar, but
the only email on the profile was the auth email, which is PII. A
separate set of designated public-contact fields keeps the auth email
private while giving EDs a way to surface a business inbox.

**Alternative:** Store contact info per-event (on `events` table). Rejected
because it duplicates across every event and the spec ties it to the
host identity, not the event.

### S8.4 · FAQ system — audience-targeted with two-gate visibility

**What:** Upgraded the `faqs` table from a simple enum audience column to
a child table (`faq_audiences`) supporting per-type + per-role targeting.
Added `status` (draft/published) and `is_visible` columns as independent
gates: an entry must be both published AND visible to appear outside the
admin page. Admin CRUD at `/dashboard/faqs`; viewer at `/dashboard/faq`
(attendee + ED, filtered by type/role); public `/faq` shows all
published+visible entries.

**Why:** The scope calls for role-level granularity (Coach vs Team Manager
vs Parent) and a separate visibility toggle independent of draft status.
The old `faq_audience` enum couldn't represent per-role targeting.

**Alternative:** Keep the enum and add role filtering as a separate
column. Rejected because it couples audience cardinality to the enum
definition and can't represent "attendee:coach + event_director:all".

### S8.5 · Public projection views are read-only at the grant layer

**What:** migration 20260718000008 revokes INSERT/UPDATE/DELETE (plus
TRUNCATE/REFERENCES/TRIGGER) on every view in `public` from `anon` and
`authenticated`, leaving SELECT. Supersedes the grant description in
[S8.2](#s82--default-table-grants-fix-for-supabase-db-reset).

**Why:** 20260718000005's `grant all on all tables in schema public`
also hit views — in Postgres `ALL TABLES` includes them. The `public_*`
views carry no RLS of their own and are declared `security_invoker =
false` with `postgres` as owner (which has BYPASSRLS), so a write
through an auto-updatable view executes as the owner and skips RLS on
the base table. Table-level grants are therefore the *only* access
control on them. `public_directors` and `public_event_owners` are
single-table selects and thus auto-updatable, so `anon` could UPDATE or
DELETE rows in `profiles` holding nothing but the public anon key —
verified end-to-end against the REST API (`PATCH → HTTP 204`, write
landed in the base table; `DELETE` orphaned the director's events).
The baseline granted SELECT only (20260716000001 l.1011); 000005
silently widened it.

The revoke loops over all views rather than enumerating, so the two
currently non-auto-updatable views are covered if their definitions are
ever simplified to a single table.

**Tripwire:** `tests/probes/h1-public-views.test.ts` gained an `it.each`
write-denial matrix (anon + authenticated-non-owner × UPDATE/DELETE/
INSERT × all four views) plus a base-table assertion. Verified
non-vacuous by mutation: re-granting write makes 8 of those tests fail.
The helper rejects a 42703 (undefined column) result explicitly, because
that would mean the probe never reached the privilege check — the same
false-green shape found in the c2 probe during the turbo-check.

**Known gap:** 000005's `alter default privileges ... on tables` still
grants write on views created *after* it, so a new view starts out
writable. The probe's `PUBLIC_VIEWS` list must be extended when a view
is added; that list is the guard.

**Alternative:** set `security_invoker = true` on the views. Rejected —
these views exist precisely to expose a narrow public projection of
RLS-protected rows to anon, which invoker semantics would break.

### S8.6 · Support-page FAQ ported to the new schema + a schema-drift probe

**What:** `/dashboard/support` was still selecting `faqs.body` and
`faqs.audience`, both removed by [S8.4](#s84--faq-system--audience-targeted-with-two-gate-visibility)
(20260718000007 renamed `body`→`content` and dropped `audience`). The
query now mirrors `/dashboard/faq`: two-gate filters (`status =
'published'` and `is_visible`) plus audience targeting via the
`faq_audiences` child table, and it throws on error instead of
discarding it. Added `tests/probes/schema-drift.test.ts`.

**Why:** three things had to line up for this to ship green. The error
was discarded (`const { data } =`), so PostgREST's 42703 became `null`
→ `data ?? []` → an empty list. The result was cast with
`as unknown as`, so `tsc` saw nothing. And the empty state read *"We'll
add answers here soon"* — indistinguishable from success. Every
attendee and ED saw a permanently empty FAQ list for a full release.

The root cause is structural: the DB boundary is untyped, so no static
check can see column drift. The probe replays every
`.from(t).select(c)` pair in `app/` and `lib/` against the live DB with
`limit(0)` — PostgREST parses the select natively, so a dropped or
renamed column fails as 42703 there. 134 sites covered; selects built
from template literals are skipped and logged so the blind spot stays
visible. Verified non-vacuous by mutation: restoring the old column
list fails the probe with the exact original error.

**Note:** this page's FAQ block now duplicates `/dashboard/faq`, which
sits directly above it in the same nav section. Fixing was chosen over
deleting to keep the change reversible; consolidating the two surfaces
is tracked in TURBOCHECK.md (M-3).

**Alternative:** generate types via `supabase gen types typescript` and
type the clients. Strictly better and still worth doing, but it is a
repo-wide change; the probe delivers the same regression coverage for
this class today without touching 155 call sites.

### S8.7 · Account profile saves are partial, not whole-row

**What:** `updateProfile` and `updateNotificationPrefs` now write only
the columns whose inputs were actually submitted, instead of writing
every column on every save.

**Why:** the profile form renders different field sets per role — the
location autocomplete, gender radios and organization field are wrapped
in `{!isAdmin && …}`, and the business-contact block in `{isEd && …}`,
all inside one `<form>`. The action read every field unconditionally, so
an unrendered input arrived as `""`, became `null` via `|| null`, and
overwrote real data. `parseGeoFields` compounded it by returning all-null
when its hidden inputs were absent. An admin correcting a typo in their
last name silently nulled `location_formatted`, all seven `location_*`
columns, `user_gender` and `organization_title` — and the action returned
*"Profile updated."*

Presence in the FormData is the signal: a rendered-but-emptied field is
still present, so deliberate clears keep working. Notification prefs
need a different signal, because an unchecked box is absent exactly like
an unrendered one — each `NotifRow` already emitted a
`section:<name>` hidden marker (previously unread), so that now gates
which pairs are written.

**Tripwire:** `e2e/account-partial-save.spec.ts` drives the real form and
the real Server Action as an admin, then reads the row back with the
service role. It asserts the location input is genuinely absent first, so
the test can't pass for the wrong reason, and a second case asserts a
deliberately-emptied field still clears. Verified non-vacuous by
mutation: restoring the unconditional write fails with
`Expected "Kansas City, MO" / Received null`.

**Alternative:** render the hidden fields as disabled inputs carrying
current values. Rejected — it ships every user's stored location and
gender to the client on a page that deliberately hides them.

### S8.8 · searchEvents surfaces facet errors; filter input is allow-listed

**What:** every query in `lib/events/search.ts` — the five facet
sub-queries, the distance prefilter, the main events query, the two
enrichment reads, and `getEventFacets`' states read — now routes through
a checked `unwrap()` / `unwrapRows()` (`lib/supabase/unwrap.ts`). In the
same change, user-supplied filter values are normalized before any query
runs: unknown facet values are dropped against the enum allow-lists,
malformed dates are ignored, and the `q` ilike patterns are
double-quoted for PostgREST's `or()` grammar.

**Why:** the earlier searchEvents fix guarded only the last of its six
queries, and the facet sub-queries routed failures *around* that guard —
a facet error became an empty id set, which became `.eq("id",
ZERO_UUID)`, which made the guarded query succeed with 0 rows. An RLS or
schema change on any facet table would silently blank every filtered
search (TURBOCHECK H-0). Surfacing those errors exposed a coupled hole:
the facet columns are Postgres enums and both routes pass raw URL values
into `.in()`, so a hand-edited `?genders=zzz` raises a real 22P02 —
which post-fix would be a user-triggerable 500. The two halves must land
together: once user input cannot manufacture a query error, every error
that remains is a genuine infrastructure failure and throwing is
correct. The same sweep fixed a live pre-existing bug: a `q` containing
a comma or paren broke the `or()` grammar and 500'd the events page.

**Behavior change:** a filter carrying only unknown values previously
returned 0 events (via the swallowed enum-cast error); it now behaves as
if that filter were unset — the same convention both routes already
apply to an invalid `sort` or `dist`.

**Tripwire:** `tests/probes/h0-search-error-surfacing.test.ts` runs the
real `searchEvents` under vitest (new `@/` + `server-only` aliases in
`vitest.config.ts`); the client factory is mocked to wrap a real
local-stack client in a proxy that rewrites one table name per test to a
nonexistent one, so each failure is a genuine PostgREST error that hits
ONLY the targeted sub-query while the main query stays healthy — exactly
the case that used to slip through. Verified by mutation: reverting
`search.ts` to the pre-fix version fails 10 of 15 cases.

### S8.9 · The error-surfacing class: every fail-open read routed through unwrap

**What:** all 21 live "class A" query sites — public/user-facing reads
whose failure rendered as a plausible empty state or 404 — now route
through `unwrap()`/`unwrapRows()`: the director pages
(`lib/directors/queries.ts`, all 11 sites), the public event page
(`loadEvent`), the review-write picker, both FAQ viewers and the FAQ
admin list, the public directors index, favorites, activity, the
moderation queue, admin users, support messages, banned words, the ED
review scoping read (the H-0 ZERO_UUID shape again), the account page
self-reads, and `getEventForEdit`'s seven child reads (whose failure
would load an empty form section that the replace-all save then
persists as a deletion). `lib/reviews/queries.ts`' identity/promo
enrichment helpers and `fetchBannedWords` throw too — a failed
banned-words read had silently disabled the moderation filter.

Two designed degraded states are kept but made LOUD via
`unwrapRowsLogged`: landing chrome (`fetchPopularSearches`,
`fetchFeaturedEventRows`, `fetchFeaturedEvents`, `fetchDemoReviews`,
the dashboard Spotlight column) renders empty on failure but always
logs. `getEventDirectors` now returns `source: "unavailable"` on a
query failure — reaching the About grid's "temporarily unavailable"
branch that was designed in `app/components/types.ts` and never
connected (TURBOCHECK M-21) — instead of the lying "no directors yet".

**Deliberately left (with reasons):**
- ~35 authz/guard reads that fail CLOSED (error → deny/redirect) —
  correct as written; surfacing would trade a safe denial for a 500.
- The middleware blocked-user check (`lib/supabase/proxy.ts`) and the
  login blocked-check fail OPEN on a query error. Making them
  fail-closed could sign users out on transient errors on every
  request — an availability trade-off that needs a product decision.
- Server Actions whose WRITE errors are dropped (saveEvent child
  deletes/inserts, faq_audiences writes, updateTeams distance_pref) —
  a different class (dropped write errors), tracked for a future item.
- `fetchFeaturedEvents` / `fetchDemoReviews` appear to have no
  importers (landing uses `fetchFeaturedEventRows` + static demo
  data) — dead-export cleanup left for a consolidation pass.

**Tripwire:** `tests/probes/error-surfacing.test.ts` — same real-error
proxy mechanism as the H-0 probe, pinning all three contracts (throw /
designed-degrade-with-marker / logged-degrade) on representative
functions. Verified by mutation: reverting the four probed modules
fails 8 of 10 cases.

### S8.10 · Moderation-row cleanup moved to the DB (orphaned flags, H-4)

**What:** `flagged_content` and `content_hidden` are now purged by
AFTER DELETE triggers on `reviews` and `comments`
(`purge_moderation_rows()`, migration `20260718000009`). The app-side
cleanup in `deleteFlaggedContent` — the only path that had any — was
removed as redundant; `deleteReview`, `deleteComment`, owner-reply
replacement, and every future delete path are covered automatically.

**Why:** both tables are polymorphic (content_type + content_id), so no
FK cascade can exist and cleanup was app code's job — 6 delete paths, 1
partially covered. An orphaned flag row is worse than dead weight: the
moderation queue lists it, joins it against content that no longer
exists, and renders nothing — an entry no admin can see or dismiss.
Patching call sites is how it got to 1-of-6; row-level triggers cover
cascaded deletes (review → comments, comment → child replies) that app
code structurally cannot see. SECURITY DEFINER because the deleting
user (a reviewer removing their own review) is not allowed to delete
other users' flag rows; EXECUTE revoked per the RG1 trigger-function
convention and added to the c2 revocation guard.

**Tripwire:** `tests/probes/flag-orphans.test.ts` — drives deletes
through the real roles (the reviewer's own client) and asserts zero
moderation rows survive, including a whole-table orphan sweep. Verified
by mutation: dropping the two triggers fails all 3 cases; a from-zero
`supabase db reset` rebuilds green.

### S8.11 · Account actions revalidate like the rest of the app (H-8)

**What:** `updatePassword` now enforces the full `validatePassword`
policy (8 chars + uppercase + digit) server-side instead of only
`length >= 8`, and `updateProfile` runs `business_email` through
`validateEmail` before storing it.

**Why:** the client showed the strict rule while the server accepted
weaker input — "the server is authoritative" is this project's stated
convention, and signup + reset both already enforce the same policy, so
a crafted request to the account action was the one door where a
non-conforming password could enter. `business_email` is the same
asymmetry one field over: rendered publicly on event pages, stored with
no validation at all.

**Tripwire:** `tests/probes/h8-password-validation.test.ts` drives the
real Server Actions against real local auth: a weak password returns a
field error AND provably never lands (sign-in with it still fails; the
original still works); a malformed business_email returns a field error
and writes nothing. Verified by mutation: reverting the action file
fails 3 of 5 cases.

### S8.12 · /api/search-log: handled 204s + the missing app-layer rate limit (H-5)

**What:** the route's empty/malformed-input responses are now a bare
`new Response(null, { status: 204 })`, and the endpoint is wrapped in
`rateLimit()` (30/min per client key) ahead of body parsing.

**Why:** `NextResponse.json({...}, { status: 204 })` throws — 204 is a
null-body status — and the catch block re-executed the same illegal
construction, so every empty or malformed POST became an uncaught 500.
No user impact (the caller fire-and-forgets), but it polluted logs with
fake 500s that mask real errors. Separately, this was the only
unauthenticated write endpoint with no `rateLimit()` call, violating
the stated two-layer rule (the DB trigger caps the table at 1000/min
globally; the app layer caps per-IP bursts).

**Tripwire:** `tests/probes/h5-search-log.test.ts` invokes the real
route handler: empty term and malformed JSON resolve to bodyless 204s
(previously: rejected), a valid term persists, and the 31st burst
request from one IP gets a 429 with Retry-After. Verified by mutation:
the pre-fix route fails 3 of 4 cases.

### S8.13 · HostAvatar folded into the shared Avatar primitive (M-17)

**What:** the event page's host identity avatar now renders through
`app/components/Avatar` (`src` prop) instead of a private `HostAvatar`
wrapper; the wrapper is deleted.

**Why:** the wrapper flipped container shape on data presence — a
rounded-xl `object-contain` square when a logo existed, the circular
`Avatar` fallback when it didn't — bypassing the primitive's `src`
path, which already handles images with the design system's
`rounded-full` + `object-cover` rules. Shape depending on data
presence is exactly the drift the shared primitive exists to prevent.

**Tripwire:** an e2e case in `e2e/discovery.spec.ts` loads a seeded
event whose director has an org logo and asserts the host avatar image
is `object-cover` inside a `rounded-full` shell. Verified by mutation:
restoring the old wrapper fails it.

### R2.5 · user_teams "permission denied" — probe locks the grant contract; step-3 delete checked

**What:** Round-2 #5 ("permission denied for table user_teams" on ED
onboarding step 3) root-caused to the postgres-default-privileges grant
gap already fixed by migration 20260718000005 — the live demo hit it
during the window when its DB stopped at 20260718000003. No new
migration needed: fresh-DB grants verified correct locally, and anon
probes against the hosted demo confirm the grant is present there now
(INSERT fails on RLS, not privilege). Added
`tests/probes/user-teams-grants.test.ts` (own insert/read/delete
allowed; cross-profile insert/read/delete denied) and surfaced the
previously swallowed `user_teams` delete error in `saveStep3`.

**Why:** the probe suite had no coverage on user_teams at all, so this
grant class could regress silently — onboarding step 3 was the only
detector, and only when a user actually filled team slots: the
replace-all delete's error was discarded, which is exactly why
attendees who skipped teams never saw the break while EDs filling
teams did.

**Tripwire:** verified by mutation both ways — `revoke insert on
user_teams from authenticated` fails 3 of 4 cases; loosening
`p_user_teams_self` to `using (true) with check (true)` fails 2 of 4.
Restored state green.

**Demo follow-up (out of scope here):** seeded @example.test accounts
500 on sign-in against the hosted demo (GoTrue chokes on SQL-seeded
auth.users rows missing the non-null token columns); bogus creds get a
clean 400, so auth itself is healthy. Needs a seed.sql fix + re-seed.

### R2.7 · Gender search: "both" is a union value, not an opaque tag

**What:** the search gender facet expands its match set instead of a
literal `IN`: selecting Both matches boys-, girls-, and both-tagged
events, and a coed ("both"-tagged) event now also satisfies a Boys or
Girls search.

**Why:** Round-2 #7 — "Both" returned nothing because no seeded age
group is literally tagged 'both'. Fixing only the reported direction
would leave the mirror asymmetry (a coed event invisible to a Boys
search) which reads as the same bug. The symmetric union is the only
coherent semantic for "events my team can attend". Alternative
(rejected): make Both mean "has BOTH boys and girls rows" — that's an
intersection nobody asked for and still hides coed events.

**Tripwire:** `tests/probes/search-gender-both.test.ts` seeds
boys/girls/coed events and pins all three directions + a no-filter
control. Verified by mutation: reverting to the literal `IN` fails 3
of 4 cases.

### R2.9 · Modal focus-on-open effects must not depend on callback identity

**What:** FilterDrawer's open-effect (Escape listener + body-scroll
lock + initial ✕ focus) now depends only on `open`; `onClose` rides a
ref. Same treatment for ConfirmDialog's mount effect.

**Why:** Round-2 #9 — typing in the drawer's distance box patched the
filter state upstream, the parent re-render handed FilterDrawer a
fresh inline `onClose`, and the effect re-ran `closeRef.current?.focus()`
— stealing focus to the ✕ after every keystroke. Not a remount: the
input's state survived; only focus moved. Any modal whose
focus-on-open effect lists a callback prop in its deps has this class
of bug (EventSearchOverlay already did it right with `[open]`).

**Tripwire:** e2e "filter drawer distance box keeps focus across
keystrokes" types 6 chars and asserts focus + full value. Verified by
mutation: restoring `[open, onClose]` deps fails it.

### R2.1 · Contact success card scrolls itself into view

**What:** ContactForm's SuccessCard runs a mount effect —
`scrollIntoView({ block: "center" })`.

**Why:** Round-2 #1 — submitting swaps the ~1.4k-px form for a short
card; on stacked (sub-lg) layouts the browser clamps the stranded
scroll offset to the new page bottom, so the user lands on the footer
with the confirmation ~100px above the fold (measured 768×540:
heading at −99px, scrollY pinned to exactly docHeight−viewport). The
card owns the scroll because only it knows it replaced the form.

**Tripwire:** e2e "contact submit keeps the confirmation in view"
(768×540, pre-scrolled to bottom) asserts the heading is in the
viewport. Verified by mutation: emptying the effect fails it.

### R2.12 · Global focus ring must not carry `border-radius: inherit`

**What:** dropped `border-radius: inherit` from the `*:focus-visible`
rule in globals.css; the outline follows the element's own radius
natively.

**Why:** Round-2 #12 — `inherit` replaced the FOCUSED element's radius
with its parent's. The sort-by `<select>` (rounded-[10px] inside a
plain label) went square while focused and snapped back on blur;
Chromium marks a clicked <select> :focus-visible, so mouse users saw
it too. Every rounded control inside a square wrapper had the same
latent glitch on keyboard focus. The line predates evergreen outline
radius-following and served no purpose current browsers need.

**Tripwire:** e2e "sort-by select keeps its border-radius while
focused" asserts computed border-radius 10px before and during focus.
Verified by mutation: re-adding the line fails it.

### R2.4 · Date entry is a masked mm/dd/yyyy input, not native `type="date"`

**What:** new `USDateText` / `USDateField` primitives
(app/components/ui/USDateInput.tsx): visible text always mm/dd/yyyy,
progressive slash mask, forms/callers receive ISO (hidden input or
`onIsoChange`, "" until the date is complete AND real). Swapped in on
the onboarding DOB and both filter-drawer date boxes.

**Why:** Round-2 #4 — native date inputs render their placeholder in
the BROWSER's locale (a UK browser shows dd/mm/yyyy whatever the page
does); there is no attribute to force US format, so a masked text
input is the only reliable fix. Trade-off, accepted: those fields lose
the native calendar popup — fine for a DOB (typing beats scrolling
back decades) and for filter dates (presets cover the picker cases).
ED dashboard forms (EventForm dates) intentionally keep native pickers
— internal tooling, calendar genuinely useful there.

**Tripwire:** unit tests pin the mask + both conversions (leap day,
Feb 30, month 13); onboarding e2e types US format through the real
wizard (advance + under-18 block) and asserts the mm/dd/yyyy
placeholder; drawer e2e asserts mask formatting + preset adoption
through the controlled ISO prop.

### R2.10 · Search loading = dim + floating "Searching…" pill, not skeletons

**What:** while a results fetch is in flight, EventsSearch overlays a
centered white pill (tg-spin ring + "Searching…") over the dimmed
results; pointer-events-none so stale results stay clickable.

**Why:** Round-2 #10 — the opacity dim alone read as "nothing is
happening"; the only signal was the "…" in the events-count chip.
Skeleton cards were rejected: results usually resolve in well under a
second locally, and the page deliberately KEEPS the previous results
during a fetch (S8.8 error-preserving behavior) — skeletons would
throw that context away. Also corrected STYLE-GUIDE §5: it listed a
Spinner primitive that was never built.

**Tripwire:** e2e holds /api/events/search for 1.2s via route
interception and asserts the pill is visible mid-flight and hidden
after resolve.

### R2.3 · Signup success is a redirect to /signup/verify-email, not a banner

**What:** `signupAction`'s confirmations-on branch redirects to a new
standalone screen (AuthShell + mail icon + 3-step next-steps + sign-in
CTA) instead of returning `{ info }`; the in-form green SuccessBanner
and the reset-on-success key-remount are removed as dead code. The
session branch (local dev) still goes straight to /onboarding, and
failed submits still preserve typed values.

**Why:** Round-2 #3 — after "Account created" the user sat on the
emptied signup form, which read as "did that work?". A dedicated
screen makes the state unambiguous. No email address rides the URL
(privacy rule: nothing personal in query strings), so the copy is
generic. Reset-on-success is now trivially true: the form unmounts.

**Tripwire:** probe `signup-verify-redirect` drives the real action
(mocked auth client): no-session → NEXT_REDIRECT /signup/verify-email,
session → /onboarding, invalid input → field errors with no redirect;
reverting to the banner return fails it. e2e renders the screen.

### R2.2 · Contact success card: expectation + next actions, heading rides the form

**What:** richer "Message sent!" state (halo badge with send accent,
"typically reply within 1–2 business days" chip, Browse-events primary
CTA + Back-to-home ghost). The card's "Send us a message" heading +
subtitle moved from the page into ContactForm so they swap out with
the form — the old layout kept "Fill out the form…" above the success
card.

**Why:** Round-2 #2 asked for a more engaging confirmation; the
useful upgrades are a reply-time expectation and somewhere to go next
(the product's core action), not decoration.

**Tripwire:** contact e2e asserts the reply-time chip + Browse-events
CTA on the success state; screenshot-verified at card level.

### R2.6 · Step-3 team slots: numbered card + progressive disclosure

**What:** Team 1 renders as a card with a numbered-badge header;
Teams 2–3 sit behind native `<details>` "+ Add Team N · optional"
affordances that auto-open when a failed submit preserved their
values. Fields split into TeamSlotFields; the form contract
(team_N_gender/age/level radios + selects, uncontrolled) is unchanged
— collapsed slots simply post empty values.

**Why:** Round-2 #6 — three identical always-expanded cards read as a
wall of controls on an all-optional step. Native <details> keeps the
disclosure dependency-free and the inputs in the DOM, so no client
state or serialization changes.

**Tripwire:** ED onboarding e2e asserts Team 1 + "Add Team 3" visible,
expands Team 2, fills both, and verifies the exact user_teams rows
land via the service role. Screenshot-verified.

### R2.11 · Broken remote images unmount to fallbacks (SafeImg)

**What:** new `SafeImg` primitive (ui/SafeImg.tsx): an `<img>` that
swaps to a caller-supplied fallback on load error, keyed by src so a
changed URL retries. Adopted at every DB/remote-URL image site — both
Avatars (→ initials), EventCard + card-bits + EventSearchOverlay +
event-page hero/photos/sponsors, SpotlightColumn, activity/favorites
thumbs, director pages, testimonials. DirectorPortrait already had its
own onError and stays. EventCard's logo also moves OFF next/image:
logos live on arbitrary per-event hosts and the optimizer only accepts
allow-listed hostnames (same reasoning parts.tsx already documented),
so next/image there was a latent crash for real ED-supplied URLs.

**Why:** Round-2 #11 — seeded and future dead URLs (two seed unsplash
photos 404 today) painted the browser's broken-image glyph over
otherwise-designed fallbacks. The fix is one mechanism at the leaf,
not per-site patches; "no image" and "broken image" now render
identically.

**Tripwire:** e2e loads /events, confirms unsplash logos render, then
aborts all unsplash requests and asserts every such <img> unmounts.
Verified by mutation: no-op'ing SafeImg's onError fails it.

### R2.13 · Wide list cards reflow the rating pools; the reposition is Danny's call

**What:** featured cards' Coach/Attendee pools switch from a stacked
`items-stretch` column to a single row via a container query
(`@4xl:` = card ≥ 56rem — map-hidden list cards only; map-visible
~800px cards and grid cards stay stacked). Coach still leads.

**Why:** Round-2 #13 — with the map hidden the stacked pools
stretched into ~900px strips. Reflow uses the width instead of
capping it, and a container query keys off actual card width, not
viewport. NOT BUILT (explicitly Danny's decision, do not build
speculatively): the deeper reposition — Claim CTA under the logo,
host/location moved under the title (the truncation the reporter also
saw lives there).

**Tripwire:** e2e at 1440px asserts the pools are stacked with the
map visible and share a row after "Hide map". Verified by mutation:
removing the @4xl classes fails it.

### SEED.1 · Demo seed: GoTrue-complete auth rows + true re-run idempotency

**What:** the `auth.users` insert in `supabase/seed.sql` now sets the
eight GoTrue token columns (`confirmation_token`, `recovery_token`,
`email_change`, `email_change_token_new`, `email_change_token_current`,
`phone_change`, `phone_change_token`, `reauthentication_token`) to `''`
and pairs every user with an `auth.identities` row (email provider,
`identity_data` carrying sub + email, derived from the users insert so
ids can't drift); the cleanup preamble deletes the fixed-UUID demo rows
in dependency order before `auth.users`; the final sync recomputes all
three platform counters instead of one. The fixed UUIDs stay — the rest
of the seed references them as owner/author ids, which is why the rows
are raw-inserted rather than created via the Auth admin API (it cannot
set a chosen id).

**Why:** GoTrue scans those columns as non-null Go strings — rows
inserted with their `NULL` column defaults make every
`signInWithPassword` for that account return a 500
`AuthRetryableFetchError`, which is exactly what the hosted demo did
for all `@example.test` accounts (verified 2026-07-18; bogus
credentials still returned a clean 400, so GoTrue itself was healthy).
Reproduced locally from a clean reset on the old seed: HTTP 500
`unexpected_failure` "Database error querying schema", with the GoTrue
log naming the mechanism — `sql: Scan error on column
"confirmation_token": converting NULL to string is unsupported`. The
test suite never caught it because every test creates users through
the Auth admin API (which fills in GoTrue's internals), never through
seed.sql.
Separately, the old preamble's single `delete from auth.users` never
actually made re-runs safe: reviews and tournaments survive account
deletion (author/owner FKs are `on delete set null`), so their fixed
UUIDs collided on re-insert — and the delete itself died mid-cascade,
because `trg_helpful_count`'s UPDATE on reviews trips the
`reviews_promo_fk` re-check at the point where the promo row is already
deleted but its SET NULL action hasn't run. Deleting reviews first,
then tournaments, then users sidesteps both. The S8.1 counters only
ever increment (deliberately durable), so a delete + recreate cycle
must recompute them from live rows.

**Tripwire:** probe `tests/probes/seed-accounts.test.ts` signs in as
one seeded attendee, ED, and admin via the password grant and asserts a
session + an `email` identity — the only suite coverage of
seed.sql-created accounts. Verified by mutation: nulling
`confirmation_token` on one account fails exactly that account's test.
Also verified manually: `supabase db reset` followed by two consecutive
`psql -f supabase/seed.sql` runs into the live DB — 0 errors, row
counts stable at exactly one seed's worth (10 users / 5 tournaments /
9 events / 6 reviews), 10 identities, counters exact, all 10 accounts
sign in with HTTP 200.

### R2.11b · SafeImg catches image failures that beat hydration

**What:** SafeImg's `<img>` gets a mount callback-ref that flips to the
fallback when the element is already dead (`complete === true` with
`naturalWidth === 0`), alongside the existing onError. ui/Avatar and
DirectorPortrait drop their private onError/state and render through
SafeImg, so the class has exactly one implementation.

**Why:** the "broken logo" e2e failed with 6 unsplash imgs surviving.
DOM inspection showed all 6 WERE SafeImg-rendered with dead fetches —
and re-assigning src post-hydration made all 6 unmount, proving the
handlers were attached but the original error events fired BEFORE
hydration on the server-rendered page and never re-fired. Real product
gap, not a test artifact: any URL that 404s faster than hydration left
a permanent broken glyph. onLoad's mirror (already-loaded images) needs
no handling — a loaded img simply stays.

**Tripwire:** the existing e2e (abort unsplash before goto, scroll the
page, expect zero unsplash imgs) now exercises exactly this race.
Verified by mutation: removing the ref check (keeping onError) fails
it; restored, 14/14 discovery + 63 e2e + 285 vitest green.

### S9.1 · Demo schema drift closed at the pipeline (auto-migrate workflow)

**What:** `.github/workflows/demo-migrate.yml` — a `workflow_run`
listener that fires when the CI workflow completes successfully for a
push to `rebuild`, checks out the exact CI-validated commit, and runs
`supabase db push --db-url "$SUPABASE_DEMO_DB_URL"` (CLI pinned 2.98.2,
same as ci.yml). Concurrency-serialized; read-only GITHUB_TOKEN; the
target lives ONLY in the repo secret, never in the file.

**Why:** Vercel deploys code, not DB — the hosted demo drifted behind
supabase/migrations/ twice, producing demo-only bugs (empty search;
the R2.5 "permission denied for table user_teams" window). Gating on
CI's conclusion means a red build can never migrate the demo, and
`db push` applying only pending migrations makes re-runs no-ops.
Deliberately NOT included: seeding — `--include-seed` would drop and
replace demo data, so reseeds stay manual (DEPLOYMENT §10). Chose
`--db-url` over link+access-token: one secret, no `supabase link`
(which this repo bans as a foot-gun), no third-party auth surface.

**Verification:** YAML parse + scripted assertions on the gate
(conclusion/event/head_branch), the pinned CLI, the single supabase
command line (no seed flag, secret only via env). First live run needs
the secret set — Danny verifies run #1 in Actions.

### S9.2 · Event base row writes with INSERT/UPDATE, never `upsert`

**What:** `saveEvent` no longer writes the base event row with a single
`upsert`. It branches: `.insert(row)` for a new event, and
`.update(row).eq("id", eventId)` for an existing one. The `id` never
travels in the payload.

**Why:** PostgREST compiles `upsert` to `INSERT … ON CONFLICT (id) DO
UPDATE SET <every payload key> = excluded.<key>`, and the edit path put
`id` in the payload so it landed in the SET list. `id` is deliberately
absent from the events UPDATE column grant (000002 / 000005) — allowing
a client to repoint a row's primary key is not an edit — so Postgres
denied the whole statement: "permission denied for table events". Every
event EDIT and every publish-an-existing-draft failed; only creation
worked, because a new event carries no `id` and therefore no SET entry
for it. The fix keeps the grant tight and changes the caller instead.

**Alternative rejected:** granting `update(id)` on events. That would
let any owner rewrite a row's primary key — a far worse trade than
splitting one call into two.

**Verification:** `tests/probes/event-edit-grants.test.ts` drives the
real action as a real ED (update-intent save persists; publish flips
lifecycle to active; a direct `update({id})` is still denied).
Mutation-verified: restoring the `upsert` fails 2/3 with exactly
"permission denied for table events".

**How it hid:** no e2e covered the ED edit/publish path — only creation.
Coverage gap recorded in docs/TESTING.md.

### S9.3 · Dropped WRITE errors — failures must reach the caller

**What:** `firstWriteError(results, context)` in `lib/supabase/unwrap.ts`
— the write-side sibling of `unwrap`. It returns the first failure in a
batch as a message (Server Actions report through their return value,
so it yields a string rather than throwing) and logs it. Applied to
`saveEvent`'s replace-all child deletes + inserts and `duplicateEvent`'s
child reads + inserts; the read-drives-write sites in the same paths
(caller role, `is_premium` cap, existing `tournament_id`) now return
their error instead of degrading to a default.

**Why:** these batches fanned out through `Promise.all` and nobody read
the resolved array, so a failed write reported success. It is worse than
the read-side class (S8.9): replace-all deletes then inserts, so the
delete half can land while the insert half fails — the collection is
gone AND the ED is told the event saved. The read-drives-write sites are
the same failure wearing a different hat: a failed role read made an
admin look like an ED and stamped `owner_id`, making the event
permanently unclaimable.

**Known limitation (accepted, not fixed here):** the replace-all is
still not atomic. Surfacing the error tells the ED to re-enter the
collection; it does not roll the delete back. Making it transactional
needs a SECURITY DEFINER RPC that takes the whole event graph — a real
rework, deliberately out of scope for an error-handling pass. Revisit
if partial saves show up in practice.

**Verification:** `tests/probes/write-error-surfacing.test.ts` breaks
ONE table for ONE verb through a proxy, so the delete batch and the
insert batch are pinned separately (breaking the table outright always
trips the delete first and leaves the insert batch untested).
Mutation-verified in three passes — unchecked deletes, unchecked
inserts, unchecked duplicate — each failing exactly its own tripwires.

### S9.4 · faq_audiences + updateTeams replace-all errors surfaced

**What:** the two remaining paths the S9.3 class named. `upsertFaq`
checks its `faq_audiences` delete + insert (and the duplicated
create/edit insert branches collapse into one, since validation already
guarantees a non-empty audience list). `updateTeams` checks the
`distance_pref` profile update and the `user_teams` clear.

**Why:** an FAQ that saved with its audience insert dropped is visible
to nobody; a dropped `faq_audiences` delete on edit keeps showing the
FAQ to audiences the admin just removed, because the insert stacks on
top of the survivors. `updateTeams` reported "Team info updated." with
the distance preference never written.

**Testing note (matters for anyone extending this):** the `user_teams`
delete tripwire has to use the CLEAR-ALL case. With a slot still filled,
the re-insert collides with the surviving row on the unique-slot index
and the ALREADY-checked insert reports that error — so the test passes
against unchecked-delete code and proves nothing. Caught by mutation:
the first version of that test survived its own mutation. Clear-all
leaves the delete as the only write.
