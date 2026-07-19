# Testing — coverage map

What's tested, at which layer, and where it lives. Update this doc whenever you add or
materially change coverage — it's the index the next session reads before writing tests.

## Two layers

- **Vitest RLS/logic probes** (`tests/probes/*.test.ts`) — DB-level authorization + invariants
  against a real local Supabase (schema + seed built from zero). These are the security floor:
  a Gate-1-class regression flips one red. Harness: `tests/harness.ts` (anon + service-role
  clients).
- **Playwright E2E** (`e2e/*.spec.ts`) — real browser click-through of user journeys. The
  Playwright webServer does its own production build/serve against the same local Supabase and
  seeds users via the service role.

Both run in CI (`.github/workflows/ci.yml`) against a fresh DB on every push to `rebuild`/`main`.

## Running

```
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest run — the RLS/logic probes
npm run e2e           # playwright test — the E2E specs
```

⚠ Never run `preview_start` on this repo — the Supabase websocket keeps the preview from
idling and the pane stays blank. Verify via typecheck + build + `npm test` + `npm run e2e`.

## Layer 1 — RLS / logic probes (`tests/probes/`)

| Probe | Guards |
|---|---|
| `c1-signup-privilege-escalation` | Anon can't self-signup as admin; `handle_new_user` coerces `user_type` to a safe value. |
| `schema-drift` | Replays every `.from().select()` in `app/`+`lib/` against the live DB with `limit(0)`; fails on 42703/42P01 so a renamed or dropped column can't ship behind a swallowed error (S8.6). Still the required RUNTIME layer after generated types landed (S10.17): legacy `as unknown as` casts on query results blind the compiler, so this probe is what covers the cast sites until they're removed per-file. |
| `h0-search-error-surfacing` | A facet sub-query failure inside `searchEvents` rejects instead of collapsing into a successful "0 events" result; invalid filter input (unknown enum values, malformed dates, hostile `q`) is dropped/tolerated rather than becoming a query error (S8.8). Runs the real `searchEvents` via the `@/` + `server-only` vitest aliases. |
| `error-surfacing` | The sibling class (S8.9): content reads (director profile/events/reviews, ED review scoping, banned-words list) REJECT on a query failure instead of rendering a plausible empty state; `getEventDirectors` returns the designed `source:"unavailable"` marker; landing chrome degrades but always logs. Real PostgREST errors via a table-rewriting proxy. |
| `flag-orphans` | No delete path leaves orphaned `flagged_content` / `content_hidden` rows: the AFTER DELETE triggers (20260718000009) purge both tables on review/comment deletes, including FK-cascaded comments and child replies; plus a whole-table orphan sweep (S8.10). |
| `h8-password-validation` | The account `updatePassword` action enforces the full password policy server-side — a weak password returns a field error and provably never reaches auth (sign-in proof); `updateProfile` rejects a malformed `business_email` before writing (S8.11). |
| `uri-length` | Unbounded `.in()` id lists batch through `lib/supabase/in-chunks` — 260 seeded tournaments drive the admin events query without "URI too long", cross-batch sort preserved; chunkIds edges (S11.6). |
| `search-id-batching` | `searchEvents` with a facet matching 260 events (past the ~200-UUID URI limit) resolves with the full count: sort keys fetched per 150-id chunk, ordered app-side (premium first, then the sort key, created_at/id tie-breaks), pages tile the sorted order exactly with no duplicates or gaps, and intersection semantics survive the batching (a second facet narrows, an empty intersection stays empty). Mutation-verified against the pre-fix single `.in()` ("URI too long") (S11.7). |
| `h5-search-log` | `/api/search-log` returns handled bodyless 204s for empty/malformed input instead of an uncaught 500 (the NextResponse-204 construction bug), persists valid terms, and 429s the 31st burst request per IP via the app-layer `rateLimit()` (S8.12). |
| `c2-definer-guards` | Destructive / definer RPCs reject non-owner, non-admin callers; trigger-only helpers aren't callable via PostgREST. |
| `c3-apply-promo` | `apply_promo_to_review` validates the full chain (attacker case, wrong-email case, legit path). |
| `c4-promo-flow` | Flagship flow: CSV → promo issued → anon lands → coach signs up (matching email) → claim → publish review → guru badge set. |
| `h1-public-views` | Public reviewer/host identity reads go through DEFINER views; no PII (last_name, email, DOB) leaks on a direct table read. The attendee name rule (S11.5): `last_initial` is served by `review_author_public` and `public_attendees` while selecting `last_name` on them errors; `public_attendees` excludes EDs and blocked users. Also asserts the views are **read-only**: anon and authenticated-non-owner cannot INSERT/UPDATE/DELETE through any of the five `public_*` views, and no write reaches `profiles` (S8.5). |
| `h2-onboarding-step3` | `preferences_completed` drives the wizard; an ED skipping the optional step advances cleanly. |
| `event-tier-escalation` | ED cannot self-upgrade `is_premium` / `is_general_ad` (column grant + RPC guard); admin CAN via `admin_set_premium` / `admin_set_general_ad`. |
| `rls-writes` | Write authorization across roles (who may insert/update/delete which rows). |
| `claim-flow` | Claim approve/decline ownership transfer + sibling auto-decline. |
| `validation` | Server-side input validation is authoritative; draft allows null dates; end ≥ start CHECK enforced at DB. |
| `platform-counters` | Counter invariants (published-reviews total increments, never decrements on delete). |
| `reauth-delete` | Account deletion / anonymize-and-scrub behavior. |
| `review-eligibility` | Attendee CAN write reviews; ED/admin/blocked CANNOT (RLS). Guru/verified blocked on non-paid events; succeeds on paid. |
| `write-error-surfacing` | The mutation-side twin of `error-surfacing` (S9.3): a failed WRITE reaches the caller instead of reporting success. For `saveEvent`/`duplicateEvent` the proxy now breaks the `save_event_graph` RPC call itself (S10.9 moved the child writes inside it) and asserts the error surfaces AND the collections survive — a failed save is a no-op. The per-table/per-verb breaks still pin the remaining PostgREST fan-out sites (faq_audiences, updateTeams, favorites, flagContent, saveReview). |
| `save-event-graph` | The atomic event-graph RPC (S10.9). Authz mirrors `p_events_write`, driven below the action: anon rejected + writes nothing; attendee rejected even owning the tournament (isolates the role guard); ED can't INSERT into another's tournament (parent gate); ED can't UPDATE an event they don't own even inside their own tournament (owner guard, seeded as the S10.2 graft aftermath); owner create/update lands the whole graph; admin create lands unclaimed/claimable (S1.1). Atomicity: a poisoned LAST collection (milestone with null title) rolls back the base row and every earlier collection byte-for-byte. Mutation-verified 4 ways — role guard, owner guard, parent gate, and an exception-swallowing milestones insert each flip exactly their own tripwire. |
| `search-distance` | The distance filter's tier math (fixtures straddling every threshold, incl. 149 vs 151 mi), its intersection with the facet filters (never widens, empty intersection stays empty), and no-coords events being excluded from every tier while still listed with the filter off. Also pins that miles-without-a-center is inert (the no-origin case). Mutation-verified against a wrong Earth radius, a replaced-instead-of-intersected id set, and a too-narrow bounding box (RG10.1). |
| `event-edit-grants` | An ED can actually SAVE an existing event: the update-intent path persists, publish flips a draft to `active`, and `id` stays unwritable. Guards the `upsert` → INSERT/UPDATE split (S9.2) — `upsert` put `id` in PostgREST's `ON CONFLICT DO UPDATE SET` list, which the events UPDATE grant denies, so every edit and every publish-a-draft failed. **This path had no e2e coverage**, which is why it shipped broken. |
| `promo-eligibility` | `promo_email_eligibility` (S10.12), the CSV pre-flight bridge: anon + attendee callers rejected (42501), ED + admin allowed; the §6.3 matrix classified in input order (no account / coach → eligible, blocked coach → blocked, ED / admin / non-coach role → wrong-user-type); rows carry (email, status) ONLY; case-insensitive match echoes the caller's input; the S10.15 input cap (1001 raises 22023 for ED + admin, exactly 1000 answers). Mutation-verified: dropping the host gate, collapsing the wrong-user-type arm, and reinstalling the uncapped body each fail exactly their own tripwire. |
| `admin-email-search` | `admin_search_users_by_email` (S10.10), the email→id bridge behind the admin Users search: anon and non-admin callers raise 42501, an admin resolves an email substring to matching ids ONLY (the return shape can't carry an address), and a blank term returns nothing (no directory dump). Mutation-verified: dropping the admin predicate fails the non-admin tripwire while the anon layer (EXECUTE revoke) still holds. |
| `submitted-csv-host-gate` | submitted_csvs writes require `is_event_host()` + event ownership, not just `ed_id = self` (S10.5). The old ownership-only policy let an attendee POST a row dumping arbitrary `raw_emails` into the admin queue, and let an ED submit against another ED's event. Mutation-verified: reverting to `p_csv_rw` fails the attendee-injection + cross-event tripwires. Also pins UPDATE as admin-only (S10.7): an ED cannot flip their own row to `approved`; an admin can reject. And pins the ED DELETE arm as pending-only (S10.16): an ED cannot delete an approved/rejected row (RLS filters it, row survives), can still cancel a pending one, and an admin can delete reviewed rows. Mutation-verified: reintroducing the owner UPDATE arm fails the self-approve tripwire; reinstalling the status-blind DELETE arm fails the reviewed-row tripwire. |
| `storage-rls` | **Storage security floor (C-1 class, S10.4).** Drives the real Storage API: the private `promo-csv` bucket is isolated — anon can't download (API or public URL) or list, a non-owner ED can't read another's CSV, owner + admin can, and a signed URL works. Owner-scoped writes — a non-owner can't INSERT under (or DELETE from) another owner's `<uid>/` folder in any bucket, anon can't write at all, owner/admin can. Bucket-level mime + size limits reject wrong-type / oversized uploads server-side. Deny tests use fresh names + `upsert:false` so they're true INSERTs (an upsert onto an existing object routes through UPDATE and masks an INSERT hole). Symmetry probes (S10.8): cross-owner overwrite (`upsert:true`) and `update()` are denied with the object surviving byte-identical, the owner can still overwrite their own, and a non-owner/anon cannot `createSignedUrl` another's CSV. Mutation-verified against 8 independent policy/bucket weakenings + the signed-URL read-policy widening; the overwrite denial additionally holds at the storage service's own owner check even with RLS widened. |
| `tournament-crud` | The tournament + child-event CRUD lifecycle across the full role×operation matrix (see the matrix below): create ownership/claimed stamping per role, draft-vs-published read visibility, update persistence + cross-role denial, and delete cascade with review DETACH + snapshot. Drives the real `createTournament`/`updateTournament`/`deleteTournament` actions. Mutation-verified: dropping the ownership half of `p_tournaments_write` fails the ED-non-owner cell; dropping `delete_tournament`'s ownership guard fails the ED-non-owner, attendee, and cascade/detach cells. |
| `definer-null-uid-guard` | **CRITICAL (S10.3).** The six destructive SECURITY DEFINER functions reject a NULL `auth.uid()`. `not (is_admin() or owner = auth.uid())` evaluates to NULL for anon — not false — so the guard fell through and anon could destroy any claimed tournament + its events and anonymize/scrub/delete any account. Each test asserts the call is refused AND the data survived (a revoke alone would satisfy only the former). Mutation-verified three ways, incl. anon re-granted with guards fixed (still green — the guard alone suffices). Complements `c2-definer-guards`, which covers the authenticated non-owner. |
| `event-host-write-gate` | Tournament/event writes require `is_event_host()`, not just row ownership (S10.1). An attendee satisfied the old `owner_id = auth.uid()` predicate by writing their own id, and `owner_id`/`claimed`/`lifecycle` are all grantable — so they could publish a tournament + `active` event that anon then read out of public discovery. Pins the whole chain closed plus the ED/admin positive cases. Mutation-verified: the ownership-only policies fail the 3 create-path tripwires. |
| `event-parent-tournament-gate` | An event write is authorized against its PARENT tournament, not just its own `owner_id` (S10.2). Both columns are caller-supplied, so ED-B could graft (or reparent) an event onto ED-A's tournament and pollute its rollup ratings via `recalc_tournament_ratings`. Pins insert + reparent + rating-pollution closed, and the ED-own / admin-unclaimed / admin-edits-claimed-event cases open. Mutation-verified: dropping the parent EXISTS fails the 3 attack paths. |
| `seed-accounts` | The `supabase/seed.sql` demo accounts (attendee / ED / admin) sign in via the password grant with a session + an `email` identity. Guards the seed's raw `auth.users` insert — the only accounts NOT created through the Auth admin API, so no other test exercises them (SEED.1). |

## Layer 2 — E2E journeys (`e2e/`)

| Spec | Covers |
|---|---|
| `auth` | Login, signup (type→role), password reset, variant screens. Terms consent (S11.2): checkbox + new-tab legal links render, a checked signup completes to onboarding, and an unchecked submit with the client `required` stripped is rejected by the SERVER with typed values preserved. |
| `onboarding` | The 3-step (attendee) / 4-step (ED) wizard + guards. |
| `discovery` | Public browsing: landing, search, event detail, director pages. Includes the host-avatar shape/fit assertion (Avatar primitive, S8.13). Public ED page (S11.4): identity row (ED picture + name), events sort control defaulting to publish date, reviews tab rendering the shared review card with comments affordance + event-context chip. Public attendee page (S11.5): "First L." name rule (full last name absent), capacity metric blocks, Verified-Coach/Attendee filter, GURU badge, and the review-card identity link pointing at /attendees/[id]. Privacy/Legal pages render the provided copy verbatim (S11.1). |
| `dashboard` | Role-based dashboard shells render (incl. the ED/Admin owned-tournament render guard). Admin Users search: finds a seeded user by EMAIL (the term no profile column carries, proving the auth.users bridge), and Block/Delete are reachable from the filtered row (confirm dialog opens). |
| `reviews` | Review display + submission flow. Reviewer-details popup (S10.11) + table identity backfill (S10.14): the ED's dashboard table shows the reviewer's real first name (via `review_author_public`), name search filters on it, and the popup opens with both rating pools rendering the seeded review in the Attendee pool. |
| `promo` | Promo landing + claim. |
| `mutations` | Profile edit, admin banned-word add, reaching the Add Event form. |
| `account-partial-save` | Admin saves their name with location/gender/org fields unrendered; those columns survive. Inverse case: a rendered-but-emptied field still clears (S8.7). |
| `favorites` | Favoriting an event (add/remove). |
| `a11y` | Accessibility checks (labeled controls, keyboard reachability). |
| `uploads` | Real browser → Supabase Storage upload (S10.6): picks a PNG in the event form's logo field and asserts the field fills with a `/event-images/<ed-uid>/` public URL — proof the client upload + owner-scoped RLS path works, not just that the widget renders. Storage RLS is proven separately by the `storage-rls` probe; the promo-CSV upload rides the `mutations` promo-CSV spec. |
| `tournament-crud` | The tournament/event lifecycle through the real UI: create a tournament via the dialog; **edit** a published event and read the row back (the path that shipped broken with no coverage, S9.2); publish an existing draft (lifecycle→active); an emptied title disables the update submit and the row survives; delete a tournament via the confirm dialog. Plus the admin S1.1 affordance — no Delete on an ED-claimed tournament, Delete present on an admin-created unclaimed one. Stable under `--repeat-each=3`. |

## Tournament CRUD coverage matrix

Each cell names its covering probe (authorization/invariants, DB layer) and, where there is
a UI journey, the E2E spec. Probe shorthand: **tc** = `tournament-crud` probe, **ehwg** =
`event-host-write-gate`, **eptg** = `event-parent-tournament-gate`, **eeg** =
`event-edit-grants`, **dnug** = `definer-null-uid-guard`. **E2E** = the `tournament-crud`
spec (or `mutations` where noted).

| Operation | ED-owner | ED-non-owner | Admin | Attendee | Anon |
|---|---|---|---|---|---|
| Create | tc *createTournament stamps owner + claimed*; E2E *creates a tournament via the dialog*; E2E `mutations` *creates + publishes a new event* | eptg *cannot INSERT an event under ED-A's tournament* | tc *createTournament leaves it unclaimed (S1.1)*; eptg *admin can add to an unclaimed tournament* | tc *createTournament refused, no row lands*; ehwg *cannot INSERT tournament or event* | ehwg *anon cannot INSERT a tournament* |
| Read / list | tc *sees own DRAFT event*; tc *published readable* | tc *another ED's draft is hidden*; tc *tournament rows are public-read* | tc *admin sees the draft* | tc *draft hidden, published visible* | tc *draft hidden, published visible*; tc *tournament rows public-read* |
| Update / edit | tc *updateTournament persists the rename*; eeg *update-intent save persists + publish flips draft→active*; E2E *edits a published event + publishes a draft* | tc *update against another ED's tournament changes nothing*; eptg *cannot REPARENT onto ED-A's tournament* | tc *can update an UNCLAIMED tournament*; eptg *admin can edit an event on a claimed ED tournament (S1.1 addendum)*; E2E *no Delete on a claimed tournament* | tc *attendee cannot update*; ehwg *cannot UPDATE an ED's tournament or event (incl. seizing owner_id)* | tc *anon cannot update* |
| Delete | tc *cascades child events + DETACHES reviews with snapshot*; E2E *deletes a tournament via the confirm dialog* | tc *delete_tournament refused, row survives* | tc *admin can delete* | tc *delete_tournament refused, row survives* | tc *delete RPC refused*; dnug *anon cannot destroy a claimed tournament or its events* |

**Validation** (not a role cell, but part of the lifecycle): tc *create/update reject an
empty title before any write*; E2E *an emptied title disables the update submit and the row
survives*; `validation` probe *draft allows null dates, end ≥ start enforced at the DB*;
eeg *publish enforces the full mandatory set*.

Two authorization holes were found while filling this matrix and fixed first — see
DECISIONS **S10.1** (attendees could publish into discovery), **S10.2** (cross-ED event
grafting), and **S10.3** (anon could destroy any claimed tournament via the definer RPCs).
The matrix' Attendee/Anon and ED-non-owner cells are the regression guards for those.

## Conventions for adding tests

- **Authorization + invariants → a probe** (`tests/probes/`); **UI journeys → an E2E spec**
  (`e2e/`). Don't drive a security assertion through the browser when a probe is cleaner.
- Seed fixtures via the service-role harness; reuse the `@example.test` demo pattern; clean up
  what you create.
- Give E2E controls stable, accessible selectors. If a control lacks an accessible name, fix
  the a11y (labeled button) rather than selecting positionally.
- If a test surfaces a real bug, fix the **root cause** and leave a regression guard — never
  weaken the test or the security to make it pass.
- Prove stability: run a new E2E spec repeatedly (`--repeat-each`) so it's not flaky or
  order-dependent before committing.
- **Update this doc** when coverage changes: add the row/entry and, for a new flow, its matrix.
