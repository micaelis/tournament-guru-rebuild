-- ─────────────────────────────────────────────────────────────────────
-- Admin user search by email.
--
-- The admin /dashboard/users search filters profiles by name and
-- organization, but emails live in auth.users, which the app's
-- authenticated client cannot read — so an admin could not find the
-- account behind a support request that only quotes an email address.
--
-- `admin_search_users_by_email(term)` is the narrow bridge: SECURITY
-- DEFINER, admin-only, and it returns ONLY matching user ids — never
-- the emails themselves — so the page can fold the ids into its
-- existing profiles filter without a new PII read surface. Guards per
-- the house pattern (S10.3): explicit null-uid raise, `is not true`
-- role predicate, pinned search_path, EXECUTE revoked from
-- public/anon. Capped at 100 ids so a one-letter term can't balloon
-- the PostgREST `or()` URL.
-- ─────────────────────────────────────────────────────────────────────

create or replace function admin_search_users_by_email(term text)
  returns setof uuid
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if is_admin() is not true then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if term is null or length(trim(term)) = 0 then
    return;
  end if;
  return query
    select u.id
      from auth.users u
     where u.email ilike '%' || trim(term) || '%'
     limit 100;
end;
$$;

revoke execute on function admin_search_users_by_email(text) from public, anon;
grant execute on function admin_search_users_by_email(text) to authenticated, service_role;
