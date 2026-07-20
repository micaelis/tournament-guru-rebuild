-- ─────────────────────────────────────────────────────────────────────
-- Account deletion becomes TRUE-DELETE (Option B, supersedes the
-- S6.1 anonymize-and-retain model).
--
-- Old model: soft_delete_attendee / delete_ed_account called
-- anonymize_account, which kept the user's reviews + comments alive
-- (anonymized=true, author_id=null) — a "deleted" user's reviews kept
-- counting toward event scores.
--
-- New model: both delete paths remove the user's comment + review rows
-- outright. The existing t_reviews_recalc AFTER DELETE trigger
-- recomputes the affected events' aggregates (and rolls up to the
-- tournament), the reviews→comments FK cascade removes the threads
-- under a deleted review, and t_reviews_purge_moderation /
-- t_comments_purge_moderation clean flagged_content + content_hidden
-- for every removed row — including the cascaded ones.
--
-- Deliberately UNCHANGED:
--   - detached + snapshot_* (event-deleted, review-kept) — a different
--     feature; author identity is retained there.
--   - platform_counters.published_reviews_total stays frozen: the
--     write trigger only ever increments, and deletes never decrement.
--   - scrub_profile_identity + the favorites/recently_viewed/
--     review_helpful/content_hidden cleanup + delete_ed_account's
--     event-ownership handling.
--
-- Delete order inside the RPCs: the user's comments first (covers
-- their comments on other people's reviews; replies underneath fall
-- to the parent_comment_id cascade), then their reviews (whole
-- threads fall to the review_id cascade).
-- ─────────────────────────────────────────────────────────────────────

create or replace function soft_delete_attendee(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if (is_admin() or auth.uid() = target_user) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from comments where author_id = target_user;
  delete from reviews  where author_id = target_user;
  delete from favorites       where user_id = target_user;
  delete from recently_viewed where user_id = target_user;
  delete from review_helpful  where user_id = target_user;
  delete from content_hidden  where user_id = target_user;
  perform scrub_profile_identity(target_user);
end;
$$;

create or replace function delete_ed_account(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare ev uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if (is_admin() or auth.uid() = target_user) is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update events
     set owner_id = null, claimed = false
   where owner_id = target_user
     and (created_by is null or created_by <> target_user);
  update tournaments
     set owner_id = null, claimed = false
   where owner_id = target_user
     and (created_by is null or created_by <> target_user);
  for ev in
    select id from events
      where owner_id = target_user
        and created_by = target_user
  loop
    perform delete_event(ev);
  end loop;
  delete from tournaments
    where owner_id = target_user and created_by = target_user;
  delete from submitted_csvs where ed_id = target_user;
  delete from comments where author_id = target_user;
  delete from reviews  where author_id = target_user;
  perform scrub_profile_identity(target_user);
end;
$$;

-- The public identity views projected NULLs for anonymized rows; the
-- column is going away, so recreate them without the CASE arms. A
-- drop/recreate re-applies 20260718000005's default write privileges,
-- so writes are re-revoked in the same file (the S8.5 lesson).
drop view if exists review_author_public;
create view review_author_public
  with (security_invoker = false)
as
  select r.id  as review_id,
         p.first_name,
         upper(left(p.last_name, 1)) as last_initial,
         p.organization_title,
         p.profile_photo_url,
         r.reviewer_role,
         r.guru_review
  from reviews r
  left join profiles p on p.id = r.author_id;

drop view if exists public_comment_authors;
create view public_comment_authors
  with (security_invoker = false)
as
  select c.id  as comment_id,
         p.first_name,
         upper(left(p.last_name, 1)) as last_initial,
         p.organization_title,
         p.org_logo_url,
         p.profile_photo_url,
         p.user_type::text as user_type,
         c.author_id,
         c.is_owner_reply
  from comments c
  left join profiles p on p.id = c.author_id;

grant select on review_author_public, public_comment_authors
  to anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on review_author_public, public_comment_authors
  from anon, authenticated;

-- Legacy purge: rows anonymized under the old model belong to users
-- who already deleted their accounts — remove them so the data (and
-- every affected event's score, via the delete trigger) is honest.
-- Comments on an anonymized review fall to the FK cascade with it.
do $$
declare
  n_reviews  bigint;
  n_comments bigint;
begin
  select count(*) into n_reviews  from reviews  where anonymized;
  select count(*) into n_comments from comments where anonymized;
  raise notice 'true-delete legacy purge: % anonymized reviews, % anonymized comments',
    n_reviews, n_comments;
  delete from comments where anonymized;
  delete from reviews  where anonymized;
end;
$$;

drop function anonymize_account(uuid);

alter table reviews  drop column anonymized;
alter table comments drop column anonymized;
