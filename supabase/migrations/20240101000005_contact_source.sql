-- =====================================================================
-- contact_requests.source
-- Distinguish where a contact request came from — the general "Contact"
-- page vs. the advertiser "Contact Us" page — so inquiries can be triaged
-- apart. Free-text (no check constraint) so new surfaces can add their own
-- value later; existing rows and any un-tagged insert default to 'general'.
-- Idempotent so it's safe to re-apply on a fresh production project.
-- =====================================================================

alter table public.contact_requests
  add column if not exists source text not null default 'general';
