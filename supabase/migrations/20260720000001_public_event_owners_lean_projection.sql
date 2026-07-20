-- Narrow public_event_owners to what its consumers actually read
-- (S11.8). The view exists for host-logo lookups keyed by
-- events.owner_id — every consumer selects id + org_logo_url +
-- profile_photo_url only. The host *identity* (name, org, contact)
-- renders from public_directors via getDirectorProfile, so the wider
-- projection (organization_title, org_description) was dead surface,
-- and last_name deliberately never ships here: an ED's full name is
-- public via public_directors, but an unused view is no place to
-- carry PII. first_name stays — the h1 write-denial harness requires
-- it in every probed projection.
--
-- NOTE the drop/recreate re-applies the 20260718000005 default
-- privileges (write grants to anon/authenticated), so the explicit
-- revoke below — the H1 write-denial probes pin this.

drop view if exists public_event_owners;
create view public_event_owners
  with (security_invoker = false)
as
  select p.id,
         p.first_name,
         p.org_logo_url,
         p.profile_photo_url
  from profiles p
  where p.user_type = 'event_director';

grant select on public_event_owners to anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public_event_owners
  from anon, authenticated;
