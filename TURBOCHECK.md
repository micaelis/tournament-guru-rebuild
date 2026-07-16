# Turbo Check — Tournament Guru rebuild

**Commit audited:** `063a956` (branch `rebuild`, 91 commits from `main`)
**Scope:** verify RG1 remediation is systemic, Slice 8 housekeeping didn't
introduce new rot, nothing gates a Release cut.

**Baseline:** `npm run typecheck` clean · `npm run lint` 0 errors / 3
warnings (all `<img>` on public pages, deferred) · `npm test` 45/45 pass
across 11 files in ~14 s · CI green on push.

---

## Scorecard

| Dimension | Grade | One-line justification |
|---|---|---|
| Architectural coherence   | A− | One skeleton — three client factories, one shared UI library, one server-actions pattern, one DEFINER-view identity path. Skeleton walk (forward + backward) is coherent. |
| Systemic-fix discipline   | A  | Every one of the 29 SECURITY DEFINER functions is guarded, revoked, or documented-safe. Every public path routes identity through a DEFINER view. The RG1 pattern-classes are fixed at their roots, not their symptoms. |
| Dead code & references    | B  | README + DEPLOYMENT still describe the pre-rebuild codebase (real handoff risk). Four small orphan components/exports. Two DB tables (`regions`, `event_milestones`) written by no code path — one is leaky. |
| Runtime verification      | A− | 45 probes exercise the security floor, the promo flow end-to-end, RLS grants, claim atomicity, validation. `event_milestones`-empty is the one class-of-things-that-can-never-work not exercised. |
| Professional consistency  | A  | Single convention for every job (Server Actions, RPCs, error handling, casing, migration naming). Enforced by tsc-strict + eslint + CI. |

---

## Findings

### Critical
**None.** The RG1 security floor is genuinely systemic. Every SECURITY DEFINER
function has a documented category (guard / revoke / anon-safe / auth-safe);
every public reader routes through the DEFINER views. Two separate
independent sweeps could not surface a sibling of C1/C2/C3/C4/H1/H2 that
wasn't fixed.

### High

- **[H-DOC-1] Onboarding docs are pre-rebuild.** `README.md` + `DEPLOYMENT.md`
  reference `lib/supabase/queries.ts` (deleted), `app/api/events/search/`
  (deleted), `supabase/proposals/*` (deleted), `AUDIT.md` + `CHANGES.md`
  (both deleted), `scripts/generate-seed-dummy.sh` (deleted), and the old
  `20240101…`-prefixed migrations (renamed). `CLAUDE.md` is correct; the
  outward-facing docs would actively mislead a new engineer or a client
  handoff. Pattern class: "delete cascade didn't propagate to authoring
  docs." Instance count: 2 files, ~15 broken references.
  - _Failure scenario_: a new engineer follows README to set up local dev,
    tries to run `bash scripts/generate-seed-dummy.sh`, immediate failure.
  - _Fix location_: rewrite both files to match the current tree; the
    canonical picture is already in `CLAUDE.md` — cross-reference.

### Medium

- **[M-DEAD-1] Orphan UI + dashboard shells.** No importer:
  `app/dashboard/SliceStub.tsx`, `app/components/ui/Chip.tsx`,
  `app/components/ui/Spinner.tsx`, `CardHeader` in `app/components/ui/Card.tsx`,
  `countEventsPerTournament` in `app/dashboard/events/queries.ts`. Pattern
  class: "primitives added early / never retired when replaced." 5 instances.
  - _Failure scenario_: none functionally; adds noise, dilutes the "one way
    to do X" claim if someone later imports `Chip` instead of `StatusPill`.
  - _Fix location_: delete the files + trim the barrel export
    (`components/ui/index.ts`).

- **[M-DEAD-2] `event_milestones` has no writer.** The public event page
  reads + renders the section (`app/(site)/events/[id]/page.tsx:75`), the
  Add/Edit Event form has no editor for it, so the section will always be
  empty on every real event. `event_milestones` was Slice 1's "premium key
  dates" feature the spec deferred. Pattern class: "read path shipped
  without the write path."
  - _Failure scenario_: user hits a premium event, expects to see "Early-
    bird ends / Registration closes" milestones, sees nothing. Doesn't
    break — just a false promise.
  - _Fix location_: either wire the form (write path) or hide the render
    (read path) until the write path exists. Report at Med not High because
    the empty section is invisible when the list is empty, so it fails
    graceful.

- **[M-DEAD-3] Dead reference tables + dead-write tables.**
  - `regions` — seeded I–IV; code uses hard-coded `EVENT_REGIONS` in
    `lib/enums.ts` for both write and read. Table exists to satisfy a FK
    from `events.region`? No: `events.region` is an enum column, not a FK.
    So `regions` is genuinely dead.
  - `contact_requests` — table + RLS + rate-limit trigger, no writer. The
    support form uses `support_messages`; the old public-marketing contact
    form was cut with the rebuild. Pattern class: "table survived the
    feature it existed for."
  - `notifications`, `cards`, `transactions` — schema-deferred features
    from BUILD-PLAN.md, intentional; not findings.
  - _Fix location_: drop `regions` (or make `events.region` a real FK if
    the enum should ever be extended by data). Drop `contact_requests` +
    its RLS + its rate-limit trigger, or wire a contact form.

### Low

- **[L-ENUM-1] `promo_status.'staged'` is unreachable.** The default value
  on the column is `'staged'`, but every insert (`send-actions.ts:119`)
  explicitly sets `'sent'`. Pattern class: "enum entry never touched by
  code path." One instance.
  - _Fix location_: either drop `staged` from the enum + remove the
    `default`, or drop the explicit `status: 'sent'` and let the column
    default apply. Second is cheaper.

- **[L-WIRE-1] `getMyReviewForEvent` selects `last_name` on the self join.**
  The caller IS the author (RLS-scoped `.eq("author_id", userId)`), so
  reading `last_name` here is harmless — but wire-waste. The pattern of
  "read only what the render needs" is otherwise consistent; this is the
  one drift.
  - _Fix location_: trim the projection in `lib/reviews/queries.ts:154`.

- **[L-SQL-1] `apply_promo_to_review` "review not found" uses AND instead
  of OR.** `if v_author is null and v_review_event is null` — both must
  be null to consider the row missing. Since a real review has non-null
  event_id + non-null author_id (RLS won't let it be null on insert), a
  malformed lookup where only one column is null would fall through — but
  the follow-up `if v_author <> auth.uid()` would then reject non-owners
  correctly. Semantic nit; no security impact.
  - _Fix location_: change AND → OR at
    `supabase/migrations/20260716000011_review_gate_1_security_floor.sql:268`.

---

## Verification ledger

| Subsystem | Class | Evidence |
|---|---|---|
| C1 signup trigger coerces user_type | Proven | `tests/probes/c1-signup-privilege-escalation.test.ts` — 3 tests |
| C2 destructive definer guards | Proven | `tests/probes/c2-definer-guards.test.ts` — 7 tests |
| C3 apply_promo_to_review validation | Proven | `tests/probes/c3-apply-promo.test.ts` — 3 tests |
| C4 promo landing flow | Proven | `tests/probes/c4-promo-flow.test.ts` — 3 tests |
| H1 public identity via DEFINER views | Proven | `tests/probes/h1-public-views.test.ts` — 3 tests |
| H2 ED step-3 completion | Proven | `tests/probes/h2-onboarding-step3.test.ts` — 1 test |
| S8.1 platform_counters bump on insert | Proven | `tests/probes/platform-counters.test.ts` — 1 test |
| S8.2 re-auth before delete-my-account | Proven | `tests/probes/reauth-delete.test.ts` — 2 tests |
| RLS write refusals | Proven | `tests/probes/rls-writes.test.ts` — 5 tests |
| Claim RPC atomicity + admin-only | Proven | `tests/probes/claim-flow.test.ts` — 2 tests |
| App-level validators | Proven | `tests/probes/validation.test.ts` — 13 tests |
| CI regression tripwire | Proven | `.github/workflows/ci.yml` run 29465381020 — SUCCESS |
| Event milestones write path | **Assumed** | Never fires from app code; only exercisable via `psql` insert. Probe would be: create a milestone via `.from("event_milestones").insert(...)` from the ED's client and confirm RLS accepts it. |
| Public event page rendering with no reviews / no owner / anon | Static-only | Compiles and typechecks. No headless probe against a rendered page. Probe: `curl` `/events/<id>` from a fresh session and diff the HTML for anon vs authed. |

---

## Proposed fix plan

Ordered small→large; each commit atomic and easy to revert.

1. **Trim orphan primitives + dead barrels (M-DEAD-1).** Delete
   `SliceStub.tsx`, `Chip.tsx`, `Spinner.tsx`, `CardHeader`, and
   `countEventsPerTournament`; drop the corresponding entries from
   `components/ui/index.ts`. Verify with `npm run build`.

2. **Retire dead-write tables (M-DEAD-3).** Migration that drops
   `regions`, `contact_requests`, plus the `contact_requests` RLS
   policies + its rate-limit trigger. Leave `notifications` / `cards` /
   `transactions` (spec-deferred, tables kept intentionally). Update
   `SCHEMA-DESIGN` references if needed.

3. **Wire OR hide `event_milestones` (M-DEAD-2).** Recommend hiding the
   render for now (change one condition on the read side) and log the
   write-path work in DECISIONS as "premium key-dates editor deferred."
   Cheaper than adding an editor + gated by premium.

4. **Rewrite README + DEPLOYMENT (H-DOC-1).** Replace both from scratch,
   cross-reference against `CLAUDE.md`. Include: real file tree, real
   commands (`npm test` is new), CI badge, migration count, real bucket
   / storage story (deferred), the `.env.local` shape.

5. **SQL micro-fixes (L-ENUM-1, L-SQL-1).** One migration that:
   - Drops the `status: 'sent'` from `send-actions.ts` insert (or drops
     `staged` from the enum); simpler is the action-side change.
   - Fixes AND→OR in the apply_promo_to_review "review not found" guard.

6. **Trim `last_name` from `getMyReviewForEvent` (L-WIRE-1).**

None of these change external behavior. All changes to the read paths
have existing probes that will re-run in CI and either stay green or
surface a regression immediately.

---

**Awaiting approval — nothing has been changed.**
