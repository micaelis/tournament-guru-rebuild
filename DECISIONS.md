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

### S0.4 · Schema semantic fixes on top of the baseline
Applied as follow-on migrations against the from-scratch baseline (each
gets its own timestamped file so the intent is legible in the tree):

1. **`dob` added to profiles UPDATE allow-list.** Onboarding needs to
   write DOB; the baseline omitted it from the column grant, which would
   have blocked mandatory-field completion.
2. **`role_title` added to allow-list + role/type lock trigger.** Spec:
   role is adjustable during onboarding, locked after. Column grant lets
   the client write `role_title`; a `before update` trigger raises if
   `role_title` or `user_type` changes when `onboarding_completed=true`.
   Baseline had neither.
3. **`p_comments_read` tightened.** Baseline let anyone read comments on
   *draft* reviews as long as the comment wasn't personally hidden. Now
   requires the parent review to be visible (published, or authored by
   caller, or admin).
4. **`handle_new_user` picks a role default that matches the incoming
   `user_type`.** Baseline hard-coded `role_title='coach'`, which
   conflicts with the `role_matches_type` check when the metadata says
   `user_type='event_director'`. Fixed to `coach` for attendee,
   `event_director` for ED, `event_director` for admin (admin type +
   admin role — but check constraint accepts any role for admin).

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
