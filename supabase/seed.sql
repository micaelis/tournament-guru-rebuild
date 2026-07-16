-- ─────────────────────────────────────────────────────────────────────
-- Demo seed. Runs after every `supabase db reset` (config.toml points
-- [db.seed].sql_paths at this file). Populates every surface with
-- realistic data so a mentor / live demo doesn't land on empty pages.
--
-- All emails end in @example.test (RFC 6761 reserved), all passwords
-- are the same shared demo password so anyone flipping between roles
-- can log in without a password manager:
--
--    Password (every account): demo-pass-123
--
-- Full account roster + which surfaces each one lights up lives in
-- docs/DEMO.md. Fixed UUIDs so the downstream references (reviews,
-- claims, promos) resolve deterministically across re-runs.
-- ─────────────────────────────────────────────────────────────────────

-- Safe against re-run inside `supabase db reset` (reset drops + recreates)
-- and safe against `psql -f seed.sql` into a running DB later.
delete from auth.users where email like '%@example.test';

-- ── Users ─────────────────────────────────────────────────────────────
-- Metadata drives handle_new_user's user_type/role_title choice.
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  aud, role, instance_id, raw_user_meta_data,
  raw_app_meta_data, created_at, updated_at
) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"attendee","role_title":"coach","first_name":"Ada"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'dir-amber@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"event_director","role_title":"event_director","first_name":"Amber"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'dir-marcus@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"event_director","role_title":"club_director","first_name":"Marcus"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'dir-elena@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"event_director","role_title":"event_admin","first_name":"Elena"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'coach-ashley@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"attendee","role_title":"coach","first_name":"Ashley"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'coach-carlos@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"attendee","role_title":"coach","first_name":"Carlos"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'mgr-priya@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"attendee","role_title":"team_manager","first_name":"Priya"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'parent-sam@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"attendee","role_title":"parent_spectator","first_name":"Sam"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'coach-dev@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"attendee","role_title":"coach","first_name":"Dev"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'coach-rian@example.test',
   crypt('demo-pass-123', gen_salt('bf')), now(),
   'authenticated','authenticated','00000000-0000-0000-0000-000000000000',
   '{"user_type":"attendee","role_title":"coach","first_name":"Rian"}'::jsonb,
   '{"provider":"email","providers":["email"]}'::jsonb, now(), now());

-- handle_new_user created bare profile rows. Now flesh them out —
-- admin needs its user_type flipped by service role (locked from
-- client), and everyone else gets full identity + onboarding_completed.
update profiles set user_type = 'admin'
 where id = 'aaaaaaaa-0000-0000-0000-000000000001';

update profiles set
  first_name='Ada', last_name='Ortega', dob='1988-04-12', user_gender='female',
  location_formatted='Kansas City, MO', location_state_abbr='MO',
  profile_photo_url='https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='aaaaaaaa-0000-0000-0000-000000000001';

update profiles set
  first_name='Amber', last_name='Reeves', dob='1982-09-24', user_gender='female',
  location_formatted='Austin, TX', location_state_abbr='TX',
  organization_title='Lone Star Youth Sports',
  org_description='Family-run youth soccer club running Central Texas cups since 2018.',
  org_logo_url='https://images.unsplash.com/photo-1508163223045-1880bc36e222?w=300',
  profile_photo_url='https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='aaaaaaaa-0000-0000-0000-000000000002';

update profiles set
  first_name='Marcus', last_name='Okoye', dob='1979-01-08', user_gender='male',
  location_formatted='Chicago, IL', location_state_abbr='IL',
  organization_title='Great Lakes United FC',
  org_description='Chicago-based club serving competitive U9–U18 travel teams.',
  org_logo_url='https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=300',
  profile_photo_url='https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='aaaaaaaa-0000-0000-0000-000000000003';

update profiles set
  first_name='Elena', last_name='Vasquez', dob='1985-11-30', user_gender='female',
  location_formatted='Phoenix, AZ', location_state_abbr='AZ',
  organization_title='Desert Sun Tournaments',
  org_description='Boutique Arizona tournament series — 8v8 and 11v11.',
  org_logo_url='https://images.unsplash.com/photo-1546519638-68e109498ffc?w=300',
  onboarding_completed=true, preferences_completed=true
 where id='aaaaaaaa-0000-0000-0000-000000000004';

update profiles set
  first_name='Ashley', last_name='Nguyen', dob='1990-05-17', user_gender='female',
  location_formatted='Kansas City, MO', location_state_abbr='MO',
  organization_title='KC Comets U12 Girls',
  profile_photo_url='https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='bbbbbbbb-0000-0000-0000-000000000001';

update profiles set
  first_name='Carlos', last_name='Mendes', dob='1984-08-03', user_gender='male',
  location_formatted='Denver, CO', location_state_abbr='CO',
  organization_title='Rocky Mountain Rise SC',
  profile_photo_url='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='bbbbbbbb-0000-0000-0000-000000000002';

update profiles set
  first_name='Priya', last_name='Kapoor', dob='1986-02-14', user_gender='female',
  location_formatted='Dallas, TX', location_state_abbr='TX',
  organization_title='Trinity Youth Soccer',
  profile_photo_url='https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='bbbbbbbb-0000-0000-0000-000000000003';

update profiles set
  first_name='Sam', last_name='Patel', dob='1976-06-22', user_gender='male',
  location_formatted='Denver, CO', location_state_abbr='CO',
  profile_photo_url='https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='bbbbbbbb-0000-0000-0000-000000000004';

update profiles set
  first_name='Dev', last_name='Sharma', dob='1991-12-01', user_gender='male',
  location_formatted='San Diego, CA', location_state_abbr='CA',
  organization_title='SD Coastal Soccer',
  profile_photo_url='https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='bbbbbbbb-0000-0000-0000-000000000005';

update profiles set
  first_name='Rian', last_name='Foster', dob='1989-07-19', user_gender='female',
  location_formatted='Portland, OR', location_state_abbr='OR',
  organization_title='Cascade FC',
  profile_photo_url='https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
  onboarding_completed=true, preferences_completed=true
 where id='bbbbbbbb-0000-0000-0000-000000000006';

-- Team info on a couple attendees so the preferences tab is non-empty.
insert into user_teams (profile_id, slot, team_gender, age, competition_level) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 1, 'girls', 'U12', 'upper'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 1, 'boys',  'U14', 'highest'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 2, 'boys',  'U10', 'middle'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 1, 'both',  'U16', 'upper');

-- ── Tournaments + Events ─────────────────────────────────────────────
insert into tournaments (id, owner_id, created_by, title, recurring, claimed, created_at) values
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Austin Spring Kickoff Cup', true,  true,  now() - interval '120 days'),
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', 'Lone Star Summer Classic',  true,  true,  now() - interval '90 days'),
  ('11111111-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', 'Great Lakes Cup',           true,  true,  now() - interval '150 days'),
  ('11111111-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', 'Desert Sun Showcase',       false, true,  now() - interval '60 days'),
  -- Admin-created + unclaimed → drives the Claim CTA + admin's Claim Requests queue.
  ('11111111-0000-0000-0000-000000000005', null,                                    'aaaaaaaa-0000-0000-0000-000000000001', 'Heartland Fall Championship', false, false, now() - interval '30 days');

insert into events (id, tournament_id, owner_id, created_by, claimed,
  logo_url, title, website_url, host_club,
  start_date, end_date, registration_deadline,
  description, location_formatted, location_state_abbr, location_city, location_state_full,
  num_teams_this_year, region, season_id, lifecycle,
  is_premium, is_sponsored, video_url,
  teams_this_year_url, teams_prev_year_url, registration_url, teams_attended_prev_year,
  created_at
) values
  ('22222222-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', true,
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400',
   'Spring Kickoff Cup — U10 Division',
   'https://lonestarsports.example.com/spring-u10', 'Lone Star Youth Sports',
   current_date + 12, current_date + 14, current_date + 5,
   'Kick off spring with two days of round-robin play at our brand new complex. Guaranteed 4 games, professional refs, medals for finalists.',
   'Circuit of the Americas Sports Park, Austin, TX', 'TX', 'Austin', 'Texas',
   32, 'IV', (select id from seasons where label='2026-2027'), 'active',
   true, false, null,
   'https://lonestarsports.example.com/teams', null, 'https://lonestarsports.example.com/register', 28,
   now() - interval '60 days'),
  ('22222222-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', true,
   'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400',
   'Spring Kickoff Cup — U12 Girls',
   'https://lonestarsports.example.com/spring-u12g', 'Lone Star Youth Sports',
   current_date + 12, current_date + 14, current_date + 5,
   'The Kickoff Cup''s flagship U12 girls bracket. 8 teams in two brackets, third-place match for a medal.',
   'Circuit of the Americas Sports Park, Austin, TX', 'TX', 'Austin', 'Texas',
   16, 'IV', (select id from seasons where label='2026-2027'), 'active',
   false, true, null, null, null, null, null,
   now() - interval '55 days'),
  ('22222222-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', true,
   'https://images.unsplash.com/photo-1610966050047-3b0b7d3a0c78?w=400',
   'Summer Classic — U14 Boys',
   'https://lonestarsports.example.com/summer-u14b', 'Lone Star Youth Sports',
   current_date - 42, current_date - 40, current_date - 55,
   'Recap of one of our best-attended U14 boys events — 24 teams, three fields, air-conditioned pavilion for shade breaks.',
   'Round Rock Multipurpose Complex, TX', 'TX', 'Round Rock', 'Texas',
   24, 'IV', (select id from seasons where label='2025-2026'), 'active',
   true, false, 'https://player.vimeo.com/video/76979871',
   'https://lonestarsports.example.com/teams-summer', 'https://lonestarsports.example.com/teams-2024', 'https://lonestarsports.example.com/register-summer', 22,
   now() - interval '80 days'),
  ('22222222-0000-0000-0000-000000000004',
   '11111111-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', true,
   'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=400',
   'Great Lakes Cup — U10 Boys',
   'https://greatlakesunitedfc.example.com/glc-u10b', 'Great Lakes United FC',
   current_date - 15, current_date - 13, current_date - 30,
   'Great Lakes United''s annual invitational. Snacks and coffee provided each morning. Full concession stand on-site.',
   'Toyota Park, Bridgeview, IL', 'IL', 'Bridgeview', 'Illinois',
   20, 'II', (select id from seasons where label='2025-2026'), 'active',
   false, false, null, null, null, null, null,
   now() - interval '90 days'),
  ('22222222-0000-0000-0000-000000000005',
   '11111111-0000-0000-0000-000000000003',
   'aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', true,
   'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=400',
   'Great Lakes Cup — U14 Girls',
   'https://greatlakesunitedfc.example.com/glc-u14g', 'Great Lakes United FC',
   current_date + 40, current_date + 42, current_date + 30,
   'U14 girls bracket at our fall showcase — scouts from three regional academies confirmed.',
   'Toyota Park, Bridgeview, IL', 'IL', 'Bridgeview', 'Illinois',
   12, 'II', (select id from seasons where label='2026-2027'), 'active',
   false, false, null, null, null, null, null,
   now() - interval '30 days'),
  ('22222222-0000-0000-0000-000000000006',
   '11111111-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', true,
   'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=400',
   'Desert Sun Showcase — U16',
   'https://desertsun.example.com/showcase-u16', 'Desert Sun Tournaments',
   current_date + 60, current_date + 62, current_date + 45,
   'Elite U16 showcase — 8 teams, three matches guaranteed, college scouts confirmed from PAC-12 programs.',
   'Reach 11 Sports Complex, Phoenix, AZ', 'AZ', 'Phoenix', 'Arizona',
   8, 'IV', (select id from seasons where label='2026-2027'), 'active',
   true, true, 'https://player.vimeo.com/video/76979871', null, null, null, null,
   now() - interval '45 days'),
  ('22222222-0000-0000-0000-000000000007',
   '11111111-0000-0000-0000-000000000004',
   'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000004', true,
   null, 'Desert Sun Showcase — U12 (Canceled)',
   'https://desertsun.example.com/showcase-u12', 'Desert Sun Tournaments',
   current_date + 60, current_date + 62, null,
   'Sub-tournament for U12 age group.',
   'Reach 11 Sports Complex, Phoenix, AZ', 'AZ', 'Phoenix', 'Arizona',
   null, 'IV', (select id from seasons where label='2026-2027'), 'canceled',
   false, false, null, null, null, null, null,
   now() - interval '20 days'),
  ('22222222-0000-0000-0000-000000000008',
   '11111111-0000-0000-0000-000000000005',
   null, 'aaaaaaaa-0000-0000-0000-000000000001', false,
   'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
   'Heartland Fall Championship',
   'https://heartland-fall.example.com', 'Heartland FC',
   current_date + 90, current_date + 92, current_date + 75,
   'Regional fall championship — created by an admin on behalf of the organizer. Waiting for the director to claim.',
   'World Wide Technology Soccer Park, St. Louis, MO', 'MO', 'St. Louis', 'Missouri',
   16, 'II', (select id from seasons where label='2026-2027'), 'active',
   false, false, null, null, null, null, null,
   now() - interval '10 days'),
  ('22222222-0000-0000-0000-000000000009',
   '11111111-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', true,
   null, 'Summer Classic — U16 (Draft)',
   null, 'Lone Star Youth Sports',
   null, null, null, null, null, null, null, null, null, null, null, 'draft',
   false, false, null, null, null, null, null,
   now() - interval '3 days');

update events
   set cancel_reason='Field permits could not be renewed in time for the scheduled dates. Refunds processed to all registered teams.'
 where id='22222222-0000-0000-0000-000000000007';

-- ── Event child data ──────────────────────────────────────────────────
insert into event_age_groups (event_id, team_gender, age, price, field_size) values
  ('22222222-0000-0000-0000-000000000001', 'boys',  'U10', 550, '7v7'),
  ('22222222-0000-0000-0000-000000000001', 'girls', 'U10', 550, '7v7'),
  ('22222222-0000-0000-0000-000000000002', 'girls', 'U12', 625, '9v9'),
  ('22222222-0000-0000-0000-000000000003', 'boys',  'U14', 725, '11v11'),
  ('22222222-0000-0000-0000-000000000003', 'boys',  'U13', 725, '9v9'),
  ('22222222-0000-0000-0000-000000000004', 'boys',  'U10', 495, '7v7'),
  ('22222222-0000-0000-0000-000000000004', 'boys',  'U11', 495, '9v9'),
  ('22222222-0000-0000-0000-000000000005', 'girls', 'U14', 650, '11v11'),
  ('22222222-0000-0000-0000-000000000006', 'both',  'U16', 895, '11v11'),
  ('22222222-0000-0000-0000-000000000008', 'both',  'U15', 675, '11v11'),
  ('22222222-0000-0000-0000-000000000008', 'both',  'U17', 675, '11v11');

insert into event_competition_levels (event_id, level) values
  ('22222222-0000-0000-0000-000000000001', 'middle'),
  ('22222222-0000-0000-0000-000000000001', 'upper'),
  ('22222222-0000-0000-0000-000000000002', 'upper'),
  ('22222222-0000-0000-0000-000000000003', 'highest'),
  ('22222222-0000-0000-0000-000000000003', 'upper'),
  ('22222222-0000-0000-0000-000000000004', 'middle'),
  ('22222222-0000-0000-0000-000000000004', 'lower'),
  ('22222222-0000-0000-0000-000000000005', 'upper'),
  ('22222222-0000-0000-0000-000000000006', 'highest'),
  ('22222222-0000-0000-0000-000000000008', 'upper'),
  ('22222222-0000-0000-0000-000000000008', 'middle');

insert into event_surfaces (event_id, surface) values
  ('22222222-0000-0000-0000-000000000001', 'grass'),
  ('22222222-0000-0000-0000-000000000001', 'turf'),
  ('22222222-0000-0000-0000-000000000002', 'grass'),
  ('22222222-0000-0000-0000-000000000003', 'turf'),
  ('22222222-0000-0000-0000-000000000004', 'grass'),
  ('22222222-0000-0000-0000-000000000005', 'turf'),
  ('22222222-0000-0000-0000-000000000006', 'turf'),
  ('22222222-0000-0000-0000-000000000008', 'grass');

insert into event_features (event_id, feature) values
  ('22222222-0000-0000-0000-000000000001', 'restrooms'),
  ('22222222-0000-0000-0000-000000000001', 'concessions'),
  ('22222222-0000-0000-0000-000000000001', 'free_parking'),
  ('22222222-0000-0000-0000-000000000003', 'stay_to_play'),
  ('22222222-0000-0000-0000-000000000003', 'restrooms'),
  ('22222222-0000-0000-0000-000000000003', 'concessions'),
  ('22222222-0000-0000-0000-000000000003', 'free_wifi'),
  ('22222222-0000-0000-0000-000000000003', 'synthetic_turf'),
  ('22222222-0000-0000-0000-000000000006', 'stay_to_play'),
  ('22222222-0000-0000-0000-000000000006', 'accessible'),
  ('22222222-0000-0000-0000-000000000006', 'concessions'),
  ('22222222-0000-0000-0000-000000000006', 'free_wifi'),
  ('22222222-0000-0000-0000-000000000006', 'pet_friendly');

insert into event_images (event_id, url, sort_order) values
  ('22222222-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800', 0),
  ('22222222-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1508163223045-1880bc36e222?w=800', 1),
  ('22222222-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1520676930912-e2bfeb9db5cb?w=800', 2),
  ('22222222-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800', 0),
  ('22222222-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800', 1),
  ('22222222-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=800', 0),
  ('22222222-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800', 1);

insert into sponsors (event_id, name, link, logo_url) values
  ('22222222-0000-0000-0000-000000000001', 'Round Rock Athletics', 'https://roundrockathletics.example.com',
   'https://images.unsplash.com/photo-1519638399535-1b036603ac77?w=200'),
  ('22222222-0000-0000-0000-000000000001', 'Whataburger', 'https://whataburger.com',
   'https://images.unsplash.com/photo-1550547660-d9450f859349?w=200'),
  ('22222222-0000-0000-0000-000000000003', 'Nike Football', 'https://nike.com/football',
   'https://images.unsplash.com/photo-1512661599793-f4f5f6d43614?w=200'),
  ('22222222-0000-0000-0000-000000000006', 'Gatorade', 'https://gatorade.com',
   'https://images.unsplash.com/photo-1550461716-dbf266b2a8a7?w=200');

insert into event_milestones (event_id, milestone_date, title, description, sort_order, is_auto) values
  ('22222222-0000-0000-0000-000000000001', current_date + 3,  'Early-Bird Ends',
   'Save $75 per team when you register by end-of-day Friday.', 0, true),
  ('22222222-0000-0000-0000-000000000001', current_date + 5,  'Registration Deadline',
   'Final roster and payment due to guarantee your slot.', 1, true),
  ('22222222-0000-0000-0000-000000000001', current_date + 10, 'Schedule Posted',
   'Full match schedule + field assignments emailed to team managers.', 2, false),
  ('22222222-0000-0000-0000-000000000006', current_date + 45, 'Registration Deadline', null, 0, true),
  ('22222222-0000-0000-0000-000000000006', current_date + 55, 'Scout Confirmations Locked',
   'Attending college programs finalized + shared with participating clubs.', 1, false);

-- ── Reviews ───────────────────────────────────────────────────────────
insert into reviews (id, event_id, author_id, status,
  rating_fields, rating_facilities, rating_management, rating_competition,
  rating_diversity, rating_cost_value,
  review_title, review_body, would_return,
  reviewer_user_type, reviewer_role, created_at
) values
  ('33333333-0000-0000-0000-000000000001',
   '22222222-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000001', 'published',
   5, 5, 5, 4, 4, 4,
   'Beautifully run event — best summer tournament we did',
   'The Round Rock complex is genuinely top-notch. Concessions were fast, the shade pavilion saved us on the 100+ degree Sunday, and every ref was calm + consistent. Two of our matches had video review available, which is unheard of at this age group. Would 100% return.',
   true, 'attendee', 'coach', now() - interval '38 days'),
  ('33333333-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000002', 'published',
   4, 5, 4, 5, 5, 3,
   'Great competition, weekend runs like clockwork',
   'Bracket play was properly matched — we saw teams from six different states. The $725 price tag stings for a two-day event, but the refs earned their fee. Two of our players got recruited into ID camps at the concessions tent, so no complaints from the family side.',
   true, 'attendee', 'coach', now() - interval '35 days'),
  ('33333333-0000-0000-0000-000000000003',
   '22222222-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000005', 'published',
   3, 3, 3, 5, 4, 3,
   'Fine soccer, muddled logistics',
   'Great level of play and our team enjoyed the games. Schedule shuffled twice on Saturday morning without email notice — we found out from the club WhatsApp. Facilities are fine but restrooms filled up quickly. Would recommend organizers push updates through the official channels.',
   true, 'attendee', 'coach', now() - interval '30 days'),
  ('33333333-0000-0000-0000-000000000004',
   '22222222-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000006', 'published',
   4, 4, 5, 4, 3, 5,
   'Value pick — good introductory tournament',
   'For $495 you get a solid weekend of matches. Bridgeview facilities are aging but functional; concessions are basic and the field paint could use a refresh. Marcus and team are super communicative, which counts for a lot when travelling with a young team.',
   true, 'attendee', 'coach', now() - interval '10 days'),
  ('33333333-0000-0000-0000-000000000005',
   '22222222-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000003', 'published',
   3, 3, 4, 3, 4, 4,
   'Solid event, nothing flashy',
   'Middle-of-the-road on facilities, but the schedule delivery + score-tracking are actually decent. Our U11 side lost in the semi but the ref crew was consistent across five matches. Nothing bad to say.',
   null, 'attendee', 'team_manager', now() - interval '9 days'),
  ('33333333-0000-0000-0000-000000000006',
   '22222222-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000003', 'draft',
   4, 4, 4, 5, 4, 3,
   'Draft thought — pending',
   'Still deciding whether to publish. Great weekend overall.',
   true, 'attendee', 'team_manager', now() - interval '20 days');

-- ── Comments ──────────────────────────────────────────────────────────
insert into comments (id, review_id, author_id, parent_comment_id, body, is_owner_reply, created_at) values
  ('44444444-0000-0000-0000-000000000001',
   '33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', null,
   'Ashley — thanks so much for the kind words. Video review at U14 is a first for us and it looks like it''s going to become the standard. See you at Summer Classic!',
   true, now() - interval '37 days'),
  ('44444444-0000-0000-0000-000000000002',
   '33333333-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000005', null,
   'Confirming the shade pavilion is the real MVP — we brought pop-up tents last year and the wind ate them alive.',
   false, now() - interval '36 days'),
  ('44444444-0000-0000-0000-000000000003',
   '33333333-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000002',
   'Same experience last year — cannot recommend the pavilion enough.',
   false, now() - interval '36 days'),
  ('44444444-0000-0000-0000-000000000004',
   '33333333-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000002', null,
   'Dev — total fair criticism, we''ve since moved to a single Slack channel + SMS for schedule changes. Apologies for the mixed signals.',
   true, now() - interval '29 days');

-- ── Helpful marks ─────────────────────────────────────────────────────
insert into review_helpful (user_id, review_id) values
  ('bbbbbbbb-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000004'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000002');

-- ── Promo flow (CSV → promos → applied verified review) ─────────
insert into submitted_csvs (id, ed_id, event_id, file_path, status, raw_emails, created_at) values
  ('55555555-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000003',
   'seed://csv-summer-classic-2025.csv', 'approved',
   '["coach-ashley@example.test","coach-carlos@example.test","coach-rian@example.test"]'::jsonb,
   now() - interval '50 days'),
  ('55555555-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000003',
   '22222222-0000-0000-0000-000000000004',
   'seed://csv-glc-u10.csv', 'pending',
   '["coach-dev@example.test","mgr-priya@example.test"]'::jsonb,
   now() - interval '4 days');

insert into promo_codes (id, submitted_csv_id, event_id, email, pretty_code, url_token, user_id, status, applied_at, created_at) values
  ('66666666-0000-0000-0000-000000000001',
   '55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003',
   'coach-ashley@example.test', 'A1B2C3D4', 'demo-ashley-token-xxxxxxxxxxxxxxx',
   'bbbbbbbb-0000-0000-0000-000000000001', 'applied',
   now() - interval '38 days', now() - interval '48 days'),
  ('66666666-0000-0000-0000-000000000002',
   '55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003',
   'coach-carlos@example.test', 'E5F6G7H8', 'demo-carlos-token-xxxxxxxxxxxxxxx',
   'bbbbbbbb-0000-0000-0000-000000000002', 'active',
   null, now() - interval '48 days'),
  ('66666666-0000-0000-0000-000000000003',
   '55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003',
   'coach-rian@example.test', 'J9K0L1M2', 'demo-rian-token-xxxxxxxxxxxxxxxxx',
   'bbbbbbbb-0000-0000-0000-000000000006', 'active',
   null, now() - interval '48 days'),
  -- Unlinked email → drives the "Invited" chip on the admin promo table.
  ('66666666-0000-0000-0000-000000000004',
   '55555555-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003',
   'invited-jamie@example.test', 'N3O4P5Q6', 'demo-jamie-token-xxxxxxxxxxxxxxx',
   null, 'sent',
   null, now() - interval '48 days');

update reviews
   set guru_review = true, promo_id = '66666666-0000-0000-0000-000000000001'
 where id = '33333333-0000-0000-0000-000000000001';

insert into promo_funnel_events (promo_id, step, occurred_at) values
  ('66666666-0000-0000-0000-000000000001', 'landed',  now() - interval '39 days'),
  ('66666666-0000-0000-0000-000000000001', 'applied', now() - interval '38 days'),
  ('66666666-0000-0000-0000-000000000002', 'landed',  now() - interval '32 days');

-- ── Claim requests ───────────────────────────────────────────────────
insert into claim_requests (id, tournament_id, event_id, requester_id, status, phone, links, message, created_at) values
  ('77777777-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000008',
   'aaaaaaaa-0000-0000-0000-000000000003', 'pending',
   '+1 (312) 555-0142',
   array['https://greatlakesunitedfc.example.com/staff','https://linkedin.example.com/in/marcus-okoye'],
   'This is our tournament — the listing was mirrored from our own site by the admin. Happy to hop on a call.',
   now() - interval '3 days'),
  ('77777777-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000008',
   'aaaaaaaa-0000-0000-0000-000000000004', 'declined',
   '+1 (602) 555-0198',
   array['https://desertsun.example.com/about'],
   'Interested in taking over the Heartland listing — Desert Sun is expanding.',
   now() - interval '5 days');

update claim_requests set decline_reason='Requester is not the organizing club — see the org contact form.'
 where id='77777777-0000-0000-0000-000000000002';

-- ── Favorites + Activity ──────────────────────────────────────────────
insert into favorites (user_id, event_id, created_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005', now() - interval '1 days'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', now() - interval '10 days'),
  ('bbbbbbbb-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000006', now() - interval '3 days');

insert into recently_viewed (user_id, event_id, viewed_at) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', now() - interval '1 hour'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000005', now() - interval '2 hours'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003', now() - interval '3 hours'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000006', now() - interval '5 hours'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000003', now() - interval '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000001', now() - interval '2 days');

-- ── Demo reviews for the landing "Recent Reviews" carousel ──────────
insert into demo_reviews (reviewer_name, reviewer_role, event_title, review_title, review_body, overall, sort_order) values
  ('Katie R.',  'Coach',        'Fall Classic — U12 Girls',
   'Best-organized weekend of our season',
   'Rosters were pinned to the pavilion door by 7:30 each morning and every match started on time. The concessions crew even donated leftover pizzas to a nearby shelter Sunday night.',
   4.83, 0),
  ('Miguel D.', 'Team Manager', 'Sunshine State Showcase',
   'Great scouting exposure',
   'Ten of our U16 boys had college coaches at their matches. Our director spent the weekend more like a talent scout than a coach.',
   4.50, 1),
  ('Priya K.',  'Parent',       'North Star Cup',
   'Facilities were the star',
   'The turf was pristine, the water refill stations kept up, and the on-site trainer taped my son''s ankle without charging us. Little things.',
   4.67, 2);

-- ── FAQs ─────────────────────────────────────────────────────────────
insert into faqs (title, body, audience, sort_order) values
  ('How do I get my event listed?',
   'Sign up as an Event Director + hit "Add New Tournament" on your dashboard. Free listings need only a title + dates; adding logos, sponsors, and premium features is optional.',
   'event_director', 0),
  ('What''s the difference between free and premium?',
   'Premium unlocks video, up to 13 images, sponsor logos, teams-attended URLs, and a Key Dates section. Payments aren''t wired yet — the platform team upgrades events on request during launch.',
   'event_director', 1),
  ('Why can''t I edit my review anymore?',
   'Published reviews lock 30 days after the event''s end date. Draft reviews can be edited at any time.',
   'attendee', 0),
  ('How do verified (GURU) reviews work?',
   'An Event Director uploads a coach-email CSV → admin approves → each coach gets a personalized promo link. Publishing a review through that link stamps the "GURU REVIEW" badge.',
   'both', 0),
  ('Is my email visible to other users?',
   'No. Emails are private + never rendered on any public surface. Only your first name + organization / club appear on your reviews and profile.',
   'both', 1);

-- ── Flagged content (admin Flagged page) ─────────────────────────────
-- One flag on a review (profanity), two on a comment (grouping proof),
-- one with reason='other' + additional_info so the admin detail card
-- renders every column.
insert into flagged_content (content_type, content_id, flagged_by, reason, additional_info, created_at) values
  ('review',  '33333333-0000-0000-0000-000000000003', 'bbbbbbbb-0000-0000-0000-000000000006',
   'profanity', null, now() - interval '7 days'),
  ('review',  '33333333-0000-0000-0000-000000000005', 'bbbbbbbb-0000-0000-0000-000000000004',
   'other', 'Feels like the reviewer confused us with a different event — location details are off.',
   now() - interval '2 days'),
  ('comment', '44444444-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000003',
   'solicitation', null, now() - interval '20 days'),
  ('comment', '44444444-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000004',
   'other', 'Second on the solicitation — looks like an ad for a competing brand.',
   now() - interval '18 days');

-- ── Support inbox sink ───────────────────────────────────────────────
insert into support_messages (user_id, name, email, message, created_at) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Carlos Mendes', 'coach-carlos@example.test',
   'The Coach filter chip on Search Events resets when I go back to page 2. Small paper cut but repeatable.',
   now() - interval '4 days');

-- ── Banned words ─────────────────────────────────────────────────────
insert into banned_words (word) values ('cuss'), ('idiot');

-- ── Search queries → drives get_popular_searches ───────────────────
insert into search_queries (term, created_at)
select term, now() - (interval '1 day' * i)
from (values
  ('U12 girls Texas'),
  ('U12 girls Texas'),
  ('U12 girls Texas'),
  ('Kansas City soccer'),
  ('Kansas City soccer'),
  ('U16 boys Arizona'),
  ('Great Lakes Cup'),
  ('U10 tournament'),
  ('U10 tournament'),
  ('scouted tournaments')
) as t(term), generate_series(0, 2) as i;

-- Sync the published-reviews counter so the landing stats band reads
-- the accurate historical figure. Tournament + event counters auto-
-- incremented via the S8.1 triggers on each seeded insert.
update platform_counters
   set value = (select count(*) from reviews where status='published')
 where key = 'published_reviews_total';
