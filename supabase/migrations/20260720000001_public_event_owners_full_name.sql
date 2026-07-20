-- EDs are public business identities — full name everywhere (S11.8).
-- public_event_owners was the one ED-facing projection still omitting
-- last_name, so the event-page host surface couldn't show the same
-- name /directors and the ED page show. Recreate it to project the
-- full name, mirroring public_directors. The attendee/reviewer views
-- (review_author_public, public_comment_authors, public_attendees)
-- keep the "First L." rule — this migration does not touch them.
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
         p.last_name,
         p.organization_title,
         p.org_logo_url,
         p.org_description,
         p.profile_photo_url
  from profiles p
  where p.user_type = 'event_director';

grant select on public_event_owners to anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public_event_owners
  from anon, authenticated;
