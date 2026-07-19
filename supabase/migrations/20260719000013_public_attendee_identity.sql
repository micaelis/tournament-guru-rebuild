-- Public attendee identity — the public name rule is FIRST NAME + LAST
-- INITIAL ("Ashley M."). last_name itself is never exposed: the public
-- projection views compute upper(left(last_name, 1)) instead, and the
-- new public_attendees view backs the /attendees/[id] page header.
--
-- NOTE every drop/recreate here re-applies the 20260718000005 default
-- privileges (write grants to anon/authenticated), so each view gets an
-- explicit revoke — the H1 write-denial probes pin this.

-- 1. review_author_public gains last_initial.
drop view if exists review_author_public;
create view review_author_public
  with (security_invoker = false)
as
  select r.id  as review_id,
         case when r.anonymized then null else p.first_name end          as first_name,
         case when r.anonymized then null
              else upper(left(p.last_name, 1)) end                       as last_initial,
         case when r.anonymized then null else p.organization_title end  as organization_title,
         case when r.anonymized then null else p.profile_photo_url end   as profile_photo_url,
         r.reviewer_role,
         r.guru_review
  from reviews r
  left join profiles p on p.id = r.author_id;

-- 2. public_comment_authors gains last_initial.
drop view if exists public_comment_authors;
create view public_comment_authors
  with (security_invoker = false)
as
  select c.id  as comment_id,
         case when c.anonymized then null else p.first_name end         as first_name,
         case when c.anonymized then null
              else upper(left(p.last_name, 1)) end                      as last_initial,
         case when c.anonymized then null else p.organization_title end as organization_title,
         case when c.anonymized then null else p.org_logo_url end       as org_logo_url,
         case when c.anonymized then null else p.profile_photo_url end  as profile_photo_url,
         case when c.anonymized then null else p.user_type::text end    as user_type,
         c.author_id,
         c.is_owner_reply
  from comments c
  left join profiles p on p.id = c.author_id;

-- 3. Public attendee page header. Attendees only (EDs have /directors);
--    blocked users drop out so their page 404s. role_title and
--    organization_title ("Club Affiliation") are deliberately projected:
--    the public attendee page spec displays both.
create view public_attendees
  with (security_invoker = false)
as
  select p.id,
         p.first_name,
         upper(left(p.last_name, 1)) as last_initial,
         p.profile_photo_url,
         p.location_city,
         p.location_state_abbr,
         p.location_formatted,
         p.role_title,
         p.organization_title
  from profiles p
  where p.user_type = 'attendee'
    and not p.blocked;

grant select on review_author_public, public_comment_authors, public_attendees
  to anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on review_author_public, public_comment_authors, public_attendees
  from anon, authenticated;
