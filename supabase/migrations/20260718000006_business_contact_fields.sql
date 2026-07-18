-- Add public business-contact fields to profiles (ED only in practice).
-- These are intentionally public — never the auth email.

alter table profiles
  add column business_phone   text,
  add column business_email   text,
  add column business_website  text;

-- Recreate the public_directors view to include them.
drop view if exists public_directors;
create view public_directors with (security_invoker = false) as
  select id, first_name, last_name, organization_title, org_logo_url,
         org_description, profile_photo_url,
         business_phone, business_email, business_website
  from profiles where user_type = 'event_director';

grant select on public_directors to anon, authenticated;

-- Let authenticated users write their own business contact fields.
-- (The existing column-level UPDATE grant on profiles must include them.)
grant update (business_phone, business_email, business_website)
  on profiles to authenticated;
