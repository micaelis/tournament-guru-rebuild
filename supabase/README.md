# Supabase — local development

The whole Supabase stack (Postgres + Auth + Studio + Inbucket for local
email) runs on your machine via `supabase start`. This project's
migrations apply automatically on `supabase db reset`.

## One-time: Docker

`supabase start` needs a container runtime. Any of:
- **OrbStack** (lightest on macOS) — https://orbstack.dev
- **Docker Desktop** — https://www.docker.com/products/docker-desktop/

Start it and confirm with `docker info`.

## Bring the stack up

```bash
cd tournament-guru
supabase start           # first run downloads images (~a few minutes)
supabase db reset        # apply migrations + seeds (idempotent)
```

Studio: http://localhost:54323 · Inbucket: http://localhost:54324

## Point the app at local Supabase

In `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key printed by `supabase start`>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Restart `npm run dev` after changing env vars.

## Migration conventions

- Files under `supabase/migrations/` are applied in filename order.
- `20260716000001_baseline.sql` is the from-scratch schema — it is the
  first migration and creates everything (tables, enums, RLS, functions,
  triggers, grants, reference seeds).
- Later migrations layer semantic fixes on top; **never edit history**.
- Regenerate `../supabase/schema.sql` after adding a migration:

  ```bash
  bash ../scripts/build-schema.sh
  ```

## Do NOT

- `supabase link` a staging or production project from this working tree.
- `supabase db push` (would push migrations to the linked project).
- `supabase db reset --linked` (would wipe the linked project).

All three are hard-denied by `.claude/settings.json` on this branch.

## Commands cheat-sheet

```bash
supabase status          # print URLs / anon key
supabase db reset        # wipe + re-apply migrations + re-seed
supabase stop            # tear the containers down
```
