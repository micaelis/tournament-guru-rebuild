-- ─────────────────────────────────────────────────────────────────────
-- Cap promo_email_eligibility input at the CSV row cap (S10.15).
--
-- The RPC unnests + joins its whole input against auth.users in one
-- statement. Legitimate callers can never exceed 1000 addresses (the
-- app rejects CSVs over MAX_CSV_ROWS before this RPC ever runs), so an
-- oversize array is either a bug or someone using the definer bridge
-- as a bulk account-status oracle. Raise instead of truncating: a
-- silent trim would return a partial verdict the popup would render as
-- complete. 22023 = invalid_parameter_value.
--
-- Same body as 20260719000009 otherwise; the cap sits after the authz
-- gates so an unauthorized caller still learns nothing but "42501".
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
  if coalesce(array_length(p_emails, 1), 0) > 1000 then
    raise exception 'too many emails (max 1000)' using errcode = '22023';
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
