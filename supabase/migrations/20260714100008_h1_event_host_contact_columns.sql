-- =====================================================================
-- H1 — Real backing for the event-page "Contact host" modal
--
-- The modal used to console.info its payload and flip a `sent` state —
-- users saw "Message queued" but nothing landed anywhere. This adds the
-- two columns the modal action needs so a submission persists into
-- `contact_requests`:
--
--   • event_id     — the event the visitor is asking about (nullable
--                    to keep advertiser / general submissions valid).
--   • event_title  — snapshot of the event's title at submit time, so
--                    admins can identify the request even if the event
--                    is later deleted or renamed.
--
-- `contact_requests` was chosen over `event_requests` because the
-- public event page does not require sign-in and `event_requests`
-- policies require `requester_id = auth.uid()`. `contact_requests`
-- already accepts anon submissions (with the H5 rate-limit trigger as
-- the abuse gate).
-- =====================================================================

alter table public.contact_requests
  add column if not exists event_id uuid references public.events(id) on delete set null,
  add column if not exists event_title text;

-- Index for admin queries filtering by event.
create index if not exists idx_contact_requests_event on public.contact_requests(event_id);
