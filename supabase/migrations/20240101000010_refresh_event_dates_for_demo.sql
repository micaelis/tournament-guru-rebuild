-- =====================================================================
-- Make events visible again on the landing page + Find Events search.
--
-- The seed events are all dated in the past (newest ended 2026-05-24), so the
-- "only future or concluded ≤28 days ago" rule (migration 000009) correctly
-- hides every one of them — leaving the landing page's Featured section empty
-- ("Events with premium = true will appear here").
--
-- This reschedules a batch of existing non-draft events RELATIVE TO current_date
-- so they fall inside the visible window, and flags the first few premium so the
-- Featured section populates. Dates are computed from current_date, so this is
-- safe to run whenever — the data lands "current" no matter the date.
--
-- Layout of the 24 rescheduled events:
--   • rows 1–6   → upcoming + premium  (feed the landing "Featured" showcase)
--   • rows 7–21  → upcoming, spread over the next ~4 months (main search list)
--   • rows 22–24 → concluded within the last 28 days (still visible; show the
--                  "That's a wrap!" state and are reviewable)
-- =====================================================================

with ranked as (
  select id, row_number() over (order by created_at desc, id) as rn
  from events
  where status <> 'draft'
),
picked as (
  select id, rn from ranked where rn <= 24
)
-- Casts are required: row_number() yields bigint (date + bigint has no operator,
-- so the day offsets need ::int) and status is the event_status enum (text
-- literals need ::event_status).
update events e set
  start_date = case
                 when p.rn <= 21 then current_date + ((p.rn - 1) * 6 + 4)::int
                 else current_date - ((p.rn - 21) * 8 + 2)::int
               end,
  end_date   = case
                 when p.rn <= 21 then current_date + ((p.rn - 1) * 6 + 6)::int
                 else current_date - ((p.rn - 21) * 8)::int
               end,
  status     = (case when p.rn <= 21 then 'open' else 'concluded' end)::event_status,
  premium    = case when p.rn <= 6 then true else e.premium end,
  updated_at = now()
from picked p
where e.id = p.id;
