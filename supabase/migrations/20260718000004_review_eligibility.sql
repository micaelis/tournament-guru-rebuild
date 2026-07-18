-- ─────────────────────────────────────────────────────────────────────
-- Review eligibility & moderation
--
-- 1. Tighten reviews INSERT to attendee-type, non-blocked users only.
--    EDs and admins cannot write reviews (RLS boundary, not just UI).
-- 2. Add paid-event guard to apply_promo_to_review — guru/verified
--    reviews are only allowed on paid events (premium or general_ad).
-- ─────────────────────────────────────────────────────────────────────

set search_path = public, extensions, pg_temp;

-- ── 1. Reviews INSERT: attendee-only, non-blocked ────────────────────

drop policy p_reviews_insert on reviews;

create policy p_reviews_insert on reviews for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.user_type = 'attendee'
      and not p.blocked
  )
);

-- ── 2. Guru/verified blocked on non-paid events ─────────────────────

create or replace function apply_promo_to_review(
  p_review uuid,
  p_promo  uuid
) returns void
  language plpgsql
  security definer
  set search_path = public, extensions, pg_temp
as $$
declare
  v_author uuid;
  v_review_event uuid;
  v_review_status review_status;
  v_review_guru boolean;
  v_promo_event uuid;
  v_promo_email citext;
  v_promo_user  uuid;
  v_promo_status promo_status;
  v_caller_email citext;
  v_is_paid boolean;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;

  select author_id, event_id, status, guru_review
    into v_author, v_review_event, v_review_status, v_review_guru
    from reviews where id = p_review;
  if v_author is null or v_review_event is null then
    raise exception 'review not found' using errcode = '02000';
  end if;
  if v_author <> auth.uid() then
    raise exception 'review not yours' using errcode = '42501';
  end if;
  if v_review_guru then
    raise exception 'review already verified' using errcode = '42501';
  end if;

  -- Guru/verified only on paid events (premium or general_ad).
  select (is_premium or is_general_ad) into v_is_paid
    from events where id = v_review_event;
  if not coalesce(v_is_paid, false) then
    raise exception 'verified reviews require a paid event' using errcode = '42501';
  end if;

  select event_id, email, user_id, status
    into v_promo_event, v_promo_email, v_promo_user, v_promo_status
    from promo_codes where id = p_promo;
  if v_promo_event is null or v_promo_email is null then
    raise exception 'promo not found' using errcode = '02000';
  end if;
  if v_promo_status = 'applied' then
    raise exception 'promo already applied' using errcode = '42501';
  end if;
  if v_promo_status = 'void' then
    raise exception 'promo is void' using errcode = '42501';
  end if;
  if v_promo_event is distinct from v_review_event then
    raise exception 'promo/review event mismatch' using errcode = '42501';
  end if;

  select email::citext into v_caller_email from auth.users where id = auth.uid();
  if v_caller_email is null then
    raise exception 'no caller email on file' using errcode = '42501';
  end if;
  if v_promo_email <> v_caller_email and (v_promo_user is null or v_promo_user <> auth.uid()) then
    raise exception 'promo not addressed to you' using errcode = '42501';
  end if;

  update reviews
     set guru_review = true, promo_id = p_promo
   where id = p_review;
  update promo_codes
     set status = 'applied', applied_at = now()
   where id = p_promo;
  update promo_codes
     set status = 'void'
   where email = v_promo_email
     and event_id = v_promo_event
     and id <> p_promo
     and status <> 'applied';
end;
$$;
