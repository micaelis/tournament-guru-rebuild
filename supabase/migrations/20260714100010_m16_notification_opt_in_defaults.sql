-- =====================================================================
-- M16 — Notification preferences default OFF; existing rows opted out
--
-- The 10 notification-preference columns on `profiles` defaulted to
-- TRUE, and every existing row inherits that default. That means every
-- user in the current DB (including real ones carried over from the
-- Bubble migration) is silently opted in to every channel, without
-- ever having explicitly consented.
--
-- Rule from the operator: no user receives email unless they explicitly
-- opted in. This migration:
--   1. Flips the column defaults from TRUE to FALSE so new signups
--      land opted-out.
--   2. Bulk-updates every existing row to FALSE. Users who genuinely
--      want notifications now flip the switches themselves via
--      /dashboard/account.
--
-- Safe to re-run: the column default flip is idempotent; the update
-- writes FALSE regardless of prior value.
-- =====================================================================

alter table public.profiles
  alter column email_fav_events      set default false,
  alter column inapp_fav_events      set default false,
  alter column email_review_likes    set default false,
  alter column inapp_review_likes    set default false,
  alter column email_event_reviews   set default false,
  alter column inapp_event_reviews   set default false,
  alter column email_review_comments set default false,
  alter column inapp_review_comments set default false,
  alter column email_comment_replies set default false,
  alter column inapp_comment_replies set default false;

update public.profiles
   set email_fav_events      = false,
       inapp_fav_events      = false,
       email_review_likes    = false,
       inapp_review_likes    = false,
       email_event_reviews   = false,
       inapp_event_reviews   = false,
       email_review_comments = false,
       inapp_review_comments = false,
       email_comment_replies = false,
       inapp_comment_replies = false;
