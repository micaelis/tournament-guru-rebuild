# Tournament Guru — instructions for future AI sessions

@AGENTS.md

## What this app is

Youth-sports tournament discovery + reviews. Attendees (coaches, parents,
team managers) find events and read verified reviews; Event Directors
claim and manage listings; Admins moderate the platform. Next.js 16
(App Router, React 19, Server Actions) on Supabase (Postgres 15+, RLS,
Storage, Auth). See [docs/BUILD-PLAN.md](docs/BUILD-PLAN.md) for the
slice-by-slice roadmap and [DECISIONS.md](DECISIONS.md) for non-obvious
calls.

**Rebuild status:** on the `rebuild` branch, following the tgredesign
design language.
Slice 0 (this one) lays the schema, auth, and shared component library.
The old codebase's data model is gone — do not reintroduce columns from
it (`full_name`, `contact_email`, `profile_picture`, `onboarding_complete`,
`customer_type`, etc.).

## Layout at a glance

- `app/(auth)/{login,signup,reset}` — auth screens; Server Actions in
  `app/(auth)/actions.ts`
- `app/(onboarding)/onboarding` — 3-step (attendee) / 4-step (ED) wizard
- `app/dashboard/…` — role-scoped shell (Attendee / ED / Admin)
- `app/(site)/…` — public marketing + discovery (Slice 5)
- `app/auth/callback/route.ts` — Supabase email-link exchange
- `app/components/ui/` — the shared component library (buttons, chips,
  status pills, cards, metric strip, star rating, empty state,
  confirm dialog, toast)
- `proxy.ts` (root) — Next 16's middleware entry. Refreshes the Supabase
  session on every request and gates `/onboarding` + `/dashboard/*`.
  Blocked users are signed out and bounced to `/login?error=blocked`.
  (Next 16 renamed `middleware.ts` → `proxy.ts`; the two can't coexist.)
- `lib/supabase/{server,client,proxy,session}.ts` — client factories +
  session helper (see below)
- `lib/rate-limit.ts` — per-IP fixed-window limiter for public endpoints
- `lib/maps/loader.ts` + `app/components/LocationAutocomplete.tsx` —
  Google Places autocomplete (gated on `NEXT_PUBLIC_GOOGLE_MAPS_KEY`;
  degrades to plain text without it). `lib/geo.ts` parses the hidden geo
  fields server-side and holds the Haversine/bbox math for the events
  distance filter. `scripts/geocode-events.mjs` backfills coordinates.
- `lib/url.ts` — `safeExternalUrl` / `safeImageSrc` scheme allow-list
- `supabase/migrations/` — timestamped DDL; `20260716000001_baseline.sql`
  is the from-scratch schema

## Documentation map

Every doc and when to read it. Orientation is read-first; for the rule on which doc to
UPDATE when you change something, see the "Documentation is a first-class deliverable"
convention.

Root:
- `README.md` — product overview (what TG is, who it's for). Start here for context.
- `AGENTS.md` — ⚠ Next 16 has breaking changes vs. training data; read the guides in
  `node_modules/next/dist/docs/` before writing Next code. Read before any framework work.
- `DECISIONS.md` — non-obvious calls, add-only, slice-ID'd (S<n>.<m> / RG<n>.x). Read before
  reversing a choice; append here when you make one.
- `DEPLOYMENT.md` — ordered runbook for provisioning a client-owned Supabase + Vercel. Read
  before any deploy/provisioning; ⚠ steps change external state.
- `TURBOCHECK.md` — the latest whole-repo reliability/dead-code audit report. Read for known
  rot + backlog before a release cut.
- `CLAUDE.md` — this file: conventions + this map. Read first, every session.

docs/:
- `BUILD-PLAN.md` — slice-by-slice rebuild roadmap + autonomy setup. Read for build
  sequencing and slice dependencies.
- `SPECIFICATION.md` — the full product spec: what every page does + the rules behind it.
  The single best deep read; authoritative for behavior.
- `SCHEMA-DESIGN.md` — the data model / entity map (not DDL). Read before schema changes.
- `STYLE-GUIDE.md` — design system: tokens, colors, type, the app/components/ui primitives.
  Read before any UI/design work.
- `AUTH-SCREENS.md` — per-screen auth + onboarding spec (variants, copy, entry points).
- `SMOKE-TESTS.md` — smoke-test scenarios per flow. Read before manual QA.
- `TESTING.md` — automated-test coverage map (per-flow matrix). Read before adding tests;
  update it when you cover a new flow.
- `DEMO.md` — seeded demo accounts + the shared password for clicking between roles.

supabase/:
- `migrations/` — the schema + RLS. **Security is enforced here**, not just in the app.
- `README.md` — local Supabase / migrations workflow.

## Commands

```
npm run dev         # local dev server
npm run build       # production build
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
```

### Verification

**Never call `preview_start` on this repo.** The Supabase client keeps a
websocket open which prevents the preview harness from idling; the pane
stays blank. Verify UI changes via `npm run typecheck && npm run build`
(and `curl -sI localhost:3000/...` if the change should be reachable).

## Conventions

### Server clients — three factories, three roles

- `createServerAuthClient()` in `lib/supabase/server.ts` — auth-aware,
  reads/writes the session cookie. Use for anything that needs
  `auth.uid()` (dashboard, actions, onboarding).
- `createAnonServerClient()` in the same file — public anon reads. Use
  for marketing/discovery.
- `createClient()` in `lib/supabase/client.ts` — browser client. Client
  Components only, for auth state subscription + sign-out.

Never import `createServerClient` from `@supabase/ssr` outside the
middleware helper (`lib/supabase/proxy.ts`) and the auth callback route.

### Server Actions

Every mutation is a Server Action (`"use server"`). Pattern is
`(_prev: State, formData: FormData) => Promise<State>` so the client can
drive it via `useActionState`. Actions validate the input server-side
even when the client already checked — the server is authoritative.

### RLS is the security boundary — client checks are UX only

Any `if (user_type === 'admin')` check in a client component is an
*affordance* (hide the button, change the copy) — never a gate. RLS +
column grants enforce access. Column grants on `profiles` and `reviews`
omit the sensitive fields (`user_type`, `role_title` after onboarding,
`blocked`, `guru_review`, `promo_id`, `published_at`); anything that
must write those goes through a SECURITY DEFINER RPC or the service role
inside a server action.

### DB URLs → always render through `safeExternalUrl`

Any string from the DB that ends up in `<a href>`, `<img src>`,
`window.open`, or `fetch` MUST go through `safeExternalUrl` or
`safeImageSrc` from `lib/url.ts`. The helpers whitelist the scheme
(`http:`, `https:`, `mailto:`, `tel:` for anchors; `http:`, `https:` for
images) so a hostile `javascript:` / `data:text/html;…` URL can't turn
into stored XSS.

### Rate-limited public endpoints

Two layers:
- **App**: per-IP fixed window via `lib/rate-limit.ts`. Wrap every
  unauthenticated write endpoint.
- **DB**: `rate_limit_touch(bucket, limit)` SECURITY DEFINER function
  fired by `before insert` triggers on `search_queries` (1000/min),
  `contact_requests` (60/min), and by the password-reset action bucket.

If you add a public write endpoint, gate it at both layers.

### Migrations

- Never edit a historical migration. Add a new one with today's
  YYYYMMDD timestamp.
- Regenerate `supabase/schema.sql` after adding a migration:
  `bash scripts/build-schema.sh`.
- **Migration ⇒ regenerate types, same commit**: any migration that
  changes the schema also reruns
  `supabase gen types typescript --local > lib/database.types.ts`.
  CI regenerates and diffs the file, so a schema change without
  regenerated types fails the build (S10.17).
- Local reset (safe): `supabase db reset`. NEVER pass `--linked`; NEVER
  `supabase link`; NEVER `supabase db push`. Those touch the staging
  project.

### Production Auth settings

`supabase/config.toml` is **local dev only**. In production the settings
come from the Supabase Dashboard (Authentication → URL Configuration /
Providers), NOT this file. Required prod settings:

- `enable_confirmations = true` (email verification on)
- `enable_signup = true` (open signups)
- Site URL + redirect URLs match the production hostname
- Password minimum matches `validatePassword` in
  `app/(auth)/actions.ts` (8 chars, 1 uppercase, 1 number).

### Secrets

- No API keys, service-role tokens, or other secrets in tracked files.
- `.env.local` or Vercel env vars only.
- `.claude/settings*.json` are NOT secret stores; the global rule in
  `~/.claude/CLAUDE.md` enforces this.

### Documentation is a first-class deliverable

Documentation is this project's most important asset. Keeping it accurate is part of the
work, never an afterthought. Any change that alters behavior, structure, or intent updates
the docs in the SAME commit — a change isn't "done" until its docs are true.

- Keep OLD docs true, not just add new ones. When a change makes existing documentation
  wrong or stale, fix it in place. Docs must never describe behavior a change removed or renamed.
- Update by area:
  - routing / entry points / auth & onboarding → docs/AUTH-SCREENS.md
  - product behavior / rules / page responsibilities → docs/SPECIFICATION.md
  - design system / components / tokens → docs/STYLE-GUIDE.md
  - schema / RLS / migrations → the migration + docs/SCHEMA-DESIGN.md
  - test coverage of a flow → docs/TESTING.md (coverage matrix)
  - a non-obvious decision, trade-off, audit finding, or bug fix → append a new entry to
    DECISIONS.md in its existing format (### <ID> · title; what / why / alternative; add-only,
    never rewrite past entries — supersede by referencing the old heading)
  - a changed convention → this file (CLAUDE.md)
- Capture findings. After any audit, review gate, or bug fix, record the conclusion in
  DECISIONS.md so the reasoning survives between sessions.
- Reconcile context. If new work has drifted from what a doc says — or two docs disagree —
  reconcile them as part of the task, don't leave the contradiction.
- Keep entries concise and in the existing style.

### Comments

- Explain *why*, not *what*. Well-named identifiers do the "what".
- Don't reference the task, PR, or issue that motivated a change — that
  belongs in the commit message and rots inline.
- Keep comments compact. If a decision has a real trade-off worth
  documenting, it belongs in `DECISIONS.md`, not inline.
