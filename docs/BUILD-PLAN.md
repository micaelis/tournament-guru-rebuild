# Tournament Guru — Build Plan & Autonomy Setup

How to run the rebuild as a sequence of **unattended slices**: configure Claude Code
once so it runs safely without you, then work through the slices below — each is a
self-contained unit you kick off, step away from, and review at the end.

---

## Part 1 — One-time setup (do this before Slice 0)

### 1. Branch
```
cd tournament-guru
git checkout -b rebuild
```

### 2. Autonomy config — `.claude/settings.json`
Auto-approves safe build work; **hard-blocks** anything that could touch your live
staging DB or history. This is what makes "walk away" safe.
```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Read", "Write", "Edit",
      "Bash(npm run *)", "Bash(npm install*)", "Bash(npx tsc*)",
      "Bash(git add *)", "Bash(git commit*)", "Bash(git checkout -b *)",
      "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)",
      "Bash(supabase db reset)", "Bash(supabase migration*)", "Bash(supabase start*)"
    ],
    "deny": [
      "Bash(supabase db push*)",
      "Bash(supabase db reset --linked*)",
      "Bash(supabase link*)",
      "Bash(git push*)",
      "Bash(git reset --hard*)",
      "Bash(rm -rf *)",
      "Bash(*curl*| bash*)"
    ]
  },
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit", "callback": "npm run typecheck" }
    ]
  }
}
```
Note: local `supabase db reset` is ALLOWED (you need it to test the schema); the
`--linked` / `db push` / `link` variants are DENIED (those would wipe staging).

### 3. Standing autonomy instruction (paste at the start of every slice)
```
Work through this entire slice autonomously. Do NOT stop to check in.
Make reasonable decisions and log each non-obvious one in DECISIONS.md.
Commit after each step with a clear message; keep commits atomic.
Verify with `npx tsc --noEmit` and `npm run build` after each step (NO preview server).
Only pause if: an action is denied by settings, you would change external
behavior or a public API, you encounter a secret, or a choice is genuinely
ambiguous AND irreversible. Otherwise keep going until the slice is done,
then give me a summary + the DECISIONS.md diff for review.
```

### 4. Operating mode
Start each slice with `claude --permission-mode plan`, let it produce the plan,
approve once → it executes unattended. Review at the slice boundary, not mid-slice.

---

## Part 2 — Slice sequence (dependency-ordered)

Each slice lists: **goal · depends on · builds · done-when**. Build them in order;
review between them. Deferred items (payments, notifications delivery, Spotlight
search strip) stay parked — flags/tables exist, no UI.

### Slice 0 — Foundation  *(everything depends on this)*
- **Goal:** a runnable app on the new schema with auth and the shared UI kit.
- **Depends on:** nothing.
- **Builds:**
  - Make `schema.sql` the migration baseline; `supabase db reset` on a FRESH LOCAL db, fix any semantic errors.
  - Keep reusable plumbing (Supabase client factories, middleware, lib/rate-limit, lib/url, CLAUDE.md conventions).
  - Auth + onboarding per `Auth & Onboarding` spec (3 steps, role lock, mandatory-field gating, blocked-user handling, reset flow, generic anti-enumeration).
  - Dashboard shell (role-based sidebar) + **shared component library**: buttons, chips, the 5 status pills, cards, metric strip, table rows, empty states, star ratings — matching the mockups. These become the primitives every page reuses.
- **Done when:** you can sign up → onboard → land on a role-correct dashboard shell; tsc + build clean.

### Slice 1 — Events (ED + Admin)  *(the flagship)*
- **Depends on:** 0.
- **Builds:** tournaments + events CRUD; ED Events page (tournament groups, metric strips, event rows, status derivation); Add/Edit Event form (age groups, sponsors, surfaces, levels, milestones, premium section); internal event detail; duplicate / copy-link; premium/General Ad flags; Admin Events variant (search-by-owner, owner column, CSV export matching filters, QR generate/open).
- **Done when:** an ED can create a tournament + events, publish/draft/cancel, and see correct derived statuses + metrics; admin variant works.

### Slice 2 — Reviews & engagement
- **Depends on:** 1 (needs events to review).
- **Builds:** review form (6 categories + would_return + title/body, banned-word + sanitize, char cap); review cards; threaded comments + owner-ED reply; Helpful toggle; flag flow + per-user hide; ratings recalc (event + tournament, would_return_pct); Reviews dashboard (ED/Admin) + My Reviews (attendee); banned-words admin CRUD; public event reviews section.
- **Done when:** a review publishes, aggregates recompute, comments thread, flag hides for the flagger, drafts stay private.

### Slice 3 — Promo system
- **Depends on:** 1 + 2 (CSV → promo → verified review).
- **Builds:** CSV upload (private bucket, signed URLs); submitted_csvs review flow; promo generation (nanoid token + 8-char code, dedupe, blocked-user skip); the promo-review **3rd auth variant**; **bulk-send background queue** (Inngest/Trigger.dev/QStash — batched, idempotent, retries); Promo Codes pages (ED/Admin) + attendee Promo Codes tab; funnel tracking (collect, no UI).
- **Done when:** ED uploads a CSV → admin approves → codes generate + emails queue → a coach lands via link → publishes a verified review atomically.

### Slice 4 — Claim system
- **Depends on:** 1.
- **Builds:** claim_requests (tournament-level); Claim CTA on event cards (anon + signed-in states); the ED-claim auth variant; admin Claim Requests page (approve/decline, atomic ownership transfer across tournament + siblings, auto-decline others); ED Claim Requests view.
- **Done when:** an unclaimed admin-created event can be claimed, approval transfers ownership, siblings + tournament follow.

### Slice 5 — Public discovery
- **Depends on:** 1 + 2 (displays events + reviews).
- **Builds:** landing (stats, popular searches, Featured Events = premium+Spotlight, dummy recent reviews); search events page (filters, sticky map, distance-from-me, states, sort); public event details page (media grid, host info, ratings breakdown, sponsors, key dates); public ED page; directors directory. Match the tgredesign design language.
- **Done when:** public can browse/search/filter events and read reviews; not-found placeholder on deleted events.

### Slice 6 — Account & activity
- **Depends on:** 0 (light deps on 1/2 for counts).
- **Builds:** account tabs per role (Profile, Security with re-auth + account delete → the deletion/anonymize routines, Preferences, Notifications settings UI); favorites; activity/recently-viewed (capped 50); support form (SendGrid via server action); FAQ display.
- **Done when:** users manage their profile/teams, favorite events, delete accounts (with anonymize-and-disclose), contact support.

### Slice 7 — Admin content ops
- **Depends on:** 2 (flagged content needs reviews/comments).
- **Builds:** admin Flagged Content (reviews + comments tabs, dismiss/delete); admin Users page (block/delete); FAQ admin CRUD; any remaining admin surfaces.
- **Done when:** admin can moderate flagged content, block/delete users, manage FAQs.

### Slice 8 — Release & Handoff  *(final)*
- **Depends on:** all prior slices.
- **Goal:** a clean, GitHub-ready repo that looks built-from-scratch on the new schema, with a populated demo DB.
- **Builds / does:**
  1. **Dummy seed data.** Generate `supabase/seed.sql` with realistic fake data for the new schema — tournaments, events (varied statuses + premium/Spotlight), reviews (coach + attendee, some Guru), profiles (all roles, emails as `<name>@example.test`), promos, claims, favorites — enough to populate EVERY page. Verify `supabase db reset` yields a fully browsable app, not empty pages. (This is dummy data ONLY — NOT the real Bubble data.)
  2. **turbo-check** across the finished app: no dead code, no dangling refs, fixes systemic. Fix findings.
  3. **Consolidate migrations.** `schema.sql` = the single baseline migration; archive the old Bubble-era + audit migrations (they describe the dead model — keep them only in the old private repo's history). A fresh `db reset` must build the whole new schema from the baseline + seed alone.
  4. **Docs:** rewrite `README.md` (what it is, setup from scratch, architecture, the DB note below); add `.env.example`, `LICENSE`; ensure `CLAUDE.md` reflects the new model. REMOVE stale/outdated working files. Do NOT include AUDIT.md / CHANGES.md / TURBOCHECK.md (old-model artifacts — they stay in the private repo).
  5. **Secret scan** across tracked files + git history (service_role key, real .env, PII). Report before publishing.
  6. **Clean release repo (the "first pass" look):** copy the final tree into a FRESH folder, `git init`, clean initial commits, push to a NEW private GitHub repo. The existing `tournament-guru` repo stays as private working history. The release repo shows only the finished app on the new schema.
- **Then, when ready (separate, ordered, with your go-ahead each step):**
  7. **Scrub staging Supabase → new schema + seed.** ONLY after the rebuild runs and AFTER confirming the real source data still exists in Bubble (or a backup). Reset the staging project to the new schema + dummy seed so there's a live demo DB matching the code. (Never `db reset --linked` blind — back up first.)
- **Required files in the repo:** `README.md`, `.gitignore`, `.env.example`, `package.json` + lockfile, `supabase/migrations/` (new baseline), `supabase/seed.sql`, the source.
- **Good-practice files:** `LICENSE`, `CONTRIBUTING.md` (or a short dev-setup doc), `CLAUDE.md`, `DECISIONS.md`, CI + formatter/lint config.
- **README database note (adapt):**
  > **Database:** Runs on Supabase. Schema is in `supabase/migrations/` (baseline `<ts>_baseline.sql`), from the model in SCHEMA-DESIGN.md. Local setup: `supabase start && supabase db reset` — this also loads `seed.sql`, so you get a fully populated demo database out of the box.

### Deferred (not this build) — parked, flags/tables exist
Payments/Stripe (Payment Methods, Transactions, Add-on Pricing, the paywall),
Notifications delivery, the Spotlight search strip (sprint 2), the admin funnel dashboard,
and the real Bubble-data → new-schema migration (a separate production ETL, NOT in this repo).
Marked in code as intentional deferrals so a reviewer/turbo-check reads them as known.

---

## Part 2.5 — Testing (applies to every slice)

The specs encode explicit rules — turn them into tests. **Test alongside each slice**,
not in one phase at the end. Each slice's "done when" now also requires its tests green.

Layers (highest value first):
1. **RLS / security tests** — the security boundary is the DB, so this matters most.
   Hit the DB as anon / test-user / service-role and assert access. Automates the audit's
   anon-key checks + the C1 self-promote exploit as permanent regressions. Examples: anon
   can't read reviewer email/DOB; a user can't set user_type='admin' or guru_review/published;
   drafts hidden from others; owner-only event/tournament writes; promo/claim scoping.
   Tooling: **pgTAP** (`supabase test db`) or **supabase-js integration tests (Vitest)**.
2. **Business-logic / RPC tests** — status derivation from dates; NULL-aware averaging;
   ratings recalc rolling up to tournament; would_return_pct; promo apply atomicity (guru set
   + applied + siblings void + one-review-per-event); deletion/anonymization (detach+snapshot
   vs anonymize); counters survive deletion. Seeded fixtures against the SQL functions.
3. **Server-action / validation tests (Vitest)** — password rules; onboarding-complete gating;
   server-side banned-word rejection; 400-char cap; anti-enumeration reset message; rate limits.
4. **E2E flow tests (Playwright)** — the cross-feature chains: signup→onboard→dashboard;
   tournament→event→publish→correct status; coach via promo link→verified review→shows on
   event with recomputed ratings; claim→approve→ownership transfers to siblings;
   account delete→anonymize. These catch the SEAMS BETWEEN SLICES.
5. Baseline: tsc + lint + build (already required per step).

Structure:
- **Backfill now:** slices 0–3 were built without tests — add their RLS + logic + validation
  tests before continuing (or at the next gate).
- **Going forward:** every slice ships with its tests; "done when" includes tests green.
- **Release (Slice 8):** the E2E integration pass over the full cross-feature chains.
- Fold the audit's 12-test runtime smoke into this suite as automated security regressions.
- Wire the suite into CI (or at least a single `npm test` that runs unit + RLS + logic; E2E separately).

## Part 3 — Per-slice kickoff (paste to start each one)
```
Starting Slice <N>: <name>. Source of truth: the docs/ folder (SCHEMA-DESIGN.md,
SPECIFICATION.md, STYLE-GUIDE.md) and the tgredesign design language.
[+ the standing autonomy instruction from Part 1.3]
Plan the slice first (plan mode), show me the breakdown, then execute it all.
```

## Part 4 — Review gate between slices
At each slice boundary, before starting the next:
1. Read the slice summary + DECISIONS.md diff.
2. Skim the commits (atomic, so easy to scan).
3. Confirm tsc + build clean; spot-check the new pages.
4. Optionally run the **turbo-check** skill on the slice to confirm fixes were systemic and no dead code / dangling refs crept in.
5. Green-light → start the next slice.

Order recap: **0 Foundation → 1 Events → 2 Reviews → 3 Promo → 4 Claim → 5 Public → 6 Account → 7 Admin ops → 8 Release & Handoff.**
