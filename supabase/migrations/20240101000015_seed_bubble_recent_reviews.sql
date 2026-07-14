-- =====================================================================
-- ⚠️  DEMO SEED — DO NOT RE-RUN ON A LIVE OR ALREADY-SEEDED DATABASE
--     Attaches four canned reviews to the events at positions 1–4 in
--     the `(created_at desc, id)` ordering. Re-running after new events
--     land will attach the seeds to the wrong events. Safe on
--     `supabase db reset`; do not include in production bootstrap.
--     See CLAUDE.md · "Demo migrations" for the safe seed procedure.
-- =====================================================================
-- Seed the four Bubble.io demo reviews for the /attendees "Recent Reviews"
-- section. Imported verbatim from the export /Users/.../recent-reviewed.csv.
--
-- Each review attaches to one of the first four visible events (row-numbered
-- by created_at, matching migration 000010's ordering) so the demo grid always
-- has real event titles beside the reviews. The reviewer's role is stored in
-- the `user_role` text field — the RoleBadge component falls back to it when
-- there's no linked auth profile (which is the case for these seeds).
--
-- Idempotent: guarded by a not-exists check on the review titles, so re-running
-- the migration is a no-op after the first successful seed.
-- =====================================================================

do $$
declare
  seeded int;
begin
  select count(*) into seeded
    from reviews
    where review_title in (
      'Well-organized and family-friendly!',
      'Competitive teams and smooth scheduling',
      'Best tournament I''ve played this season',
      'Perfect for families!'
    );

  if seeded > 0 then
    return;
  end if;

  with picked as (
    select id, row_number() over (order by created_at desc, id) as rn
    from events
    where status <> 'draft'
    limit 4
  ),
  seeds(rn, username, user_role, review_title, review_body, overall_rating, guru_review, created_at) as (
    values
      (1,
       'Jessica Martinez',
       'Parent / Spectator',
       'Well-organized and family-friendly!',
       'This tournament was amazing! Great communication from the organizers, and plenty of seating for parents. My son had a blast.',
       5.00::numeric(3,2),
       false,
       '2025-04-28 18:56:00+00'::timestamptz),
      (2,
       'Tyler Robinson',
       'Team Manager',
       'Competitive teams and smooth scheduling',
       'Very well-run event with strong teams. Scheduling was tight but fair, and everything stayed on time. Definitely bringing our team back next season.',
       4.90::numeric(3,2),
       false,
       '2025-03-14 17:19:00+00'::timestamptz),
      (3,
       'Aiden Alvarez',
       'Coach',
       'Best tournament I''ve played this season',
       'Loved the venue and the vibe. Great competition, fair refs, and amazing energy from the crowd. 10/10 would recommend!',
       5.00::numeric(3,2),
       true,
       '2025-03-19 19:09:00+00'::timestamptz),
      (4,
       'Melissa Greenberg',
       'Parent / Spectator',
       'Perfect for families!',
       'Very clean facilities, friendly staff, and great visibility of all fields. As a parent, I felt comfortable and involved the whole time.',
       5.00::numeric(3,2),
       false,
       '2025-04-04 20:28:00+00'::timestamptz)
  )
  insert into reviews (
    event_id, username, user_role, review_title, review_body,
    overall_rating, guru_review, published, created_at, updated_at
  )
  select
    p.id,
    s.username,
    s.user_role,
    s.review_title,
    s.review_body,
    s.overall_rating,
    s.guru_review,
    true,
    s.created_at,
    s.created_at
  from seeds s
  join picked p on p.rn = s.rn;
end;
$$;
