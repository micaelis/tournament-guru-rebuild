# Tournament Guru — instructions for future AI sessions

@AGENTS.md

## What this app is

Youth-sports tournament discovery + reviews. Coaches / parents / team managers find events and read verified reviews; event directors claim and manage their listing. Next.js 16 (App Router, React 19, Server Actions) on Supabase (Postgres 15, RLS, Storage, Auth). See [README.md](README.md) for the user-facing summary.

## Layout at a glance

- `app/(site)/…` public marketing + discovery pages
- `app/(auth)/…` login / signup / password reset
- `app/(onboarding)/…` post-signup wizard (Server Actions only)
- `app/dashboard/…` signed-in dashboard (account, events, reviews)
- `app/api/…` two GET / POST route handlers (search + search-log)
- `app/auth/callback/` Supabase email-link exchange (Route Handler)
- `lib/supabase/` server + browser Supabase clients, middleware, query helpers
- `lib/rate-limit.ts` per-IP fixed-window limiter for public endpoints
- `lib/url.ts` `safeExternalUrl` / `safeImageSrc` — scheme allow-list for DB URLs
- `supabase/migrations/` timestamped DDL migrations
- `supabase/proposals/` DRAFT SQL waiting for operator sign-off (do NOT apply)

## Commands

```
npm run dev         # local dev server (see verification note below)
npm run build       # production build
npm run lint        # ESLint (next lint config)
npm run typecheck   # tsc --noEmit (no emit; strict on)
```

### Verification

**Never call `preview_start` on this repo.** The Supabase client keeps a websocket open which prevents the preview harness from idling; the pane stays blank. Verify UI changes via `npm run typecheck && npm run build && curl -sI localhost:3000/…`. This is a hard rule captured in the operator's global memory.

## Conventions

### Server clients — three factories, three roles

- `createServerAuthClient()` in `lib/supabase/server.ts` — auth-aware, reads/writes the session cookie. Use for anything that needs `auth.uid()` (dashboard, actions, onboarding).
- `createAnonServerClient()` in the same file — public anon reads. Use for marketing / discovery. Renamed from `createServerClient` to avoid the name collision with `@supabase/ssr`'s exported `createServerClient` (used only inside middleware and the auth callback).
- `createClient()` in `lib/supabase/client.ts` — browser client. Only used by `HeaderAuth` to subscribe to auth state changes.

Never call `createServerClient` from `@supabase/ssr` outside the middleware or the auth callback. If a page needs a Supabase client, pick one of the three factories above.

### Server Actions

Every mutation is a Server Action (`"use server"`). The pattern is `(_prev: State, formData: FormData) => Promise<State>` so the client can drive it via `useActionState`. Actions validate the input server-side even when the client already checked — the server is authoritative.

- Auth: `app/(auth)/actions.ts`
- Onboarding: `app/(onboarding)/actions.ts`
- Dashboard account: `app/dashboard/account/actions.ts`
- Advertiser contact: `app/components/contact-action.ts`
- Event-host contact modal: `app/(site)/events/[id]/contact-action.ts`

### RLS is the security boundary — client checks are UX only

Any `if (user_type === 'admin')` check in a client component is an *affordance* (hide the button, change the copy) — never a gate. RLS enforces access.

The lockdown migration `20260714100001_c1_lockdown_profiles_reviews_write_columns.sql` restricts which columns `authenticated` may update on `profiles` and `reviews`. Admin flows that need to write locked columns (e.g., `guru_badge`, `user_type`) must go through a SECURITY DEFINER RPC that checks `is_admin()` in its body, or run under the service role from a server action.

### DB URLs → always render through `safeExternalUrl`

Any string from the DB that ends up in `<a href>`, `<img src>`, `window.open`, or `fetch` MUST go through `safeExternalUrl` or `safeImageSrc` from `lib/url.ts`. The helpers whitelist the scheme (`http:`, `https:`, `mailto:`, `tel:` for anchors; `http:`, `https:` for images) so a hostile `javascript:` / `data:text/html;…` URL can't turn into stored XSS.

### Rate-limited public endpoints

Two layers:
- **App**: per-IP fixed window via `lib/rate-limit.ts`. Wraps `/api/search-log`, `/api/events/search`, `submitEventHostContact`, `submitContactRequest`.
- **DB**: `rate_limit_touch(bucket, limit)` SECURITY DEFINER function fired by `before insert` triggers on `search_queries` (1000/min) and `contact_requests` (60/min).

If you add a public write endpoint, gate it at both layers.

### Migrations

- Never edit a historical migration. Add a new one with today's YYYYMMDD timestamp.
- Never re-run `20240101000010_refresh_event_dates_for_demo.sql` or `20240101000015_seed_bubble_recent_reviews.sql` against a populated database — they reshuffle event dates and re-attach seed reviews by position. They are excluded from the consolidated `schema.sql`. See the DO-NOT-RE-RUN banners in each file.
- Two proposal files under `supabase/proposals/` are **not yet applied** and need operator sign-off first:
  - `h2_rls_on_remaining_tables.sql` — RLS + policies for event child tables, sponsors, event_profiles, testimonials, submitted_csvs, recently_viewed, profile_age_prefs.
  - `h3_storage_bucket_policies.sql` — Storage bucket inventory + policies. Assumes bucket names `public-avatars` / `public-events` / `private-csv`; verify against the live project before promoting.
- Regenerate `supabase/schema.sql` after adding a migration: `bash scripts/build-schema.sh`.

### Production Auth settings

`supabase/config.toml` is **local dev only**. In production the settings must be applied via the Supabase Dashboard (Authentication → URL Configuration / Providers), NOT this file. The required prod settings:

- `enable_confirmations = true` (email verification on)
- `enable_signup = true` (open signups)
- Site URL and redirect URLs match the production hostname
- Password minimum length matches the app enforcement (12 chars; see `validatePassword` in `app/(auth)/actions.ts`).

Never `supabase link` or `supabase db push` this config against a production project — it would disable email confirmation.

### Secrets

- No API keys, service-role tokens, or other secrets in tracked files.
- `.env.local` only, or Vercel environment variables in production.
- `.claude/settings.json` and `.claude/settings.local.json` are NOT secret stores; the global rule in `~/.claude/CLAUDE.md` enforces this.

### Comments

- Explain *why*, not *what*. Well-named identifiers do the "what".
- Don't reference the task, PR, or issue that motivated a change — that belongs in the commit message and rots inline.
- Keep comments compact. If a decision has a real trade-off worth documenting, it belongs in `AUDIT.md` / `CHANGES.md` or a proposal, not inline.

## Demo migrations & seed data

Two migrations exist specifically to prep a demo dataset and MUST NOT run on the live prod database:

- `20240101000010_refresh_event_dates_for_demo.sql` — rewrites `events.start_date` / `end_date` / `status` based on `(created_at desc, id)` position. Safe on a fresh `supabase db reset`. Destructive on anything with data since it last ran.
- `20240101000015_seed_bubble_recent_reviews.sql` — attaches four canned reviews to the events at positions 1-4 of the same ordering.

For a scrubbed dev dataset:

```
DATABASE_URL='postgres://…' bash scripts/generate-seed-dummy.sh
# → writes supabase/seed.dummy.sql with real UGC (event titles, photos,
#   review bodies) but every email replaced with user_<uuid8>@example.test,
#   and cards / promo_codes / contact_requests / submitted_csvs empty.
```

The generated file ends with two verification queries that MUST return zero rows before it can be committed.

## Known non-fixes / remaining risks

See [CHANGES.md](CHANGES.md) · "Deliberately not done". Highlights:

- **M7 / M9**: raw `<img>` tags are used instead of `next/image` on the event detail page and search overlay because the remote hosts aren't allow-listed. Fixing means either allow-listing every S3 host any organizer might use or opting into `unoptimized: true` per image.
- **P4**: `SearchMap` mounts twice when its fullscreen mode opens (two Leaflet instances). Portalling the same node into a fullscreen container is a sizeable client refactor.
- **CSP**: no `Content-Security-Policy` header yet — the app renders several inline `<style>` blocks that a strict CSP would break.

## Operator memory (persistent across sessions)

The operator's global memory at `~/.claude/projects/-Users-danielatarus/memory/` records:

- Never call `preview_start` on tournament-guru (Supabase websocket blocks preview).
- Verify UI via build + typecheck + curl.
- Current DB stays live for demo purposes — do not reset or wipe. Apply all fixes as new migration files on top.
- The consolidated `schema.sql` and `seed.dummy.sql` are prepared but NOT applied.
