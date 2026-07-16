-- ─────────────────────────────────────────────────────────────────────
-- Admin user-ops RPCs.
--
-- admin_set_blocked(target, is_blocked):
--   Flip the `profiles.blocked` flag. The column isn't in the
--   authenticated UPDATE grant (spec: only admin can flip it), so
--   this SECURITY DEFINER wrapper is the client's path. When
--   `is_blocked` = true the middleware immediately signs the user
--   out on the next request.
--
-- admin_delete_user(target):
--   Delegate to the role-appropriate soft-delete. Admin accounts are
--   protected from being deleted this way.
-- ─────────────────────────────────────────────────────────────────────

create or replace function admin_set_blocked(
  target_user uuid,
  is_blocked boolean
) returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update profiles
     set blocked = is_blocked
   where id = target_user;
end;
$$;

create or replace function admin_delete_user(target_user uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare v_type user_type;
begin
  if not is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select user_type into v_type from profiles where id = target_user;
  if v_type is null then
    raise exception 'user not found' using errcode = '02000';
  end if;
  if v_type = 'admin' then
    raise exception 'cannot delete admin via this action' using errcode = '42501';
  end if;
  if v_type = 'event_director' then
    perform delete_ed_account(target_user);
  else
    perform soft_delete_attendee(target_user);
  end if;
end;
$$;
