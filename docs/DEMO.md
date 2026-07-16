# Demo accounts

`supabase/seed.sql` populates the database with realistic content
across every dashboard. Every seeded account shares one password so a
reviewer can flip between roles without a password manager.

**Password (every account):** `demo-pass-123`

All emails end in `@example.test` (RFC 6761 reserved) — this seed
never touches real data.

## Login-able accounts

### Admin

| Email                | First name | Notes                                    |
| -------------------- | ---------- | ---------------------------------------- |
| `admin@example.test` | Ada        | Full moderator (users, flagged, claims). |

### Event Directors

| Email                     | Org                     | Highlights                                                       |
| ------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `dir-amber@example.test`  | Lone Star Youth Sports  | 4 events (1 premium, 1 sponsored, 1 concluded, 1 draft). Reviews. |
| `dir-marcus@example.test` | Great Lakes United FC   | 2 events; open claim request on Heartland Fall Championship.     |
| `dir-elena@example.test`  | Desert Sun Tournaments  | 1 premium+sponsored event; 1 canceled sibling; declined claim.   |

### Attendees

| Email                         | Role             | Highlights                                                        |
| ----------------------------- | ---------------- | ----------------------------------------------------------------- |
| `coach-ashley@example.test`   | Coach            | Wrote the verified GURU review + gets ED reply. Favorites + activity. |
| `coach-carlos@example.test`   | Coach            | Second published review; active promo; helpful marks.             |
| `mgr-priya@example.test`      | Team Manager     | Draft review + one published; 1 favorite.                         |
| `parent-sam@example.test`     | Parent Spectator | No reviews; used as a flag-submitter.                             |
| `coach-dev@example.test`      | Coach            | Third published (critical) review; target of a flag.              |
| `coach-rian@example.test`     | Coach            | Active promo waiting to be applied.                               |

## What the seed populates

- **Tournaments:** 5 (4 claimed by EDs, 1 admin-created + unclaimed).
- **Events:** 9, covering premium, sponsored, upcoming, ongoing, concluded, canceled, draft, and admin-created + unclaimed.
- **Event child data:** age groups + prices, competition levels, surfaces, features, images, sponsors, and milestones (Key Dates & Deadlines) on premium events.
- **Reviews:** 5 published + 1 draft, spanning coach and team-manager roles; 1 is a verified GURU review via applied promo.
- **Comments:** threaded (owner reply + attendee replies) with a nested reply chain.
- **Helpful marks:** 5 across two reviews.
- **Promos:** 4 codes across 1 approved CSV + 1 pending CSV — 1 Applied, 2 Active (linked accounts), 1 Sent (invited email with no account).
- **Claim requests:** 1 pending + 1 declined on the unclaimed tournament.
- **Favorites:** 4 across three attendees.
- **Recently viewed:** 6 rows (mostly Ashley's activity feed).
- **Landing "Recent Reviews":** 3 rows in `demo_reviews` (never real reviews).
- **FAQs:** 5 across attendee / ED / both audiences.
- **Banned words:** 2 (`cuss`, `idiot`) so the review banned-word check has something to trip on.
- **Flagged content:** 2 flagged reviews + 2 flags grouped on a single comment so the admin Flagged page shows the grouping.
- **Support inbox:** 1 message so the admin has one item to acknowledge.
- **Search queries:** 30 rows over 3 days so `get_popular_searches` returns non-empty.
- **Platform counters:** synced to the seeded row counts.

## Re-seeding

The seed is idempotent — `delete from auth.users where email like '%@example.test'` at the top
lets `supabase db reset` and `psql -f supabase/seed.sql` both work against the same database.
