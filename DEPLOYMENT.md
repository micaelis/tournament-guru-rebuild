# Deploying Tournament Guru

Provisioning a client-owned Supabase project + Vercel deployment from
this repo. Run each section in order. Steps marked ⚠ change external
state — read the whole section before running.

Deep references:
- [`docs/SPECIFICATION.md`](docs/SPECIFICATION.md) — what the app does.
- [`README.md`](README.md) — repo layout + local dev.
- [`CLAUDE.md`](CLAUDE.md) — conventions + verification pattern.

---

## 0. Prerequisites

- **Node 22+** (supabase-js needs native WebSocket).
- **Supabase CLI 2.98.2+** (`supabase --version`). CI is pinned to this
  version — mismatch triggers grant regressions on the client side.
- **Docker** (OrbStack on macOS or Docker Desktop). Needed for `supabase start`
  during pre-deploy verification.
- **`psql`** for the reset command against the cloud DB.
- **`gh` CLI** (optional) if you want to trigger CI from your terminal.
- The client already has a Supabase organization; you have access to
  create a new project inside it.

---

## 1. Create the fresh Supabase project ⚠

Dashboard → your org → **New project**.

- **Region**: match the client's users (US-East for US-based youth sports).
- **Postgres version**: **17.x**. The schema targets PG 17 idioms —
  `set search_path = public, extensions, pg_temp` on every SECURITY DEFINER
  function, views pin `security_invoker=false` explicitly, `citext` +
  `pg_trgm` + `unaccent` install into the `extensions` schema.
- **Database password**: use a password manager. This is the `postgres`
  superuser password — you'll need it for the `psql -f schema.sql` step.

Wait 30–60 s for the project to come up. From **Project Settings → API**:

- `Project URL` (looks like `https://<ref>.supabase.co`)
- `Project API keys → anon public`
- `Project Reference ID` (the `<ref>`)

Note the `postgres` connection string too:
**Project Settings → Database → Connection string → URI**.

---

## 2. Enable extensions

Dashboard → **Database → Extensions**. Turn on:

- `citext` (schema `extensions`)
- `pg_trgm` (schema `extensions`)
- `unaccent` (schema `extensions`)

The migration baseline creates the enums + tables that reference these,
so they must exist first.

---

## 3. Apply the schema ⚠

Two paths — either works, the migration path is safer for future
incremental updates.

### Path A — Migration-tracked (recommended)

```bash
# Link this local repo to the fresh cloud project.
supabase link --project-ref <ref>
# (You'll be prompted for the DB password from §1.)

# Push every migration in supabase/migrations/ up to the cloud.
supabase db push
```

The migrations apply in filename order (baseline → all 14 follow-ups).
Watch the console for "Applied migration …" and stop on any error —
partial state is worse than none.

### Path B — Single-shot `schema.sql`

If the migration approach spits errors you can't resolve, use the
consolidated `supabase/schema.sql` (auto-generated from the migrations):

```bash
PGPASSWORD=<db-password> psql \
  "postgresql://postgres@db.<ref>.supabase.co:5432/postgres" \
  -f supabase/schema.sql
```

This runs the entire baseline + follow-ups in one transaction. On
success, run:

```bash
supabase migration repair --status applied --version <every-timestamp>
```

so the cloud project's migration ledger knows what's already applied.

---

## 4. Auth configuration

Dashboard → **Authentication → URL Configuration**.

| Setting | Value |
|---|---|
| Site URL | `https://<production-domain>` |
| Redirect URLs | `https://<production-domain>/auth/callback` + any preview / staging URLs |

Dashboard → **Authentication → Providers → Email**.

- **Confirm email** — ON (blocks unverified signups).
- **Password minimum** — 8 chars (matches `validatePassword` in the app).

Dashboard → **Authentication → Email templates**. Point every template
at the production domain.

**Do NOT** push `supabase/config.toml` at this project — the file is for
local dev only. Its `enable_confirmations = false` would disable email
verification if it landed here. `config.toml` is documented as "LOCAL DEV
CONFIG ONLY. DO NOT USE IN PRODUCTION."

---

## 5. Storage

**Nothing to do by hand — the buckets and their RLS ship in migration
`20260719000004_storage_buckets.sql`, applied by the `db push` in §4.**
After the push, confirm in Dashboard → **Storage** that three buckets
exist:

- `event-images` — **public**, 10 MB, png/jpeg (event + sponsor logos, gallery)
- `org-logos` — **public**, 5 MB, png/jpeg (org logos, profile photos)
- `promo-csv` — **private**, 2 MB, text/csv (ED CSV submissions; signed URLs)

Objects are keyed by uploader user id (`<uid>/<file>`); RLS restricts
writes to the owner's own folder (admin anywhere). `promo-csv` has no
public read — the admin queue reads it via a short-lived signed URL, and
the parsed email list is also mirrored inline on
`submitted_csvs.raw_emails`. See DECISIONS.md §S10.4.

⚠ If `db push` reports a permission error creating the storage policies,
the project's `postgres` migration role lacks rights on
`storage.objects`; create the policies from the SQL editor as the
dashboard owner using the same statements from the migration file.

---

## 6. Wire the app

Set on Vercel (or your host) as **Environment Variables**:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` (from §1) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon JWT from §1 |
| `NEXT_PUBLIC_SITE_URL` | `https://<production-domain>` |

`NEXT_PUBLIC_SITE_URL` is **required in production**: `lib/site-url.ts`
resolves the public home URL from it (the legal pages print and link it,
and auth/promo emails fall back to it). Without it the app falls back to
the Vercel deployment host or the request host, which keeps working but
prints deployment-specific hostnames and makes the legal pages
dynamically rendered.

Optional (unset → the app runs in log-stub mode for both):

| Key | Effect |
|---|---|
| `SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL` + `SENDGRID_TEMPLATE_ID` | Real SendGrid dispatch for the promo emails + support form |
| `SUPPORT_EMAIL_TO` | Support inbox recipient (defaults to `support@tournamentguru.com`) |

Do **not** set `SUPABASE_SERVICE_ROLE_KEY` unless you're wiring the
service-role-only follow-ups (Places autocomplete, storage bucket
signed uploads). No production code path reads it today.

---

## 7. Verify against the fresh project

Point a local checkout at the new project temporarily:

```bash
# In a scratch shell:
export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-jwt>
export NEXT_PUBLIC_SITE_URL=http://localhost:3000

npm run build             # confirms the app can server-render against the new project
```

Then run the probe suite against local (which uses its own env) to
confirm the migrations you just applied are the same shape:

```bash
supabase start
supabase db reset          # applies migrations to LOCAL — sanity check
npm test                   # 45 probes should all pass in ~12s
```

If any probe fails against local but not against the cloud project,
the cloud project has schema drift — resolve it before proceeding.

---

## 8. Deploy the app ⚠

Vercel → **Import Git Repository** → point at this repo, `rebuild`
branch (or `main` after the promotion cut).

- Framework preset: **Next.js**
- Build command: `npm run build` (default)
- Output directory: `.next` (default)
- Install command: `npm ci`
- Node version: **22**

The environment variables from §6 must be set **before** the first
deployment — server components read them at build time.

---

## 9. Post-cutover smoke test

Hit these paths from a fresh incognito browser and confirm:

- `/` — the landing page renders with the featured strip + stats
  band + testimonials. Stats show 0 / 0 / 0 on a fresh project — that
  is expected until real data lands.
- `/signup` — the 8/1/1 password rule fires client-side.
- `/login` — email + password path.
- `/onboarding` — a signup as attendee lands on Step 1.
- `/dashboard/events` — ED lands here post-onboarding; the "Welcome"
  card + YouTube embed renders because they have zero tournaments.
- `/events` — the public search grid + filter sidebar. Empty until
  events are seeded.
- `/directors` — empty until any ED completes onboarding.

Create one throwaway ED account + one attendee via the UI. Confirm:

- The ED can create a tournament + event
- The attendee can find that event via `/events`
- The attendee can write a review + it renders on `/events/[id]`
- The reviewer's `first_name` renders; `last_name` does NOT
- `/dashboard/reviews` shows the review to the ED

Then delete the two throwaway accounts via their Account tab.

---

## 10. Ongoing operations

### Migrations

Every schema change ships as a new timestamped file in
`supabase/migrations/`. To apply against production:

```bash
supabase link --project-ref <production-ref>
supabase db push
```

After adding a migration, regenerate the consolidated schema:

```bash
bash scripts/build-schema.sh
```

Never edit historical migrations. Never `supabase db reset --linked`
(would wipe production).

### CI regressions

The workflow at `.github/workflows/ci.yml` runs the same 45 probes on
every push. Merging into `main` is gated on green CI. If a probe goes
red, the failing shape is on the security floor by construction — fix
before merging.

### Demo DB auto-migration

`.github/workflows/demo-migrate.yml` keeps the hosted **demo** project's
schema in sync with the code. Vercel deploys code only, so the demo DB
used to drift behind `supabase/migrations/` — that drift caused two
demo-only bugs (empty search, onboarding "permission denied for table
user_teams").

- **When it runs:** only after the `CI` workflow completes
  **successfully** for a push to `rebuild` (a red build never migrates),
  serialized so overlapping pushes apply in order.
- **What it does:** `supabase db push --db-url …` against the demo —
  applies pending migrations only, so it's idempotent and safe to
  re-run. It checks out the exact commit CI validated.
- **What it does NOT do:** reseed. Seeding drops and replaces demo data,
  so reseeding stays a deliberate manual step (`psql -f supabase/seed.sql`
  or the SQL editor) whenever `seed.sql` changes.
- **Secret to set** (repo Settings → Secrets and variables → Actions →
  New repository secret): `SUPABASE_DEMO_DB_URL` — the demo project's
  **direct / session-mode** Postgres connection string (Dashboard →
  Connect; URL-encode the password if it has special characters). This
  is the only place the target is defined — the workflow hardcodes no
  project ref, so pointing it elsewhere requires changing the secret.
- The listening workflow must live on the repo's default branch
  (`rebuild`) for `workflow_run` to fire — it does; the first push after
  adding it arms the pipeline.

### Backups

Supabase's daily backups cover the DB. For a rebuild-safe cutover,
also export via `pg_dump` from the dashboard before any migration
that changes existing data:

```bash
supabase db dump --data-only -f pre-migration-$(date +%Y%m%d).sql
```

Keep the dump in the client's private storage; do NOT commit to this
repo.

---

## Rollback

If a deployment goes bad within an hour of the cutover:

1. Revert the Vercel deployment to the previous successful one
   (Vercel → Deployments → three-dot menu → Promote to Production).
2. Roll back the DB if the migration was destructive: apply a reversal
   migration authored specifically for that change. **Do not** run
   `supabase db reset --linked` — it wipes everything.

If more than a day has passed, prefer a forward-fix (new migration on
top of the current state) over a rollback — user data has accrued.
