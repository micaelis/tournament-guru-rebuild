# Auth & Onboarding — setup

The code for email/password login, signup, password reset, and the onboarding
wizard is already wired up. A couple of things must be configured **in your
Supabase project** for it to work end to end.

> **Note (2026):** Google/Facebook sign-in was removed — no live user ever
> created an account with a social provider. The auth surface is email +
> password only. `/auth/callback` still exists because email confirmation
> and password recovery use it.

## 1. Apply the database migration

Run [`docs/auth-migration.sql`](./auth-migration.sql) (Supabase → SQL Editor, or
`supabase db execute`). It is idempotent — **re-run it after any update to this
file** (e.g. the section 4 `GRANT`s added during the security audit). It adds:

- **`handle_new_user()` trigger** — auto-creates a `profiles` row on every
  email signup. Without it, new users have no profile and onboarding can't save.
- **`needs_password_setup(email)`** — lets the login screen detect the 2,834
  migrated users (`existed_before = true`, never signed in) and route them to
  password reset instead of showing "wrong password".
- **RLS + owner policy on `user_teams`** — the table shipped with no RLS.
- **§4 GRANTs** — give the `authenticated` role the base table privileges on
  `profiles` / `user_teams` that RLS needs to take effect. `anon` is granted
  nothing here (those tables stay private). Without these, onboarding writes can
  fail silently even with correct RLS.

### Production cutover sequence

These are all DDL/setup — none of them import or move user data. Run in order:

1. `docs/schema.sql` — base tables, enums, RLS.
2. `docs/schema-additions.sql` — indexes, triggers, search.
3. **`docs/auth-migration.sql`** — auth trigger + `needs_password_setup` + `user_teams` RLS + **§4 GRANTs**. ← the grants live here, re-runnable.
4. Your existing **user data import** (the 2,834 accounts) — separate, unchanged.

Step 3 is safe to re-run at any point (it's idempotent and data-free), so a
cutover can apply it before or after the data import without harm.

## 2. Environment variable

`.env.local` now includes:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Set it to your deployed origin in production — it builds the
email-confirmation and password-reset redirect links.

## 3. URL configuration

In **Supabase → Authentication → URL Configuration**:

- **Site URL:** your app origin (e.g. `http://localhost:3000`).
- **Redirect URLs (allow list):** add `${SITE_URL}/auth/callback`
  (e.g. `http://localhost:3000/auth/callback`).

## How the pieces fit

| Route | Purpose |
| --- | --- |
| `/login` | Email + password sign-in. Detects migrated users. |
| `/signup` | Email + password sign-up. "Skip registration" browses without an account. |
| `/reset` | Request a reset email. |
| `/reset/update` | Set a new password (where the email link lands). |
| `/onboarding` | 3-step wizard → writes `profiles` + `user_teams`, sets `onboarding_complete`. |
| `/auth/callback` | Exchanges email-confirmation and password-recovery codes for a session. |

**Gating:** public pages (landing, discovery, event detail) stay open to
everyone, including "skip registration" visitors. `proxy.ts` (Next 16's renamed
middleware) only guards `/onboarding` and `/dashboard`. Wire review/favorite/claim actions to require a
session as those features are built.

## Email confirmation

If **Confirm email** is ON (Supabase → Authentication → Providers → Email),
signup shows a "check your inbox" screen and the user lands on `/auth/callback`
after clicking the link. If OFF, signup logs the user straight into onboarding.
Both paths are handled.
