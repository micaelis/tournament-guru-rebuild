-- ─────────────────────────────────────────────────────────────────────
-- Review Gate 1 — C4 (+M2), H1, H2.
--
-- C4 (+M2): the promo landing flow could not complete for any
-- non-admin caller because promo_codes RLS restricted reads to
-- admin / already-linked user / owning ED, and the funnel insert
-- policy was admin-only. Replaced with two SECURITY DEFINER RPCs:
--   - promo_landing_info(token) : anon-callable, returns event_id +
--     email hint if the token is on file (never leaks caller state).
--   - claim_promo(token) : authenticated-only, requires the caller's
--     auth.users.email to match promo.email. Flips 'sent' → 'active',
--     attaches user_id, logs a 'landed' funnel event, and returns
--     the promo_id + event_id the client needs to route into the
--     review form.
--
-- H1: public reviewer + comment + host reads must go through
-- SECURITY DEFINER views so anon callers see the display fields
-- (spec-safe: first_name + org + photo; NEVER last_name / email /
-- dob). Widens the existing review_author_public with org info and
-- introduces public_comment_authors + public_event_owner views.
--
-- H2: onboarding step 3 is optional in content (per SCHEMA-DESIGN
-- §11) but the wizard's completion checker guessed at whether the
-- user had submitted the step by inspecting distance_pref. Adds a
-- profiles.preferences_completed marker so the wizard has an
-- explicit signal.
-- ─────────────────────────────────────────────────────────────────────

-- ── C4: promo landing RPCs
create or replace function promo_landing_info(p_token text)
  returns table(event_id uuid, email citext)
  language sql
  security definer
  set search_path = public, extensions, pg_temp
as $$
  select event_id, email
  from promo_codes
  where url_token = p_token
    and status <> 'void'
  limit 1;
$$;

create or replace function claim_promo(p_token text)
  returns table(promo_id uuid, event_id uuid)
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
as $$
declare
  v_promo promo_codes;
  v_caller_email citext;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  select * into v_promo from promo_codes where url_token = p_token;
  if v_promo.id is null or v_promo.status = 'void' then
    raise exception 'promo not available' using errcode = '02000';
  end if;

  select email::citext into v_caller_email from auth.users where id = auth.uid();
  if v_caller_email is null or v_promo.email <> v_caller_email then
    raise exception 'promo not addressed to you' using errcode = '42501';
  end if;

  if v_promo.status = 'sent' then
    update promo_codes set status = 'active' where id = v_promo.id;
  end if;
  if v_promo.user_id is null then
    update promo_codes set user_id = auth.uid() where id = v_promo.id;
  end if;
  insert into promo_funnel_events(promo_id, step) values (v_promo.id, 'landed');

  promo_id := v_promo.id;
  event_id := v_promo.event_id;
  return next;
end;
$$;

-- Anon may resolve the token (safe: returns only event + email hint
-- for a token they already possess via email). Authenticated may
-- claim it.
grant execute on function promo_landing_info(text) to anon, authenticated;
grant execute on function claim_promo(text) to authenticated;

-- ── H1: public identity views
--
-- Drop + recreate the review_author_public view to widen its column
-- set to what the public review card needs. Anonymized rows return
-- NULL identity fields but keep the role + guru flag so the badge
-- still renders.
drop view if exists review_author_public;
create view review_author_public
  with (security_invoker = false)
as
  select r.id  as review_id,
         case when r.anonymized then null else p.first_name end          as first_name,
         case when r.anonymized then null else p.organization_title end  as organization_title,
         case when r.anonymized then null else p.profile_photo_url end   as profile_photo_url,
         r.reviewer_role,
         r.guru_review
  from reviews r
  left join profiles p on p.id = r.author_id;

-- Public comment author view — used by the public event page's
-- comment renders. Adds org_logo + user_type so the ED-owner reply
-- shows org branding instead of the personal profile.
create view public_comment_authors
  with (security_invoker = false)
as
  select c.id  as comment_id,
         case when c.anonymized then null else p.first_name end         as first_name,
         case when c.anonymized then null else p.organization_title end as organization_title,
         case when c.anonymized then null else p.org_logo_url end       as org_logo_url,
         case when c.anonymized then null else p.profile_photo_url end  as profile_photo_url,
         case when c.anonymized then null else p.user_type::text end    as user_type,
         c.author_id,
         c.is_owner_reply
  from comments c
  left join profiles p on p.id = c.author_id;

-- Host sidebar on the public event page. Wraps the same guarantee as
-- public_directors but keyed by owner_id so the code can select the
-- host by event.owner_id in one round trip. Includes org_description
-- so the sidebar can render the "About" blurb.
create view public_event_owners
  with (security_invoker = false)
as
  select p.id,
         p.first_name,
         p.organization_title,
         p.org_logo_url,
         p.org_description,
         p.profile_photo_url
  from profiles p
  where p.user_type = 'event_director';

grant select on review_author_public,
                public_comment_authors,
                public_event_owners
  to anon, authenticated;

-- ── H2: preferences_completed marker
alter table profiles
  add column if not exists preferences_completed boolean not null default false;

-- Extend the client UPDATE allow-list so the onboarding action can
-- flip it. Safe to expose: the user still has to satisfy step 1 + 2
-- + step 4 (ED) before onboarding_completed flips to true.
grant update (preferences_completed) on profiles to authenticated;
