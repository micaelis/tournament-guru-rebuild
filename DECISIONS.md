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
