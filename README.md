# Tournament Guru

Youth-sports tournament discovery + verified reviews. Coaches, parents, and
team managers find events by age / gender / competition level / geography,
read reviews from people who actually attended, and reach the host directly.
Event directors claim their listing, upgrade to premium, and reply to
reviews. Admins moderate flagged content and vet claim + promo requests.

Built on **Next.js 16** (App Router, React 19, Server Actions, Turbopack) +
**Supabase** (Postgres 17, RLS, Storage, Auth) + **TypeScript strict**.
Tested with **Vitest** hitting a real local Supabase from-zero on every
push via **GitHub Actions**.

The deep references live in [`docs/`](docs):

- [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) — the app's full feature
  spec: what every page does, per-role rules, deferred work.
- [`docs/STYLE-GUIDE.md`](docs/STYLE-GUIDE.md) — visual language, tokens,
  component library conventions.
- [`CLAUDE.md`](CLAUDE.md) — conventions for future AI sessions
  (same-audience as a project-CONTRIBUTING).
- [`DECISIONS.md`](DECISIONS.md) — non-obvious calls made during the
  build, per slice.
- [`TURBOCHECK.md`](TURBOCHECK.md) — the most recent codebase reliability
  audit; findings and their status.

---

## Quick start

```bash
# 1. Install (requires Node 22+ — supabase-js needs native WebSocket).
npm install

# 2. Boot the local Supabase stack (Docker required — OrbStack or Docker Desktop).
supabase start

# 3. Point the app at it. Copy the anon key + URL from `supabase status`
#    into .env.local (see below).
$EDITOR .env.local

# 4. Reset the DB from zero — applies migrations + seed.
supabase db reset

# 5. Run the app.
npm run dev            # http://localhost:3000

# Verification (also run in CI):
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run build          # next build
npm test               # vitest — 45 probes against a real local Supabase
```

`.env.local` shape (all client-safe, no service-role):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase status>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Never** commit `.env.local`. **Never** store secrets in
`.claude/settings.json` or any other tracked file (see `CLAUDE.md` ·
"Secrets").

---

## Repo layout

```
app/
  (auth)/                    login, signup, reset, reset/update
  (onboarding)/onboarding/   3-step (attendee) / 4-step (ED) wizard
  (site)/                    public marketing + discovery (anon-callable)
    page.tsx                   landing: hero, featured, stats, testimonials
    events/                    /events search + /events/[id] detail + /review
    directors/                 /directors directory + /directors/[id] profile
  auth/callback/             Supabase email-link exchange (Route Handler)
  promo/[token]/             3rd auth variant — coach promo landing
  dashboard/                 role-gated dashboard (Attendee / ED / Admin)
    layout.tsx                 role-based sidebar + toast provider
    events/                    tournaments + events CRUD (ED + Admin variants)
    reviews/                   ED/Admin table + My Reviews (Attendee)
    claim-requests/            ED submit + Admin approve/decline
    promo-codes/               ED submit CSV + Admin queue + Coaches list
    users/                     Admin: Attendees + EDs, block/delete
    flagged/                   Admin moderation queue
    banned-words/              Admin CRUD
    faqs/                      Admin CRUD
    account/                   Profile / Security / Preferences / Notifications
    favorites/  activity/  support/
  components/
    ui/                        Button, StatusPill, Card, StarRating,
                               MetricStrip, Table, ConfirmDialog, Toast, …
    reviews/                   ReviewCard, CommentTree, HelpfulButton,
                               FavoriteButton, FlagDialog
lib/
  supabase/                    server/client/proxy factories + session helper
  reviews/                     review + comment queries, actions, banned words
  claims/                      claim-request actions + queries
  promo/                       CSV parser, code generator, SendGrid dispatch
  user-events/                 favorites + recently-viewed helpers
  enums.ts                     canonical Postgres-enum choice arrays
  rate-limit.ts                per-IP fixed-window limiter (public endpoints)
  url.ts                       safeExternalUrl + safeImageSrc (XSS gate)
  validation.ts                password / email / DOB helpers
proxy.ts                       Next 16 middleware entry (session refresh
                               + blocked-user redirect)
supabase/
  migrations/                  timestamped DDL (15 files — baseline + 14)
  schema.sql                   consolidated build (auto-generated)
  seed.sql                     reference-data seed
  config.toml                  local dev only — never db push
scripts/
  build-schema.sh              regenerate supabase/schema.sql
tests/
  harness.ts                   anon + service_role clients + fixtures
  probes/                      c1–c4, h1, h2, rls-writes, claim-flow,
                               validation, platform-counters,
                               reauth-delete  (45 tests, ~12 s)
.github/workflows/ci.yml       typecheck + lint + supabase + vitest + build
```

---

## Conventions

### Server clients — three factories, three roles

| Factory | File | Use for |
|---|---|---|
| `createServerAuthClient()` | `lib/supabase/server.ts` | Anything needing `auth.uid()` — dashboard reads, mutations, onboarding |
| `createAnonServerClient()` | same | Public unauthenticated reads (marketing, discovery) |
| `createClient()` | `lib/supabase/client.ts` | Client Components only — auth state subscription, sign-out |

`createServerClient` from `@supabase/ssr` is only used inside `proxy.ts`
(the Next 16 middleware) and `auth/callback/route.ts`.

### Server Actions

Every mutation is a Server Action (`"use server"`). Pattern:
`(_prev: State, formData: FormData) => Promise<State>`, driven by
`useActionState`. Server-side validation is authoritative even when the
client already checked.

### RLS is the security boundary

Any `if (user_type === 'admin')` check in a Client Component is an
*affordance* (hide the button, change the copy) — never a gate. RLS +
column grants + `SECURITY DEFINER` RPC guards enforce access. Sensitive
columns (`user_type`, `role_title` after onboarding, `blocked`,
`guru_review`, `promo_id`, `published_at`) are out of every authenticated
UPDATE grant; the paths that need to write them go through a
`SECURITY DEFINER` RPC that checks `is_admin()` or ownership at entry.

### Public reads route through DEFINER views

Anon and non-owner reads of user identity go through three views —
`review_author_public`, `public_comment_authors`, `public_event_owners`
— that expose only `first_name` + organization + photo. `last_name`,
`email`, and `dob` never come through them.

### DB URLs go through `safeExternalUrl`

Any DB-sourced string that ends up in `<a href>` / `<img src>` /
`window.open` / `fetch` must go through `safeExternalUrl` or
`safeImageSrc` from `lib/url.ts` — allow-list of `http:` / `https:` /
`mailto:` / `tel:` (anchors), `http:` / `https:` (images). Blocks
`javascript:` / `data:text/html;…` stored XSS.

### Rate-limited public endpoints — two layers

- **App**: per-IP fixed window via `lib/rate-limit.ts`. Wrap every
  unauthenticated writer.
- **DB**: `rate_limit_touch(bucket, limit)` fired by `before insert`
  triggers on `search_queries` (1000/min) and via the password-reset
  action bucket.

### Migrations

- Timestamped `YYYYMMDDHHMMSS_<name>.sql` under `supabase/migrations/`.
  Never edit history — add a new migration on top.
- Regenerate `supabase/schema.sql` after adding one: `bash scripts/build-schema.sh`.
- Local reset: `supabase db reset` (safe). Never pass `--linked`, never
  `supabase link`, never `supabase db push` — they touch cloud
  projects.

### Verification

**Do not** call `preview_start` on this repo. The Supabase client
keeps a websocket open which prevents the preview harness from idling,
so the pane stays blank. Verify via
`npm run typecheck && npm run build && npm test`.

---

## Testing

45 probes across 11 files. Every probe hits a real local Supabase
through the anon key + fixtures that create fresh authenticated
users. The probes cover:

| File | Covers |
|---|---|
| `c1-signup-privilege-escalation.test.ts` | `handle_new_user` coerces `user_type`; `admin` cannot self-sign up |
| `c2-definer-guards.test.ts` | Every destructive SECURITY DEFINER RPC refuses a non-owner |
| `c3-apply-promo.test.ts` | `apply_promo_to_review` validates review↔promo↔caller↔event |
| `c4-promo-flow.test.ts` | End-to-end promo flow: CSV → promo → coach signup → verified review |
| `h1-public-views.test.ts` | Public identity reads go through DEFINER views; no `last_name` leak |
| `h2-onboarding-step3.test.ts` | ED skipping optional step-3 fields still advances |
| `rls-writes.test.ts` | Column-grant refusals: `user_type`, `role_title`, `guru_review`, impersonated `author_id`, anon insert into `profiles`/`events`/`reviews` |
| `claim-flow.test.ts` | Non-admin cannot approve; admin approval transfers tournament + siblings atomically |
| `validation.test.ts` | Password 8/1/1, email, DOB, banned words, CSV parse |
| `platform-counters.test.ts` | `listed_tournaments_total` + `listed_events_total` bump on insert |
| `reauth-delete.test.ts` | Delete-my-account requires a valid `signInWithPassword` |

Run all: `npm test`. Run one: `npm test -- tests/probes/<file>`.

---

## CI

`.github/workflows/ci.yml` runs on push + PR to `rebuild`/`main`:

1. Install (Node 22, cached npm)
2. `npm run typecheck`
3. `npm run lint`
4. Install Supabase CLI (pinned to 2.98.2 — matches local dev)
5. `supabase start` (via Docker on the GitHub runner)
6. `supabase db reset` — applies all migrations + seed from zero
7. Export the local Supabase env into the runner's env
8. `npm test` — the 45 probes
9. `npm run build` — 30-route Next.js production build

The pinned CLI is intentional: newer versions ship a Postgres image whose
default GRANTS regressed `service_role` writes. When you bump the pin,
run the workflow once locally with `act` before merging.

---

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full handoff checklist:
provisioning a client-owned Supabase project, applying migrations from
zero, verifying with the same probes CI runs, wiring the Vercel
deployment, and the post-cutover smoke test.
