-- ─────────────────────────────────────────────────────────────────────
-- Promo CSV eligibility pre-flight (S3.2 follow-through).
--
-- Spec §6.3: on the Send Emails popup, rows whose email belongs to an
-- existing NON-COACH account show "This email is already in use by an
-- account with a different user type and will be ignored." and are
-- auto-excluded (not re-addable). The check needs auth.users.email,
-- which the app's clients cannot read — and plumbing the service role
-- into the app is off the table. This SECURITY DEFINER RPC is the
-- narrow bridge instead.
--
-- Returns per-email eligibility ONLY — (email, status), where the
-- email column just echoes the caller's own input. No ids, names, or
-- any other account data cross the boundary; the worst an authorized
-- caller can learn is "this address has a non-coach account", which is
-- exactly what the popup must display.
--
--   no account                                → eligible  (invited to register)
--   attendee + role coach, not blocked        → eligible
--   attendee + role coach, blocked            → blocked
--   anything else (ED, admin, non-coach role,
--     or an auth user with no profile row)    → wrong-user-type
--
-- Statuses mirror the app's PreflightRow union. Guards per the house
-- pattern (S10.3): null-uid raise, `is_event_host() is not true` (the
-- popup is admin-side today, but the submitting ED may pre-flight
-- their own list), pinned search_path, EXECUTE revoked from
-- public/anon.
-- ─────────────────────────────────────────────────────────────────────

create or replace function promo_email_eligibility(p_emails text[])
  returns table(email text, status text)
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if is_event_host() is not true then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Ordinality keeps the verdicts in the caller's input order.
  return query
    select e.value,
           case
             when u.id is null then 'eligible'
             when p.user_type = 'attendee' and p.role_title = 'coach'
               and p.blocked then 'blocked'
             when p.user_type = 'attendee' and p.role_title = 'coach'
               then 'eligible'
             else 'wrong-user-type'
           end
      from unnest(p_emails) with ordinality as e(value, ord)
      left join auth.users u on lower(u.email) = lower(trim(e.value))
      left join profiles p on p.id = u.id
     order by e.ord;
end;
$$;

revoke execute on function promo_email_eligibility(text[]) from public, anon;
grant execute on function promo_email_eligibility(text[]) to authenticated, service_role;
