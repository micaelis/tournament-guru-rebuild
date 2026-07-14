-- =====================================================================
-- Advertiser pages: Contact Us + FAQ
-- The base schema created `contact_requests` and `faqs` with RLS/policies
-- for contact_requests, but the anon/authenticated roles were never granted
-- the underlying table privileges (and faqs had no RLS/read policy). Without
-- the GRANTs, PostgREST returns 42501 "permission denied for table" even
-- though the RLS policy would allow the row. This migration fixes that and
-- seeds the advertiser FAQ set.
-- =====================================================================

-- ── contact_requests ──
-- RLS policy "contact: anyone submit" already permits the insert; grant the
-- table privilege so the anon role can exercise it. (No select grant: reads
-- stay admin-only via "contact: admin read".)
grant insert on public.contact_requests to anon, authenticated;

-- ── faqs ── public, read-only content.
alter table public.faqs enable row level security;
drop policy if exists "faqs: public read" on public.faqs;
create policy "faqs: public read" on public.faqs for select using (true);
grant select on public.faqs to anon, authenticated;

-- ── Seed the advertiser FAQ set ──
-- Re-runnable: deletes any prior copy of these rows (matched by title), then
-- re-inserts. A fresh production project seeds cleanly, and re-applying the
-- migration never duplicates. Scoped by title so it leaves any other FAQs
-- untouched.
delete from public.faqs
where title in (
  'Who can advertise on your platform?',
  'How do I get started?',
  'Can you help with ad design?',
  'What ad formats do you support?',
  'How long will my ad be shown?',
  'Can I choose where my ad appears?',
  'Can I see how my ad is performing?'
);

insert into public.faqs (title, content, sort) values
  ('Who can advertise on your platform?',
   'Any registered business or individual offering a product or service relevant to our audience is welcome to apply.',
   1),
  ('How do I get started?',
   'Simply register your company and fill out our contact form. We''ll reach out to you to discuss the details and next steps.',
   2),
  ('Can you help with ad design?',
   'Yes! If you don''t have a ready-made banner, our design team can create one for you based on the information you provide.',
   3),
  ('What ad formats do you support?',
   'We currently support static horizontal banners, with a word limit and minimum resolution (e.g. 720px wide). Full specifications will be shared during setup.',
   4),
  ('How long will my ad be shown?',
   'The duration depends on the agreement — we offer flexible packages from short-term promos to long-running campaigns.',
   5),
  ('Can I choose where my ad appears?',
   'Absolutely. We''ll work with you to place your ad in the most relevant sections of the app — ensuring it reaches the right audience at the right time.',
   6),
  ('Can I see how my ad is performing?',
   'Yes — you''ll get access to a dashboard with live metrics: impressions, clicks, likes, and more. We also send you weekly performance reports.',
   7);
