# Tournament Guru — Smoke-Test Scenarios

Spec-traceable smoke scenarios for the rebuild. Each is a runnable "given/when/then".
This is both the **re-gate criterion** (Section 0 must pass before Release) and the
seed for the permanent automated suite (BUILD-PLAN §2.5).

## How to run
- Against a **local Supabase** (`supabase db reset` + `seed.sql`), never staging.
- **API / RLS / exploit probes:** a raw `supabase-js` client using the **public anon key**
  and a couple of seeded test-user JWTs (service role only for setup) — the same shape as the
  original TG audit's runtime smoke test, now scripted (Vitest).
- **UI flows:** Playwright over the running app.
- Tags: **FLOW** (happy path must work) · **VALID** (bad input must be rejected) ·
  **PERM** (access rule; negatives phrased as "must be REJECTED") · **STATE** (derived/computed
  rule) · **DATA** (data-integrity: deletion/anonymize/cascade/dedupe).
- Priority: **run Section 0 first** — those are the platform-takeover / broken-flagship probes
  from Review Gate 1. Every one must pass (exploit blocked, flow works) before anything ships.

---

## Section 0 — SECURITY & FLAGSHIP re-gate probes (from Review Gate 1) — RUN FIRST

**Exploit-blocked (must be REJECTED):**
- **[PERM] Signup-as-admin blocked (C1)** — GIVEN the public anon key WHEN `signUp({data:{user_type:'admin'}})` THEN the resulting profile is NOT admin.
- **[PERM] Self-PATCH to admin blocked (C1 regression)** — GIVEN an authed user WHEN they PATCH their own `profiles.user_type='admin'` via REST THEN denied.
- **[PERM] Destructive RPCs guarded (C2)** — GIVEN a normal authed user WHEN they call `delete_event` / `delete_tournament` / `scrub_profile_identity` / `anonymize_account` / `soft_delete_attendee` / `delete_ed_account` on any UUID THEN denied.
- **[PERM] Guru-badge forgery blocked (C3)** — GIVEN a user WHEN they call `apply_promo_to_review` on a review or promo not theirs (or mismatched event/void status) THEN denied; they cannot self-set `guru_review`/`published`.
- **[PERM] Anon PII blocked (C3/C5)** — GIVEN anon WHEN reading reviewer email or `profiles.dob` THEN empty/denied.

**Flagship flow works (must SUCCEED end-to-end):**
- **[FLOW] Promo review chain (C4)** — GIVEN an anon coach with a valid `?promo=<token>` link WHEN they sign up and publish a verified review THEN the promo resolves+links (email-bound), `guru_review=true`, promo→Applied, siblings→void, and it renders on the public event page with recomputed ratings.
- **[FLOW] ED onboarding completes without distance (H2)** — GIVEN an ED WHEN they skip the optional distance field on step 3 THEN they reach step 4 and the dashboard.
- **[FLOW] Public identity renders (H1)** — GIVEN an anon visitor on a public event page THEN reviewer names/photos and the host sidebar render (not blank), via the definer views.

---

## Section 1 — Per-page scenarios (extracted from the specs)

### Auth & Onboarding
- **[FLOW] Signup happy path** — GIVEN /signup WHEN valid email+password + a user type + a role THEN account created, taken to onboarding Screen 1.
- **[VALID] Password min length** — password < 8 chars → rejected.
- **[VALID] Password uppercase** — no uppercase → rejected.
- **[VALID] Password number** — no digit → rejected.
- **[VALID] Type+role required at signup** — no type or no role chosen → cannot proceed; exactly one each.
- **[PERM] user_type locked after signup** — attendee attempts to become event_director → REJECTED (only role within type editable).
- **[FLOW] Skip-registration** — clicks skip → redirect to Search Events.
- **[FLOW] "Claim/List free" pre-selects ED** — CTA on For-Event-Directors → /signup with event_director pre-selected.
- **[FLOW] Claim/List while signed-in logs out first** — signed-in user clicks it → logged out, then /signup (ED pre-selected), seamless.
- **[PERM] Onboarding authed-only** — anon hits /onboarding → REJECTED.
- **[FLOW] Completed-onboarding redirect** — all mandatory filled + lands on auth/onboarding → redirect to dashboard.
- **[FLOW] Incomplete-onboarding gate** — missing ≥1 mandatory field → redirect to Screen 1 with saved fields prefilled.
- **[FLOW] Logout from onboarding** — → /login.
- **[VALID] Screen 1 mandatory** — First name / Last name / Organization Name blank → cannot proceed (role control is only non-required).
- **[STATE] Screen 1 role dropdown type-scoped** — ED sees only ED roles; attendee only attendee roles.
- **[VALID] Screen 2 Location mandatory** — empty location → cannot proceed (SCHEMA §13.2).
- **[VALID] Screen 2 Gender mandatory** — unset gender → cannot proceed (SCHEMA §13.2).
- **[VALID] Minor DOB blocks** — under-18 DOB → warning + cannot proceed.
- **[VALID] Screen 3 optional** — nothing selected → can still finish.
- **[DATA] Team-count cap by role** — parent_spectator = 1 team; others up to 3 (trigger-enforced).
- **[VALID] One selection per team dimension** — 1 gender, 1 age (U4–U20), 1 level each.
- **[FLOW] Attendee finish → Search Events.**
- **[FLOW] ED extra Screen 4** — org logo + description; on completion → dashboard.
- **[VALID] ED org logo rules** — not PNG/JPG/JPEG or >5MB → reject.
- **[VALID] Cannot skip step with incomplete mandatory** — Next blocked.
- **[STATE] onboarding_completed set** — full required set present → true → dashboard redirect.
- **[PERM] Blocked login → logout + popup** — blocked account logs in → signed out, no dashboard, sees "…account has been indefinitely blocked".
- **[PERM] Blocked on non-public page** — hits /onboarding or /dashboard/* → logged out → landing (/login?error=blocked).
- **[VALID] Reset rate limit 1/30s** — 2nd reset within 30s → rejected (server-side).
- **[VALID] Reset anti-enumeration** — existing vs non-existing email → identical generic message (must NOT reveal existence; SCHEMA supersedes the old spec line).
- **[FLOW] Reset email** — valid request → Supabase default email sent.
- **[PERM] Header dashboard access** — signed-in → header avatar+name+notifications indicator → dashboard.
- **[STATE] Missing-photo placeholder** — no photo → neutral placeholder icon.

### Dashboard > Events
- **[FLOW] ED default landing = Events.**
- **[STATE] Empty-events placeholder** — "Welcome, [first-name]" + 01/02/03 blocks + YT embed (DRx5FdXORwY) + "Add New Tournament".
- **[FLOW] Create-tournament popup** — Title + Recurring toggle + Cancel/Add.
- **[VALID] Tournament Title mandatory** — blank → blocked.
- **[STATE] Recurring = stored no-op.**
- **[FLOW] Post-create add-first-event prompt** — decline → tournaments list.
- **[STATE] Tournaments list sort A–Z default** + search box.
- **[FLOW] Tournament sort** — Creation Date / Avg rating / Reviews count + asc/desc; child events re-sort.
- **[STATE] Empty-tournament placeholder** — prompt to add event.
- **[STATE] Metrics gated on ≥1 review** — else hidden; else 9 cards (Overall/Coach/Attendee + 6 categories).
- **[STATE] Overall format** — 2-decimal avg /5 + total count across child events.
- **[STATE] Coach pool = verified coach reviews; Attendee pool = non-verified.**
- **[VALID] Event publish mandatory fields** — logo/title/website/host club/start/end/description/location/level(≥1)/region/surface(≥1)/season missing → blocked.
- **[VALID] Draft requires only title.**
- **[VALID] End ≥ start on publish.**
- **[VALID] Age-group add fields** — gender/age(U4–U20)/price($)/field size(5v5–11v11) missing → cannot add.
- **[VALID] Sponsor add fields** — name/link/logo missing → cannot add.
- **[VALID] Free image cap = 3** — 4th → blocked + upgrade placeholder.
- **[FLOW] Upgrade reveals premium section** — scroll + "now premium / top searches" popup (Stripe deferred).
- **[VALID] Premium image cap = 13 total** (10 more); no upgrade placeholder.
- **[VALID] Video max 200MB.**
- **[STATE] Status derivation** — active → Upcoming/Ongoing/Concluded from dates; draft→Draft; canceled→Canceled; per-status chip color.
- **[STATE] Status recomputed on date edit.**
- **[PERM] Draft visibility owner-only** — non-creator queries → must NOT appear.
- **[FLOW] Admin creates unclaimed events** — no owner, claimable.
- **[PERM] Claim CTA on unclaimed cards** — anon + signed-in see it.
- **[PERM] Anon Claim → ED auth variant** — title "Become Part of the Largest…"; signup switch auto-selects ED.
- **[DATA] Temp age-groups/sponsors cleanup** — added+deleted same session → not persisted.
- **[FLOW] Post-create → internal event page** — created + last-modified timestamps + status + edit/delete.
- **[FLOW] Draft edit actions** — Delete / Update (title-only) / Update & Publish (all mandatory); drafts upgradable to premium.
- **[FLOW] Published edit actions** — update/delete/cancel (even Concluded).
- **[VALID] Cancel reason mandatory + capped** — shown publicly.
- **[VALID] Missing-field feedback** — scroll to field + info text.
- **[PERM] Published event data public-readable.**
- **[FLOW] Events list** — collapsible, paginate >10, sort start-date soonest-first, columns Name/Host Club/Season/Dates/Status/reviews+avg (0.5-step stars).
- **[STATE] Per-event metrics** — collapsible (visible default), only 6 categories + averages.
- **[STATE] Featured highlighted / non-featured shows Upgrade CTA.**
- **[FLOW] Edit / Duplicate / Copy Link on all events.**
- **[FLOW] Duplicate clones config only** — no reviews/comments, premium not carried; opens Add Event.
- **[FLOW] Copy Link** — public URL to clipboard + confirmation.
- **[STATE] Canceled card grayed.**
- **[PERM] Admin search by title + owner name** (ED-name search never returns unclaimed).
- **[FLOW] Admin sort adds Owner.**
- **[FLOW] Admin CSV export = on-screen results only** (fields per spec); CTA enabled only if data.
- **[PERM] Admin edit gating** — add/edit tournament only if admin-created + unclaimed; edit event always allowed.
- **[STATE] Admin event lists collapsed by default.**
- **[FLOW] Admin extra columns** — Event Director (→public page) + Premium Y/N.
- **[FLOW] Admin QR** — 400×400 PNG/PDF of public URL; CTA flips to "Open QR Image"; download alert.

### Dashboard > Reviews
- **[PERM] Access** — Admin + ED only; ED sees own-event reviews, admin all.
- **[FLOW] Search + filters** — by user name, by event (ED = own), by review type (With/Without Promo) + clear-all.
- **[STATE] Verified badge on promo reviews.**
- **[FLOW] Promo review-auth page (2nd variant)** — loads for anon/signed-in with ?promo=token.
- **[STATE] Missing/invalid promo → placeholder** (no form).
- **[FLOW] Valid promo + completed user → event** (keep ?promo).
- **[FLOW] Promo Step 1 autopopulate + account resolution** — logged-in→save; account exists→login+save; complete→redirect; no account→create attendee/coach.
- **[FLOW] Promo Steps 2/3** — location/gender/age; teams up to 3.
- **[STATE] Promo funnel tracking** — landed/step1/step2/step3/applied recorded.
- **[DATA] Multiple promos same event → used/void except applied.**
- **[STATE] Promo status** — Pending→Sent→Active→Applied; Rejected.
- **[STATE] Empty-results placeholder.**
- **[FLOW] Reviews table** — sortable columns (default desc creation): Username/Host Club/Event/6 categories+Overall/Date.
- **[STATE] Category avg + Overall = avg across rated categories.**
- **[STATE] Coach+promo code chip** — 8-char code in role chip.
- **[FLOW] ED single reply** — exactly 1, edit/delete/re-add, shows body+date.
- **[PERM] Admin reply on unowned events + delete reviews/replies.**
- **[PERM] ED/Admin cannot comment on each other's concluded events** — only attendees → REJECTED.
- **[PERM] Draft review creator-only** — non-creator read → REJECTED.
- **[FLOW] ED flag-review popup** — reasons Profanity/Illicit/Solicitation/Other (1 required) + info; Confirm → flagged_content + "Thank you! The Admin will be notified…".
- **[VALID] "Other" requires info.**
- **[FLOW] Admin edit/delete review popup** — title/description/6 ratings; save alert.
- **[FLOW] Reviews CSV export** — per-row + bulk select; "Export x reviews"; max 30/page; fields per spec.
- **[PERM] Reviewer email in CSV admin-only.**
- **[FLOW] Reviewer detail popup** — profile + team info + Verified-Coach (red) vs Attendee (yellow) columns.
- **[STATE] Coach pool = with promo; Attendee pool = without (computed on read).**
- **[FLOW] Review-form legend not selectable; 6 category rows selectable.**
- **[VALID] Body 400-char cap + live counter.**
- **[VALID] Banned-word rejection with disclosure** (word-boundary).
- **[VALID] Publish requires all 6 ratings** — "* …select a rating for all the categories above."
- **[VALID] Publish requires title** — "* …please include a title."
- **[VALID] Over-limit body** — "* You have exceeded the 400 character limit."
- **[VALID] One review per event** (unique author_id+event_id; upgrade path).
- **[STATE] guru_review server-set on promo publish** → "GURU REVIEW".
- **[FLOW] Publish confirmation + promo→Applied+timestamp.**
- **[STATE] Edit window = 30 days after event end** — else blocked with reason + soft nudge.
- **[VALID] would_return required for coach/manager** (not parent_spectator).
- **[DATA] Recalc on score change** — event + tournament (NULL-aware).
- **[DATA] Reviewer self-delete = full delete** (review+comments+flags) but counter not decremented.
- **[PERM] Comment/flag by attendees except author** — author self-comment → REJECTED.
- **[FLOW] Comment threading + pagination >10** (newest-first).
- **[FLOW] Owner-ED pinned reply** — 1, pinned, org logo/name → public ED page.
- **[FLOW] Comment edit/delete by creator anytime.**
- **[FLOW] Helpful toggle remembered** (one per user per review, un-selectable).
- **[STATE] My Reviews heading count chip.**
- **[FLOW] My Reviews sort** — Newest/Oldest/Best-worst/Worst-best (default Newest).
- **[STATE] My Reviews location filter** (state code + count; disabled if none; also on admin/ED with rules).
- **[STATE] Review status chip attendee-only** (Draft/Published).
- **[STATE] My Reviews empty placeholder → Find Events.**
- **[STATE] Null category excluded from average.**
- **[PERM] Public read of published reviews/comments.**

### Promo Codes (ED / Admin)
- **[PERM] Tabs by role** — admin: Submitted CSVs + Coaches; ED: My CSVs + Coaches + Submit CSV.
- **[FLOW] Admin status subtabs** — All|Pending|Sent Promo Code|Rejected (Sent Promo Code = approved).
- **[STATE] Status labels** — approved → "Sent Promo Code" (admin) / "Sent emails" (ED).
- **[FLOW] Admin CSV table + download** (ED→public page, Event→internal, file download alert).
- **[FLOW] Pending actions** — Reject / Send Emails.
- **[STATE] Rejected card grayed.**
- **[FLOW] Reject flow** — confirm + typed reason → rows deleted, master kept Rejected + reason on both dashboards.
- **[FLOW] Send-emails popup** — event card + count chip + per-row/bulk exclude + "Send x emails".
- **[STATE] Non-coach-account warning** — "…different user type and will be ignored." grayed, NOT re-addable.
- **[STATE] Manually-rejected rows re-addable.**
- **[FLOW] Send commits status + deletes rejected/ignored rows.**
- **[STATE] Row → Active if coach account exists (non-blocked)** — 8-char code + link user.
- **[STATE] Row → Sent if no account** (Account chip Invited).
- **[FLOW] SendGrid email** — template d-…, title "Submit Your Review…", params event title + link (?promo=url_token).
- **[VALID] Batch send limit** — queued/batched. ⚠ CONFLICT: send-logic says "100 rows/file", Submit-CSV infotip says "1000 rows/file" — reconcile (SCHEMA/BUILD says 1000).
- **[FLOW] Resend + copyable ?promo link.**
- **[FLOW] ED submissions view** — newest-first, single list, status chip (Pending|Sent emails|Rejected+reason).
- **[FLOW] ED cancels pending.**
- **[FLOW] Coaches-with-promo (admin)** — Coach/From/Event/Account/Promo Code/Status/See Review.
- **[STATE] Account chip** — Registered if linked else Invited.
- **[FLOW] Coaches-with-promo (ED)** — no reviewer identity.
- **[FLOW] Submit CSV tab** — uploader + infotip + Download demo CSV (col "email", 2 rows).
- **[VALID] CSV header must be "email".**
- **[FLOW] Premium-event selection mandatory to submit.**
- **[STATE] No paid event → upgrade prompt.**
- **[FLOW] Submission success message + return to Submitted CSVs; visible to admin.**
- **[DATA] One non-void promo per (email, event).**

### Claim Event
- **[FLOW] Admin claim table** — User/Created/Event/Status/Decline|Approve.
- **[FLOW] Decline flow** — confirm + required reason → declined + alert.
- **[FLOW] Approve + ownership transfer** — event + tournament + siblings → requesting ED.
- **[DATA] Approve auto-rejects sibling pending claims** (auto reason).
- **[STATE] Post-claim CTA replacement** — Claim gone for others; card shows owner org logo/title; fields update.
- **[FLOW] Admin filter/search claims** — status + event/org title.
- **[STATE] Expandable card** — phone/links/message/decline reason.
- **[PERM] Claim CTA visibility** — unclaimed → anon + ED see it; claimed → never.
- **[PERM] Logged-out claim → ED auth variant.**
- **[STATE] Existing-pending → "Requested" unclickable.**
- **[FLOW] Claim modal** — required phone + required links + optional info; Submit → admin + alert + CTA "Requested".
- **[VALID] Phone + links required.**
- **[DATA] Unique pending per (requester, tournament)**; CTA state consistent across siblings.
- **[PERM] ED Claim Requests hides User column.**

### Account tabs
- **[PERM] Tabs by role** — ED/Attendee/Admin sets per spec.
- **[STATE] Attendee profile fields** — photo/name/city/state/dob("not displayed")/gender/role/org; team placeholder; 3 counts.
- **[FLOW] Attendee profile edit** — photo/first/last/location/org/gender/role-question/teams. (Note: SCHEMA locks role post-onboarding; team info in Preferences.)
- **[FLOW] Security email/password** — password update → email confirm first; alert on success. (SCHEMA adds re-auth before change — see Gate 1 M4.)
- **[DATA] Account delete cascade** — reviews+comments anonymized.
- **[DATA] ED delete + claimed-event revert** — claimed events owner→admin; only post-claim events/comments deleted; originally-created deleted (reviews detached).
- **[FLOW] Preferences = team info.**
- **[STATE] Notifications default off** — 6 settings; enabled shown as chips.
- **[STATE] Attendee notif sections** — Review Replies/Review Likes/Comment Replies.
- **[STATE] ED notif sections** — Event Reviews/Favorited Events.
- **[FLOW] Attendee Promo Codes tab** — Code/status/Event/From/Review Status; published→avg+popup+edit(window); none+window→"write a review"; publish draft applies promo.
- **[DATA] No duplicate promo per user+event.**
- **[STATE] ED profile org settings** — logo/User Title/Org Title/Org Description (onboarding-equivalent mandatory).
- **[STATE] Admin profile = photo/first/last only.**
- **[DATA] Org label** — "Organization Title" (ED) / "Club Affiliation" (attendee); single field; "organization" spelling.
- **[STATE] Payment paywall disabled this sprint.**

### Support
- **[FLOW] Support form** — Email + Full name (autopopulated) + Message → email to support@tournamentguru.com ("You have a message from: <name>, <email>" + italic message) + confirmation popup.
- **[VALID] Message cap (~2000) + rate limit.**

### Admin > Flagged Content
- **[PERM] Admin-only, tabs Reviews + Comments** (grouped by review, desc creation).
- **[FLOW] Flagged Reviews table** — Reported User/title/Event/# flags/Dismiss|Delete.
- **[FLOW] Dismiss** — confirm → flags removed, flagged_content deleted, review disappears (content stays).
- **[DATA] Delete cascade** — recalc + delete comments + flagged_content + review.
- **[STATE] Expandable flag detail** — title/body/date + submissions table (Flagged by/Date/Reason/Comment).
- **[FLOW] Flagged Comments table** — Reported User/Comment body/Review title/# flags + same flows.

### Admin pages (Banned Words, Users)
- **[PERM] Admin sidebar set** — Events/Reviews/Search/Users/Banned Words/Flagged/Claim/Promo/Account/Logout.
- **[FLOW] Banned Words CRUD.**
- **[VALID] Banned-word enforcement functional** — used in review/comment (word-boundary) → blocked.
- **[FLOW] Users tabs** — Attendees(x) | Event Directors(x).
- **[STATE] Attendees columns** — Name/Location/Gender/DOB/Joined/Type/Reviews Published.
- **[STATE] ED columns** — Name/Org Title/Joined/Type/Total Events/Premium Events.
- **[FLOW] Block/Delete user** — confirm + success alert.
- **[PERM] Blocked user cannot access dashboard** — sees "account unavailable" popup.
- **[DATA] Delete user removes removable linked data** (reviews/comments anonymized).

### ED pages / FAQ
- **[PERM] ED sidebar + hidden items** — Transactions/Add-on Pricing/Notifications/FAQ hidden this sprint.
- **[FLOW] FAQ audience scoping** — admin-authored, filtered by audience (attendee/event_director/both).
- **[FLOW] Log Out → /login.**

### Favorites & Activity
- **[FLOW] Activity page** — recently-viewed newest-first, clickable, favourite here.
- **[DATA] Recently-viewed registration + 50 cap** (upsert latest).
- **[FLOW] Favorites page** — newest-faves-first, Unfollow + Visit CTAs.
- **[FLOW] Unfollow confirmation** — "Are you sure…no longer receive update notifications…" → removed.
- **[STATE] Right-column premium strip** — max 4 paid (premium OR sponsored) events ended ≤1mo, shuffled per load, hidden if none.
- **[PERM] Favourite requires account** — not-logged-in → prompt account creation.

### Landing / Search / Event page
- **[STATE] Landing counters** — total reviews / events (≠Draft) / tournaments (durable counters).
- **[STATE] 3 popular searches hardcoded** (not search_queries).
- **[STATE] Featured Events** — 4, soonest-first, start > now−30d, from premium OR sponsored; card fields per spec.
- **[STATE] Recent Reviews from demo_reviews** (never real reviews).
- **[FLOW] Search fields** — title/tournament/ED name/org title/city/state(+code)/age group/level.
- **[FLOW] Filter chips + modal** — Dates/Age/Gender/Level/Distance/States/All; applied highlight; clearable.
- **[STATE] Distance filter pre-applied + resettable** (from saved location).
- **[STATE] States facet as short codes** (MO…).
- **[FLOW] Result controls** — count / List|Grid|Hide Map|Sort / Featured near-first / pagination / sticky map.
- **[STATE] "% would return" icon** — from would_return_pct (all coach+manager reviews answered).
- **[STATE] Event card fields** — logo/title/age(U9–U19)/gender/level/surface/description/ratings/city+state/dates/status/favorite.
- **[PERM] Card favourite requires login.**
- **[FLOW] Event details page** — red review banner if just ended; media grid (logo-only graceful); "Show all x photos"; title block; host sidebar; left content; ratings; sponsors.
- **[STATE] Featured "x% would attend"** — from coach/manager would_return.
- **[STATE] Ratings breakdown** — Coach/Attendee pools, avg+stars+count, 5-row progress bars, filter+sort, "x verified reviews" if featured.
- **[STATE] Facilities hidden, full address shown.**
- **[FLOW] Key Dates milestones (featured)** — add/edit/delete; 2 auto ones editable.
- **[FLOW] ED name → public ED page.**

### Public ED page
- **[STATE] Header** — org logo/title/description, ED photo/name, Coach+Attendee pools, #Completed | #Open events.
- **[FLOW] Events tab sort** — search-page sorting; default desc publish date, then desc paid flag (paid fixed 2nd key).
- **[FLOW] Reviews tab** — rating columns + reviews with comments.
- **[PERM] Never exposes PII or draft/unclaimed events.**

---

## Section 2 — Schema data-integrity rules (cross-cutting)
- **[DATA] Event delete = detach + snapshot** — event_id nulled, detached=true, snapshot_* populated, child data deleted, reviewer identity kept.
- **[DATA] Tournament delete cascade** — child events + child data deleted; reviews/comments/replies retained (detached).
- **[DATA] Attendee anonymize on account delete** — content + user_type/role kept; user_id/email/name/avatar nulled; anonymized=true; "Former member".
- **[STATE] recalc_ratings NULL-aware + rollup** — from PUBLISHED reviews only; event + 6 category avgs + would_return_pct; rolls to tournament.
- **[STATE] Counters never decremented** on delete.
- **[PERM] Column-grant allow-list** — user_type/role(post-onboarding)/blocked/guru_review/published_at/promo_id/counters not client-writable.
- **[PERM] PII never in public projections** — dob + email.
- **[DATA] Private CSV bucket** — signed URL, owner+admin only.
- **[VALID] Public-write DB rate limits** — search_queries 1000/min, contact_requests 60/min, reset bucket.

---

## Section 3 — Cross-feature chains (E2E)
1. **Promo → verified review → ratings → public:** CSV (private bucket) → admin approve+send → 8-char code + nanoid token, rows Active/Sent → SendGrid ?promo link → coach 2nd-auth → Step-1 Continue → Active → review form (6 cats + title + body ≤400 + would_return) → publish sets guru_review, promo→Applied, siblings→void → recalc event+tournament + would_return_pct → public page shows GURU badge, verified pool, "% would return".
2. **Admin event → claim → transfer:** admin unclaimed event → Claim CTA → ED submits (phone+links) → Requested → admin approve → tournament + siblings transfer, others auto-rejected, CTA→org logo/title across siblings.
3. **Attendee delete → anonymize:** reviews/comments → "Former member" (content+role kept, PII nulled) → counters unchanged.
4. **ED delete → mixed cascade:** comments anonymized → originally-created events deleted (reviews detached+snapshot) → claimed events owner→admin (only post-claim deleted).
5. **Date edit → status re-derivation → discovery:** dates change → status recomputes → search filters + Featured window + chips reflect it (no stale).
6. **Flag → admin delete → recalc + cascade:** flag → Flagged page groups by review → Delete recalcs + deletes comments/flags/review; Dismiss keeps content, clears flags.
7. **Reviewer self-delete vs retention:** full delete (review+comments+flags) but counter not decremented.
8. **CSV export fidelity:** filters → export contains exactly on-screen rows (reviewer email admin-only; max 30/page).

---

## Conflicts flagged during extraction (resolve before locking tests)
- **Promo CSV row cap:** send-logic text "100 rows/file" vs Submit-CSV infotip "1000 rows/file" — BUILD-PLAN/SCHEMA say **1000**; confirm and make the infotip + validation agree.
- **Old-spec lines superseded by SCHEMA-DESIGN §11–13** (already applied above): reset anti-enumeration (generic message, not "tell them it doesn't exist"), gender + location mandatory, role locked post-onboarding, team info in Preferences.
