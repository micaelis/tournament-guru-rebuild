# Staging test runbook

Verifies the two flows we couldn't prove without writing to a database:
**(A)** fresh signup → onboarding → login, and **(B)** the migrated-user
"please reset your password" flow — using only fake test accounts, never the
2,834 real users.

Everything runs against a throwaway **staging Supabase project**. Your app runs
locally the whole time; only the database behind it changes.

> **Prefer fully offline?** [`supabase/README.md`](../supabase/README.md) runs
> the identical flows against a local Supabase stack (needs Docker) — the two
> migrated fake accounts come pre-seeded and reset emails are captured locally,
> so there's no dashboard or real-email step. Same tests, different setup.

---

## One-time setup (~10 min)

### 1. Create a staging project
Supabase dashboard → **New project** → name it `tournament-guru-staging`.
Wait for it to finish provisioning.

### 2. Build the schema (SQL Editor → paste each file's contents → Run, in order)
1. `docs/schema.sql`
2. `docs/schema-additions.sql`
3. `docs/auth-migration.sql`  ← trigger + `needs_password_setup` + RLS + grants

> Tip: open each file, copy all, paste into a new SQL Editor query, Run. A few
> "already exists" notices on re-runs are fine.

### 3. Configure Auth
- **Authentication → URL Configuration**
  - **Site URL:** `http://localhost:3000`
  - **Redirect URLs:** add `http://localhost:3000/auth/callback`
- **Authentication → Providers → Email**
  - For faster testing, turn **Confirm email OFF** (staging only). Leave it on
    if you'd rather also test the confirmation email — then use a plus-addressed
    inbox you control.

### 4. Point the app at staging
- Open `.env.local`. **Copy your two production `NEXT_PUBLIC_SUPABASE_*` values
  into a scratch note first** (you'll restore them later).
- Replace them with your staging project's values (Project Settings → API).
  See `.env.staging.example` for the shape. Leave `NEXT_PUBLIC_SITE_URL` as
  `http://localhost:3000`.
- Restart the dev server: stop it, then `npm run dev`.

You're now running the local app against the empty staging database.

---

## Test A — Fresh signup → onboarding → login

1. Go to **http://localhost:3000/signup**.
2. Sign up with a fake email, e.g. `test-fresh@example.com`, password ≥ 8 chars.
   - Confirm-email OFF → you land straight in onboarding.
   - Confirm-email ON → click the link in the inbox first.
3. Complete the **3 onboarding steps** (name + role, details, a team or two),
   then **Finish Registration**. You should be redirected to the home page.
4. **Verify in the staging SQL Editor** — all three should return rows:

```sql
-- auth user exists
select id, email from auth.users where email = 'test-fresh@example.com';

-- profile was created (trigger) AND filled in (onboarding), complete = true
select first_name, last_name, attendee_type, onboarding_complete,
       onboarding_step, pref_distance, pref_competition
from public.profiles
where contact_email = 'test-fresh@example.com';

-- teams were written under the right owner, one row per slot
select slot, gender, age, level
from public.user_teams
where profile_id = (select id from auth.users where email = 'test-fresh@example.com')
order by slot;
```

✅ Pass = profile shows your entered name/role, `onboarding_complete = true`,
and one `user_teams` row per team you added.

5. **Test login for that account:** open an incognito window (or sign out via
   the header), go to **/login**, sign in with the same credentials. You should
   land on the home page, signed in (your initial shows in the header).
6. **Wrong-password check:** try logging in again with a wrong password →
   expect **"Incorrect email or password."** (not a leak of which field).

---

## Test B — Migrated-user reset flow

### Create the two fake "migrated" accounts
1. Dashboard → **Authentication → Users → Add user**. Create two accounts using
   **plus-addressed inboxes you control** so the reset email arrives:
   - `youraddress+migrated1@gmail.com`
   - `youraddress+migrated2@gmail.com`
   Give any temporary password — the next step erases it.
2. Open `docs/staging-seed.sql`, put those two emails in the `emails` array
   **and** in the verification query at the bottom, then run it in the SQL
   Editor.
3. Confirm the verification query shows `needs_reset = true` for both.

### Run the flow
4. Go to **/login** and try to sign in as `youraddress+migrated1@gmail.com`
   with **any** password.
   - ✅ Expect the blue **"Welcome back!"** panel: *"For security, we've
     upgraded our system and you'll need to reset your password to continue"*
     with a red **Reset password →** button — **not** a generic error.
5. Click **Reset password →**. The email is prefilled on `/reset`. Submit.
   - ✅ Expect **"Check your email for a password reset link."**
6. Open the email (in your Gmail; check spam). Click the link.
   - ✅ It should land on **/reset/update** ("Set a new password").

   > **If the email doesn't arrive:** a fresh Supabase project's built-in email
   > is heavily rate-limited (a couple per hour). Steps 4–5 already prove the
   > part we wrote — migrated **detection** and the **reset-sent** response. To
   > finish step 6–8 reliably, either configure custom SMTP in the staging
   > project (Authentication → Emails → SMTP), or in the dashboard open the user
   > and use **Send password recovery** to trigger the link. The `/reset/update`
   > screen and `needs_password_setup` check are what you're confirming.
7. Set a new password (≥ 8 chars, twice). Submit.
   - ✅ You should be signed in and redirected (to onboarding, since these
     fakes haven't completed it — that's expected).
8. **Verify the account is now "activated" in the SQL Editor:**

```sql
select
  u.email,
  u.last_sign_in_at,                              -- now populated
  (u.encrypted_password is not null) as has_password,  -- now true
  public.needs_password_setup(u.email) as needs_reset  -- now FALSE
from auth.users u
where u.email = 'youraddress+migrated1@gmail.com';
```

✅ Pass = `needs_reset` is now **false** — proving the flow moved the user from
"migrated/locked" to a normal activated account, and a second login would use
the standard path.

9. **Regression check:** log out, go to **/login**, and sign in with the
   **new** password. You should get in normally (no reset prompt).

---

## When you're done — restore production

- In `.env.local`, put your **production** `NEXT_PUBLIC_SUPABASE_*` values back
  (from your scratch note). Restart the dev server.
- The staging project can be paused or deleted from the dashboard; nothing in it
  ever touched production.

---

## Quick pass/fail summary

| Test | Proves | ✅ looks like |
| --- | --- | --- |
| A signup | trigger creates profile; auth user created | profile row exists, `onboarding_complete=false` initially |
| A onboarding | writes profiles + user_teams; sets complete | fields filled, `onboarding_complete=true`, team rows present |
| A login | fresh account can sign in | lands home, header shows initial |
| A wrong password | no enumeration | "Incorrect email or password." |
| B detection | migrated user routed to reset | blue "Welcome back!" + Reset button |
| B reset | reset email → set-new screen works | password set, signed in |
| B resolution | account no longer flagged | `needs_password_setup` → false |
