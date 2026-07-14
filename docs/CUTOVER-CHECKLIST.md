# Tournament Guru — Production Cutover Checklist

**Purpose:** the single source of truth for everything that must be applied to the
**client's production Supabase project** (and Vercel) at launch. Your dev project and
the client's project are separate databases — nothing syncs automatically. Every item
below was applied to DEV and must be reproduced on PRODUCTION.

**Golden rule:** everything should live in a migration file in `supabase/migrations/`.
If something was applied by pasting into the SQL Editor and is NOT in a migration file,
it's a landmine — flag it in the "Manual SQL — verify captured as migration" section.

---

## A. Database setup (run in order on client's project)

Run these in sequence. Each should be a migration file; if it's only a loose .sql, note that.

- [ ] **1. Enable extensions** — `postgis`, `pg_trgm`, `unaccent` (Dashboard → Database → Extensions, or SQL)
- [ ] **2. `schema.sql`** — base tables, types, RLS policies
- [ ] **3. `schema-additions.sql`** — indexes, rating-recalc triggers, elastic search (tsvector + trigram)
- [ ] **4. Table GRANTs for anon role** — RLS policies are NOT enough; anon needs table-level grants:
      - [ ] `grant select on events, reviews, event_profiles to anon`
      - [ ] `grant select on event_ages, event_competition_levels, event_fields, event_genders to anon`
      - [ ] `grant select on event_age_groups to anon` (if event cards show pricing/age labels)
      - [ ] `grant insert on contact_requests to anon, authenticated`
      - [ ] `grant select on faqs to anon, authenticated` (+ faqs RLS public-read policy)
      - [ ] **⚠️ every NEW table that anon reads/writes needs its own grant — check before launch**
- [ ] **5. `auth-migration.sql`** — profile-creation trigger, migrated-user detection function (SECURITY DEFINER), user_teams owner RLS
- [ ] **6. FAQ seed** — 7 real advertiser FAQs (title, content, sort 1–7)
- [ ] **7. Create auth users** — via Supabase Admin API (this also triggers password-reset emails to the 2,834 migrated users). NOT the dev-seed shortcut — the real Admin API cutover.
- [ ] **8. `migration.sql`** — the 2,834 users / 112 events / 2,121 reviews / etc. Run AFTER auth users exist (profiles FK).

---

## B. Manual SQL — verify each is captured as a migration file

*(Anything applied via SQL Editor by hand goes here until confirmed it's also in `supabase/migrations/`. Once confirmed, it's covered by section A.)*

- [ ] anon SELECT grants (events/reviews/etc.) — applied manually early; CONFIRM in a migration file
- [ ] advertiser grants + FAQ seed — Claude Code committed as migration `...advertiser_grants_and_faq_seed.sql` ✓ (verify content matches real FAQs)
- [ ] auth-migration.sql — CONFIRM committed as migration
- [ ] (add any future manual SQL Editor pastes here)

---

## C. Third-party credentials (need client's accounts — build now, activate at cutover)

- [ ] **Geocoding** (Google Places or Mapbox API key) — for real distance filtering; app built to add later
- [ ] **Stripe** — publishable + secret keys, webhook secret — for premium/ads payments
- [ ] **SendGrid** — client's account access + new API key for the app (password resets, notifications, promo emails)

---

## D. Domain & hosting (cutover moment — coordinate, don't do early)

- [ ] **SendGrid domain authentication** — SPF/DKIM/CNAME DNS records so emails are trusted (may carry over if domain unchanged)
- [ ] **Point app domain to Vercel** — A/CNAME records; switches live site from Bubble to new app. THIS IS THE GO-LIVE SWITCH.
- [ ] **Confirm who controls DNS** — you, client, or Franco (coordinated handoff if not you)
- [ ] **Vercel env vars** — production Supabase URL + anon key, Stripe keys, SendGrid key, etc. (never commit secrets)

---

## E. Post-cutover verification (test on production before announcing)

- [ ] anon can read events/reviews (landing + search show data)
- [ ] contact form saves to contact_requests
- [ ] FAQ page shows the 7 real FAQs
- [ ] fresh signup → onboarding → login works end to end
- [ ] **migrated-user first login shows "reset password" guidance (test with a REAL migrated email)**
- [ ] password reset email actually delivers (depends on SendGrid/SMTP)
- [ ] Stripe payment flow works (depends on Stripe keys)
- [ ] rotate the database password after cutover (it went through screenshots during dev)

---

## Notes / open decisions
- Franco import: structured feed (script) vs. admin UI — affects scope. STILL OPEN.
- Stripe day-one vs. fast-follow — client decision. STILL OPEN.
- Reconcile any dev-only manual SQL into migrations before cutover.
