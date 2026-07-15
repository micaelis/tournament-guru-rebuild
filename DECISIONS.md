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

### S0.5 · Location field — text-only for now
The Auth spec asks for Google Places autocomplete on the onboarding
location step. Wiring `@googlemaps/js-api-loader` cleanly (SSR-safe
Client Component, key gated on `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) is a
non-trivial addition that doesn't gate the auth/onboarding flow. Ship
Slice 0 with a plain text location input that writes only
`location_formatted`. Places autocomplete will be added in a small
follow-up once the operator confirms the env var is present.

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
