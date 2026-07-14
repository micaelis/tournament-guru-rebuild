# Local Supabase — run the auth tests fully offline

This spins up the whole Supabase stack (Postgres + Auth + Studio + a local email
inbox) on your machine. No cloud project, no real user data, and password-reset
emails are captured locally. It's an alternative to the cloud staging project in
[`../docs/STAGING_TESTS.md`](../docs/STAGING_TESTS.md) — the test *flows* are the
same; only the setup differs.

## Prerequisite: Docker (one-time)

`supabase start` runs containers, so you need a container runtime. You have the
Supabase CLI already; you just need Docker:

- **Docker Desktop** — https://www.docker.com/products/docker-desktop/ (simplest), or
- **OrbStack** (lighter, macOS) — https://orbstack.dev

Install it, launch it, and make sure it's running (`docker info` should succeed)
before the next step.

## Start it

```bash
cd ~/Desktop/tournament-guru
supabase start        # first run downloads images (~a few minutes)
```

When it finishes it prints an **API URL** and **anon key**, and:
- **Studio** (DB UI + SQL editor): http://localhost:54323
- **Inbucket** (captured emails): http://localhost:54324

The three migrations in `supabase/migrations/` (base schema → additions → auth
setup) and `supabase/seed.sql` (two fake migrated accounts) are applied
automatically.

## Point the app at local Supabase

In `.env.local`, **back up your production values first**, then set:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key printed by `supabase start`>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Restart the dev server (`npm run dev`).

## Run the tests

**Test A — fresh signup → onboarding → login:** exactly as in
[`../docs/STAGING_TESTS.md`](../docs/STAGING_TESTS.md#test-a--fresh-signup--onboarding--login).
Email confirmation is off locally, so signup goes straight to onboarding. Verify
with the same SQL in **Studio → SQL Editor** (http://localhost:54323).

**Test B — migrated reset:** the two fake accounts are **already seeded** — no
dashboard step. Use:
- `migrated1@local.test` (or `migrated2@local.test`), any password.

1. `/login` with that email + any password → expect the blue **"Welcome back!"**
   panel + **Reset password →** (not a generic error).
2. Click it, submit on `/reset`.
3. Open **Inbucket** (http://localhost:54324) → open the reset email → click the
   link → land on `/reset/update` → set a new password.
4. Verify in Studio → SQL Editor:

```sql
select email, last_sign_in_at,
       public.needs_password_setup(email) as needs_reset
from auth.users where email = 'migrated1@local.test';
-- needs_reset should now be FALSE, last_sign_in_at populated.
```

## Handy commands

```bash
supabase db reset     # wipe + re-apply all migrations + re-seed (fresh slate)
supabase stop         # shut the stack down
supabase status       # show URLs/keys again
```

## When done

Restore your **production** `NEXT_PUBLIC_SUPABASE_*` values in `.env.local` and
restart the dev server. `supabase stop` frees the containers.

> **Config note:** `config.toml` targets a recent CLI (you have 2.98.2). If
> `supabase start` ever complains about a config key, run `supabase init --force`
> to regenerate it, then set `[auth.email] enable_confirmations = false` again.
